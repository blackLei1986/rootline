import type { DailyTargetSnapshot, DailyTargetSource } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export interface DailyTargetMorphology {
  lemma: string;
  source: string;
  confidence: "verified" | "derived" | "none";
  reviewStatus: "pending" | "approved" | "rejected";
  rootId: string;
  rootForm: string;
  rootMeaningEn: string[];
  rootMeaningZh: string[];
  rootExplanation: string;
  familyId: string | null;
  segments: NonNullable<DailyTargetSnapshot["morphology"]>["segments"];
  formationExplanation: string;
}

export interface DailyTargetCandidate {
  entry: ProductionVocabularyEntry;
  weakPriority?: number;
  rootRelevanceScore?: number;
  morphology?: DailyTargetMorphology | null;
}

export interface DailyTargetPlannerInput {
  carryoverTargets: readonly DailyTargetSnapshot[];
  weakCandidates: readonly DailyTargetCandidate[];
  rootCoreCandidates: readonly DailyTargetCandidate[];
  supportCandidates: readonly DailyTargetCandidate[];
}

const TARGET_LIMIT = 30;
const WEAK_TARGET_LIMIT = 5;
const ROOT_CLUSTER_LIMIT = 4;

export function buildDailyTargets(input: DailyTargetPlannerInput): DailyTargetSnapshot[] {
  const selected: DailyTargetSnapshot[] = [];
  const selectedLemmas = new Set<string>();

  const append = (target: DailyTargetSnapshot) => {
    if (selected.length >= TARGET_LIMIT) return false;
    const lemmaKey = normalize(target.lemma || target.word);
    if (!lemmaKey || selectedLemmas.has(lemmaKey)) return false;
    selectedLemmas.add(lemmaKey);
    selected.push(reposition(target, selected.length));
    return true;
  };

  for (const target of input.carryoverTargets) {
    if (selected.length >= TARGET_LIMIT) break;
    append({ ...target, source: "carryover", originSource: target.originSource ?? sourceOrigin(target.source) });
  }

  for (const candidate of [...input.weakCandidates].sort(weakOrder).slice(0, WEAK_TARGET_LIMIT)) {
    if (selected.length >= TARGET_LIMIT) break;
    append(fromCandidate(candidate, "weak", trustedMorphology(candidate)));
  }

  const rootCore = uniqueCandidates(input.rootCoreCandidates)
    .filter((candidate) => Boolean(trustedMorphology(candidate)))
    .filter((candidate) => !selectedLemmas.has(normalize(candidate.entry.lemma || candidate.entry.word)));
  for (const candidate of selectRootCore(rootCore)) {
    if (selected.length >= TARGET_LIMIT) break;
    append(fromCandidate(candidate, "root-core", trustedMorphology(candidate)));
  }

  const support = uniqueCandidates(input.supportCandidates).sort(supportOrder);
  for (const candidate of support) {
    if (selected.length >= TARGET_LIMIT) break;
    append(fromCandidate(candidate, "support", null));
  }

  return selected;
}

function selectRootCore(candidates: DailyTargetCandidate[]): DailyTargetCandidate[] {
  const byRoot = new Map<string, DailyTargetCandidate[]>();
  for (const candidate of candidates) {
    const rootId = trustedMorphology(candidate)?.rootId;
    if (!rootId) continue;
    const group = byRoot.get(rootId) ?? [];
    group.push(candidate);
    byRoot.set(rootId, group);
  }

  const roots = [...byRoot.entries()].map(([rootId, words]) => ({
    rootId,
    words: words.sort(rootCoreOrder),
    relevance: Math.max(...words.map((word) => word.rootRelevanceScore ?? 0)),
    familyBreadth: new Set(words.map((word) => trustedMorphology(word)?.familyId ?? `word:${word.entry.id}`)).size
  })).sort((left, right) => right.relevance - left.relevance
    || right.familyBreadth - left.familyBreadth
    || right.words.length - left.words.length
    || left.rootId.localeCompare(right.rootId, "en"))
    .slice(0, ROOT_CLUSTER_LIMIT);

  const familyCounts = new Map<string, number>();
  const nextIndex = new Map(roots.map((root) => [root.rootId, 0]));
  const result: DailyTargetCandidate[] = [];
  let added = true;
  while (result.length < TARGET_LIMIT && added) {
    added = false;
    for (const root of roots) {
      if (result.length >= TARGET_LIMIT) break;
      let index = nextIndex.get(root.rootId) ?? 0;
      while (index < root.words.length) {
        const candidate = root.words[index];
        index += 1;
        nextIndex.set(root.rootId, index);
        if (!candidate) continue;
        const morphology = trustedMorphology(candidate);
        const familyKey = `${root.rootId}:${morphology?.familyId ?? `word:${candidate.entry.id}`}`;
        if ((familyCounts.get(familyKey) ?? 0) >= 2) continue;
        result.push(candidate);
        familyCounts.set(familyKey, (familyCounts.get(familyKey) ?? 0) + 1);
        added = true;
        break;
      }
    }
  }
  return result;
}

