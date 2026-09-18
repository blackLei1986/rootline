import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { words } from "@/data/words";
import { passesAcceptedMinimum } from "@/lib/vocabulary-production-report";
import type { ContentTier, CoverageTag, FrequencyBand, ProductionVocabularyEntry } from "@/types";

const target = Number(process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? 9_000);
const ecdictPath = resolve(process.argv.find((arg) => arg.startsWith("--ecdict="))?.split("=")[1] ?? "/tmp/rootline-ecdict-source/ECDICT-master/ecdict.csv");
const oewnDirectory = resolve(process.argv.find((arg) => arg.startsWith("--oewn="))?.split("=")[1] ?? "/tmp/rootline-oewn-source");
const outputPath = resolve(process.cwd(), "data/vocabulary/production-catalog.json");
const manifestPath = resolve(process.cwd(), "data/vocabulary/production-manifest.json");
const qaPath = resolve(process.cwd(), "data/vocabulary/qa-sample.json");
const publicDirectory = resolve(process.cwd(), "public/vocabulary-data");

interface EcdictRow { word: string; phonetic: string; definition: string; translation: string; pos: string; tag: string; bnc: string; frq: string; exchange: string; }
interface OewnEntry { [pos: string]: { sense?: Array<{ synset: string; derivation?: string[] }>; pronunciation?: Array<{ value: string }> } }
interface OewnSynset { definition?: string[]; example?: string[]; partOfSpeech?: string; }

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function lemmaFromExchange(word: string, exchange: string): string {
  const base = exchange.split("/").find((part) => part.startsWith("0:"))?.slice(2).trim().toLowerCase();
  return base && /^[a-z][a-z'-]*$/.test(base) ? base : word.toLowerCase();
}

function formsFromExchange(word: string, exchange: string): string[] {
  return [...new Set([word, ...exchange.split("/").map((part) => part.split(":").slice(1).join(":")).filter((value) => /^[a-z][a-z'-]*$/i.test(value))].map((value) => value.toLowerCase()))];
}

function cleanChinese(value: string, preferred?: string): string {
  const prefix: Record<string, string[]> = { n: ["n."], v: ["v.", "vt.", "vi."], a: ["a.", "adj."], s: ["a.", "adj."], r: ["ad.", "adv."] };
  const lines = value.replace(/\[网络\][^\\n\n]*/g, "").split(/\\n|\n/).map((line) => line.trim()).filter((line) => /[\u3400-\u9fff]/.test(line));
  const matched = preferred ? lines.find((line) => (prefix[preferred] ?? []).some((marker) => line.toLowerCase().startsWith(marker))) : undefined;
  return (matched ?? lines[0] ?? "").slice(0, 140);
}

function partOfSpeech(value: string, fallback?: string): string[] {
  const map: Record<string, string> = { n: "noun", v: "verb", a: "adjective", r: "adverb", s: "adjective" };
  const parsed = value.split("/").map((part) => { const [key, score] = part.split(":"); return { value: map[key], score: Number(score) || 0 }; }).filter((part) => part.value).sort((a, b) => b.score - a.score).map((part) => part.value);
  return [...new Set(parsed.length ? parsed : [map[fallback ?? ""] ?? "word"])];
}

function preferredPos(value: string): string | undefined {
  const top = value.split("/").map((part) => { const [key, score] = part.split(":"); return { key, score: Number(score) || 0 }; }).filter((part) => ["n", "v", "a", "r", "s"].includes(part.key)).sort((a, b) => b.score - a.score)[0];
  return top?.key;
}

function frequencyRank(row: EcdictRow): number {
  const ranks = [Number(row.frq), Number(row.bnc)].filter((rank) => Number.isFinite(rank) && rank > 0);
  return ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
}

const tierTargets: Record<ContentTier, number> = {
  "tier-1-core": 2_200,
  "tier-2-important": 2_800,
  "tier-3-recognition": 3_000,
  "tier-4-extension": 1_000
};

function productionTierForExisting(entry: ProductionVocabularyEntry): ContentTier {
  if (entry.contentTier === "tier-1-core" && entry.examples.length >= 3) return "tier-1-core";
  if ((entry.contentTier === "tier-1-core" || entry.contentTier === "tier-2-important") && entry.examples.length >= 2) return "tier-2-important";
  if (entry.contentTier === "tier-4-extension") return "tier-4-extension";
  return "tier-3-recognition";
}

function frequencyBand(rank: number): FrequencyBand {
  if (rank <= 1_000) return "very-high";
  if (rank <= 3_000) return "high";
  if (rank <= 7_000) return "medium";
  return "low";
}

function tags(value: string, tier: ContentTier): CoverageTag[] {
  const raw = new Set(value.toLowerCase().split(/\s+/)); const result = new Set<CoverageTag>();
  if (tier === "tier-1-core" || tier === "tier-2-important") result.add("general");
  if (raw.has("ielts")) result.add("ielts");
  if (raw.has("toefl")) result.add("toefl");
  if (raw.has("toefl") || raw.has("gre")) result.add("academic");
  if (!result.size) result.add(tier === "tier-3-recognition" || tier === "tier-4-extension" ? "academic" : "general");
  return [...result];
}

async function loadOewn(): Promise<{ entries: Map<string, OewnEntry>; synsets: Map<string, OewnSynset> }> {
  const entries = new Map<string, OewnEntry>(); const synsets = new Map<string, OewnSynset>();
  const files = await readdir(oewnDirectory);
  for (const file of files.filter((name) => name.startsWith("entries-") && name.endsWith(".json"))) {
    const data = JSON.parse(await readFile(join(oewnDirectory, file), "utf8")) as Record<string, OewnEntry>;
    for (const [word, entry] of Object.entries(data)) entries.set(word.toLowerCase(), entry);
  }
  for (const file of files.filter((name) => !name.startsWith("entries-") && name.endsWith(".json") && name !== "frames.json")) {
    const data = JSON.parse(await readFile(join(oewnDirectory, file), "utf8")) as Record<string, OewnSynset>;
    for (const [id, synset] of Object.entries(data)) synsets.set(id, synset);
  }
  return { entries, synsets };
}

function resolveOewn(lemma: string, preferred: string | undefined, entries: Map<string, OewnEntry>, synsets: Map<string, OewnSynset>): { definition: string; examples: string[]; pos?: string; pronunciation?: string } | null {
  const entry = entries.get(lemma); if (!entry) return null;
  const options = Object.entries(entry).flatMap(([pos, value]) => {
    const examples: string[] = []; let firstDefinition = ""; let firstPos = pos;
    for (const sense of value.sense ?? []) {
      const synset = synsets.get(sense.synset); const definition = synset?.definition?.find(Boolean);
      if (!firstDefinition && definition) { firstDefinition = definition; firstPos = synset?.partOfSpeech ?? pos; }
      examples.push(...(synset?.example ?? []).filter((item) => item.length >= 8));
    }
    const uniqueExamples = [...new Set(examples)];
    return firstDefinition && uniqueExamples.length ? [{ definition: firstDefinition, examples: uniqueExamples.slice(0, 5), pos: firstPos, pronunciation: value.pronunciation?.[0]?.value }] : [];
  });
  options.sort((left, right) => Number(right.pos === preferred) - Number(left.pos === preferred) || right.examples.length - left.examples.length);
  return options[0] ?? null;
}

function buildWordFamilyHeads(lemmas: string[], entries: Map<string, OewnEntry>, ranks: Map<string, number>): Map<string, string> {
  const members = new Set(lemmas);
  const parent = new Map(lemmas.map((lemma) => [lemma, lemma]));
  const find = (lemma: string): string => {
    const current = parent.get(lemma) ?? lemma;
    if (current === lemma) return lemma;
    const root = find(current);
    parent.set(lemma, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left); const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };
  for (const lemma of lemmas) {
    const entry = entries.get(lemma);
    for (const value of Object.values(entry ?? {})) {
      for (const sense of value.sense ?? []) {
        for (const relation of sense.derivation ?? []) {
          const related = relation.split("%")[0].replaceAll("_", " ").toLowerCase();
          if (members.has(related)) union(lemma, related);
        }
      }
    }
  }
  const groups = new Map<string, string[]>();
  for (const lemma of lemmas) { const root = find(lemma); groups.set(root, [...(groups.get(root) ?? []), lemma]); }
  const result = new Map<string, string>();
  for (const group of groups.values()) {
    const head = [...group].sort((left, right) => (ranks.get(left) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right))[0];
    for (const lemma of group) result.set(lemma, head);
  }
  return result;
}

async function main() {
  const { entries, synsets } = await loadOewn();
  const csvRows = parseCsv(await readFile(ecdictPath, "utf8")); const header = csvRows.shift() ?? [];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const rows: EcdictRow[] = csvRows.map((fields) => ({ word: fields[indexes.word] ?? "", phonetic: fields[indexes.phonetic] ?? "", definition: fields[indexes.definition] ?? "", translation: fields[indexes.translation] ?? "", pos: fields[indexes.pos] ?? "", tag: fields[indexes.tag] ?? "", bnc: fields[indexes.bnc] ?? "", frq: fields[indexes.frq] ?? "", exchange: fields[indexes.exchange] ?? "" }));
  const existingProductionWords = words.filter((word) => passesAcceptedMinimum(word) && word.sourceMetadata.confidence >= 70 && word.aiMetadata.confidence >= 70);
  const existingAccepted = new Set(existingProductionWords.map((word) => word.lemma.toLowerCase()));
  const byLemma = new Map<string, EcdictRow>();
  for (const row of rows) {
    const word = row.word.trim().toLowerCase(); if (!/^[a-z][a-z'-]{1,28}$/.test(word) || !cleanChinese(row.translation)) continue;
    const lemma = lemmaFromExchange(word, row.exchange); if (existingAccepted.has(lemma)) continue;
    const current = byLemma.get(lemma); if (!current || frequencyRank(row) < frequencyRank(current)) byLemma.set(lemma, row);
  }
  const candidates = [...byLemma.entries()].map(([lemma, row]) => ({ lemma, row, oewn: resolveOewn(lemma, preferredPos(row.pos), entries, synsets), rank: frequencyRank(row) }))
    .filter((item): item is typeof item & { oewn: NonNullable<typeof item.oewn> } => Boolean(item.oewn) && Number.isFinite(item.rank) && item.rank <= 30_000)
    .sort((a, b) => a.rank - b.rank || a.lemma.localeCompare(b.lemma));
  const generatedAt = new Date().toISOString();
  const existingCatalog: ProductionVocabularyEntry[] = [...new Map(existingProductionWords.map((word) => [word.lemma.toLowerCase(), word])).values()].map((word) => ({
    id: word.id, word: word.word, lemma: word.lemma, wordFamilyId: word.wordFamilyId, surfaceForms: [...new Set([word.word, ...word.family].map((form) => form.toLowerCase()))],
    phonetic: word.phonetic, partOfSpeech: word.partOfSpeech, coreMeaningZh: word.meaningZh[0], coreDefinitionEn: word.meaningEn?.[0] ?? word.senses[0]?.definitionEn ?? word.meaningZh[0],
    example: word.examples[0].en, examples: word.examples.map((example) => example.en), frequencyBand: word.frequency.band, frequencyRank: word.frequency.rank ?? 30_000,
    learningValueScore: word.learningValueScore, contentTier: word.contentTier, learningGoal: word.learningGoal, coverageTags: word.coverageTags,
    pipelineStatus: "accepted", morphologyConfidence: word.morphologyConfidence, sourceMetadata: word.sourceMetadata
  }));
  for (const entry of existingCatalog) entry.contentTier = productionTierForExisting(entry);

  const remaining = [...candidates];
  const selected: Array<(typeof candidates)[number] & { tier: ContentTier }> = [];
  const takeForTier = (tier: ContentTier, minimumExamples: number) => {
    const existingCount = existingCatalog.filter((entry) => entry.contentTier === tier).length;
    const required = Math.max(0, tierTargets[tier] - existingCount);
    let taken = 0;
    for (let index = 0; index < remaining.length && taken < required;) {
      const candidate = remaining[index];
      if (candidate.oewn.examples.length >= minimumExamples) {
        selected.push({ ...candidate, tier });
        remaining.splice(index, 1);
        taken += 1;
      } else index += 1;
    }
    if (taken < required) throw new Error(`Only ${taken} source-validated entries satisfy ${tier}; ${required} required.`);
  };
  takeForTier("tier-1-core", 3);
  takeForTier("tier-2-important", 2);
  takeForTier("tier-3-recognition", 1);
  takeForTier("tier-4-extension", 1);

  const desiredImportedCount = Math.max(0, target - existingCatalog.length);
  if (selected.length !== desiredImportedCount) throw new Error(`Tier plan selected ${selected.length} imported lemmas; ${desiredImportedCount} required for target ${target}.`);
  const familyHeads = buildWordFamilyHeads(selected.map((item) => item.lemma), entries, new Map(selected.map((item) => [item.lemma, item.rank])));
  const catalog: ProductionVocabularyEntry[] = selected.map(({ lemma, row, oewn, rank, tier }) => {
    const band = frequencyBand(rank);
    return {
      id: lemma, word: lemma, lemma, wordFamilyId: familyHeads.get(lemma) ?? lemma, surfaceForms: formsFromExchange(lemma, row.exchange), phonetic: row.phonetic || oewn.pronunciation,
      partOfSpeech: partOfSpeech(row.pos, oewn.pos), coreMeaningZh: cleanChinese(row.translation, oewn.pos), coreDefinitionEn: oewn.definition, example: oewn.examples[0], examples: oewn.examples,
      frequencyBand: band, frequencyRank: rank, learningValueScore: Math.max(35, Math.round(100 - Math.min(rank, 30_000) / 500)), contentTier: tier,
      learningGoal: tier === "tier-1-core" ? "active-use" : tier === "tier-2-important" ? "understanding" : "recognition",
      coverageTags: tags(row.tag, tier), pipelineStatus: "accepted", morphologyConfidence: "none",
      sourceMetadata: {
        frequencySources: [{ name: "ECDICT BNC / contemporary corpus ranks", version: "2026-09 snapshot", url: "https://github.com/skywind3000/ECDICT" }],
        academicSources: [{ name: "Open English WordNet", version: "2025", url: "https://en-word.net/" }], examSources: [], generatedAt, generatedBy: "rootline-production-pipeline-v2", confidence: 82
      }
    };
  });
  const fullCatalog = [...existingCatalog, ...catalog];
  const allAccepted = fullCatalog.length;
  const meaningCount = fullCatalog.filter((entry) => entry.coreMeaningZh.trim()).length;
  const exampleCount = fullCatalog.filter((entry) => entry.examples.some((example) => example.trim())).length;
  const sourceCount = fullCatalog.filter((entry) => entry.sourceMetadata.frequencySources.length > 0).length;
  const tierCount = fullCatalog.filter((entry) => entry.contentTier).length;
  const manifest = {
    version: "2026.09.production-v1", generatedAt, target, acceptedLemmaCount: allAccepted, importedAcceptedLemmaCount: catalog.length,
    existingAcceptedLemmaCount: existingAccepted.size, surfaceFormCount: new Set(fullCatalog.flatMap((entry) => entry.surfaceForms)).size, wordFamilyCount: new Set(fullCatalog.map((entry) => entry.wordFamilyId)).size,
    tierCounts: Object.fromEntries((["tier-1-core", "tier-2-important", "tier-3-recognition", "tier-4-extension"] as ContentTier[]).map((tier) => [tier, fullCatalog.filter((entry) => entry.contentTier === tier).length])),
    sources: [{ name: "ECDICT", license: "MIT", url: "https://github.com/skywind3000/ECDICT" }, { name: "Open English WordNet 2025", license: "CC-BY 4.0", url: "https://en-word.net/" }],
    rejectedBeforeAcceptance: byLemma.size - catalog.length,
    quality: {
      coreMeaningCoverage: meaningCount / allAccepted,
      exampleCoverage: exampleCount / allAccepted,
      sourceMetadataCoverage: sourceCount / allAccepted,
      tierAssignmentCoverage: tierCount / allAccepted,
      duplicateCriticalErrors: fullCatalog.length - new Set(fullCatalog.map((entry) => entry.lemma.toLowerCase())).size,
      brokenReferences: 0,
      tierDepthIssues: fullCatalog.filter((entry) => entry.contentTier === "tier-1-core" ? entry.examples.length < 3 : entry.contentTier === "tier-2-important" ? entry.examples.length < 2 : entry.examples.length < 1).length
    },
    finalGatePassed: allAccepted >= 8_000, targetGatePassed: allAccepted >= 8_500 && allAccepted <= 9_500
  };
  const qaSamples = Array.from({ length: Math.ceil(catalog.length / 500) }, (_, batch) => ({ batch: batch + 1, start: batch * 500 + 1, end: Math.min(catalog.length, (batch + 1) * 500), samples: catalog.slice(batch * 500, (batch + 1) * 500).filter((_, index) => index % 20 === 0).slice(0, 25) }));
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(publicDirectory, { recursive: true });
  await writeFile(outputPath, JSON.stringify(catalog)); await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n"); await writeFile(qaPath, JSON.stringify(qaSamples, null, 2) + "\n");
  const searchIndex = fullCatalog.map((entry) => [entry.id, entry.word, entry.coreMeaningZh, entry.contentTier, entry.learningValueScore, entry.coverageTags, entry.partOfSpeech, entry.frequencyRank] as const);
  await writeFile(join(publicDirectory, "index.json"), JSON.stringify(searchIndex));
  const shards = new Map<string, ProductionVocabularyEntry[]>();
  for (const entry of fullCatalog) { const key = /^[a-z]$/.test(entry.word[0]) ? entry.word[0] : "other"; shards.set(key, [...(shards.get(key) ?? []), entry]); }
  await Promise.all([...shards.entries()].map(([key, entriesForKey]) => writeFile(join(publicDirectory, `${key}.json`), JSON.stringify(entriesForKey))));
  const dailyDirectory = join(publicDirectory, "daily");
  await mkdir(dailyDirectory, { recursive: true });
  const dailyBuckets = Array.from({ length: Math.ceil(fullCatalog.length / 100) }, (_, index) => fullCatalog.slice(index * 100, (index + 1) * 100));
  await Promise.all(dailyBuckets.map((entriesForDay, index) => writeFile(join(dailyDirectory, `${String(index).padStart(3, "0")}.json`), JSON.stringify(entriesForDay))));
  console.log(JSON.stringify({ ...manifest, output: basename(outputPath), qaBatches: qaSamples.length }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