function trustedMorphology(candidate: DailyTargetCandidate): DailyTargetMorphology | null {
  const morphology = candidate.morphology;
  if (!morphology || morphology.confidence === "none" || morphology.reviewStatus === "rejected") return null;
  const verifiedAndApproved = morphology.confidence === "verified" && morphology.reviewStatus === "approved";
  const exactGoldProjection = morphology.confidence === "derived"
    && morphology.source === "gold-dataset-exact-lemma";
  if (!verifiedAndApproved && !exactGoldProjection) return null;
  if (!morphology.rootId || !morphology.rootForm || !morphology.segments.length) return null;
  return normalize(morphology.lemma) === normalize(candidate.entry.lemma) ? morphology : null;
}

function fromCandidate(
  candidate: DailyTargetCandidate,
  source: Exclude<DailyTargetSource, "carryover">,
  morphology: DailyTargetMorphology | null
): DailyTargetSnapshot {
  const entry = candidate.entry;
  const actualSource = source === "weak" ? "weak" : morphology ? "root-core" : "support";
  return {
    wordId: entry.id,
    word: entry.word,
    lemma: entry.lemma,
    coreMeaningZh: entry.coreMeaningZh,
    coreDefinitionEn: entry.coreDefinitionEn,
    ...(entry.phonetic ? { phonetic: entry.phonetic } : {}),
    partOfSpeech: [...entry.partOfSpeech],
    example: entry.example,
    examples: [...entry.examples],
    source: actualSource,
    ...(source === "weak" ? { originSource: morphology ? "root-core" : "support" } : {}),
    rootId: morphology?.rootId ?? null,
    rootForm: morphology?.rootForm ?? null,
    rootMeaningEn: morphology ? [...morphology.rootMeaningEn] : [],
    rootMeaningZh: morphology ? [...morphology.rootMeaningZh] : [],
    rootExplanation: morphology?.rootExplanation ?? null,
    familyId: morphology?.familyId ?? null,
    morphology: morphology ? {
      segments: morphology.segments.map((segment) => ({ ...segment })),
      formationExplanation: morphology.formationExplanation
    } : null,
    block: 1,
    position: 0
  };
}

function reposition(target: DailyTargetSnapshot, position: number): DailyTargetSnapshot {
  return {
    ...target,
    block: Math.floor(position / 10) + 1 as 1 | 2 | 3,
    position
  };
}

function uniqueCandidates(candidates: readonly DailyTargetCandidate[]): DailyTargetCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalize(candidate.entry.lemma || candidate.entry.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function weakOrder(left: DailyTargetCandidate, right: DailyTargetCandidate): number {
  return (right.weakPriority ?? 0) - (left.weakPriority ?? 0) || candidateBaseOrder(left, right);
}

function rootCoreOrder(left: DailyTargetCandidate, right: DailyTargetCandidate): number {
  return (right.rootRelevanceScore ?? 0) - (left.rootRelevanceScore ?? 0)
    || right.entry.coverageTags.length - left.entry.coverageTags.length
    || left.entry.frequencyRank - right.entry.frequencyRank
    || right.entry.learningValueScore - left.entry.learningValueScore
    || left.entry.id.localeCompare(right.entry.id, "en");
}

function supportOrder(left: DailyTargetCandidate, right: DailyTargetCandidate): number {
  return left.entry.frequencyRank - right.entry.frequencyRank
    || coverageScore(right.entry) - coverageScore(left.entry)
    || right.entry.learningValueScore - left.entry.learningValueScore
    || left.entry.id.localeCompare(right.entry.id, "en");
}

function candidateBaseOrder(left: DailyTargetCandidate, right: DailyTargetCandidate): number {
  return left.entry.frequencyRank - right.entry.frequencyRank || left.entry.id.localeCompare(right.entry.id, "en");
}

function coverageScore(entry: ProductionVocabularyEntry): number {
  return entry.coverageTags.reduce((score, tag) => score + (tag === "ielts" || tag === "toefl" ? 3 : tag === "academic" ? 2 : 1), 0);
}

function sourceOrigin(source: DailyTargetSnapshot["source"]): "root-core" | "support" {
  if (source === "root-core" || source === "support") return source;
  return "support";
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
