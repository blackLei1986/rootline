/**
 * Root learning mode & word-family expansion (v1).
 *
 * Pure, deterministic logic for the root-learning feature set:
 *
 *   1. Root priority          — combine static value + personal progress + due.
 *   2. Today's root picks     — a small, ranked set (never the whole library).
 *   3. 4-stage study flow     — recognise -> decompose -> expand -> test.
 *   4. Inference challenge    — guess an unseen word's meaning from its root.
 *   5. Adaptive question type — pick the weakest skill to practice next.
 *   6. Root Challenge         — a small daily set of unseen words (deterministic).
 *   7. Rewards                — mastered roots / unlocked words (no currency).
 *
 * No React, no I/O: every function takes plain inputs and returns plain data,
 * so it is trivially unit-testable.
 */

import { roots as allRoots, getRootById } from "@/data/roots";
import { getWordsByRoot, words } from "@/data/words";
import type { Root, Word } from "@/types";
import type { LearningStorage, RootProgress } from "@/types/progress";

// ---------------------------------------------------------------------------
// 4-stage study flow
// ---------------------------------------------------------------------------

export type RootStudyStage = 1 | 2 | 3 | 4;

export interface RootStageDefinition {
  id: RootStudyStage;
  key: "recognise" | "decompose" | "expand" | "test";
  title: string;
  description: string;
  goal: string;
}

export const ROOT_STAGES: RootStageDefinition[] = [
  { id: 1, key: "recognise", title: "认识词根", description: "记住核心含义、来源与记忆提示。", goal: "能说出词根是什么意思" },
  { id: 2, key: "decompose", title: "构词拆解", description: "把单词拆成前缀 + 词根 + 后缀。", goal: "能识别单词里的词根和词缀" },
  { id: 3, key: "expand", title: "词族扩展", description: "认识 3–5 个由该词根构成的高频词。", goal: "记住词族中的核心词" },
  { id: 4, key: "test", title: "主动测试", description: "用识别、拆解、推断检验掌握程度。", goal: "稳定掌握词根与词族" },
] as const;

export function getRootStage(progress: RootProgress | undefined): RootStudyStage {
  const last = progress?.lastStage ?? 0;
  return (Math.min(4, Math.max(1, last + 1)) as RootStudyStage);
}

/** Advance to the next stage; caps at stage 4. */
export function advanceStage(progress: RootProgress | undefined, now: Date = new Date()): { lastStage: RootStudyStage; lastReviewedAt: string } {
  const current = progress?.lastStage ?? 0;
  return {
    lastStage: Math.min(4, current + 1) as RootStudyStage,
    lastReviewedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Root priority & today's picks
// ---------------------------------------------------------------------------

export interface RootPriorityInput {
  root: Root;
  progress: RootProgress | undefined;
  now?: Date;
}

/**
 * A root's learning priority. The model multiplies static value by a state
 * factor, so the ranking is interpretable:
 *
 *   overdue review  >  new root  >  in-progress (not yet due)  >  mastered
 *
 * - new root          : base value + a small course-position bonus.
 * - overdue review    : value × 1.2 + overdue + mastery-gap bonus (queue-jump).
 * - in-progress (due) : value × 0.6 + mastery-gap (waiting for its date).
 * - mastered          : value × 0.2 (sinks to the bottom, still returns later).
 */
export function calculateRootPriority({ root, progress, now = new Date() }: RootPriorityInput): number {
  const base = root.rootValueScore ?? 50;
  const mastery = progress?.mastery ?? 0;
  const status = progress?.status ?? "new";

  if (!progress || status === "new") {
    // earlier course position (smaller `priority`) gets a mild bump
    const pathBonus = Math.max(0, 24 - root.priority * 1.2);
    return round(base + pathBonus * 0.5);
  }

  if (status === "mastered" || mastery >= 70) {
    return round(base * 0.2);
  }

  const overdueHours = progress.nextReviewAt
    ? Math.max(0, (now.getTime() - new Date(progress.nextReviewAt).getTime()) / 3_600_000)
    : 24;
  const overdue = overdueHours > 0;
  const overdueScore = Math.min(30, overdueHours / 4);
  const needScore = (100 - mastery) * 0.2;
  const stateFactor = overdue ? 1.2 : 0.6;
  return round(base * stateFactor + overdueScore + needScore);
}

/** Rank roots by priority and return a small set for the homepage. */
export function recommendTodayRoots(
  storage: LearningStorage,
  limit = 3,
  now: Date = new Date()
): Root[] {
  const rootsList = requireRoots();
  return rootsList
    .map((root) => ({ root, score: calculateRootPriority({ root, progress: storage.roots[root.id], now }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.root);
}

// ---------------------------------------------------------------------------
// Inference challenge
// ---------------------------------------------------------------------------

export interface InferenceChallenge {
  wordId: string;
  word: string;
  root: string;
  rootMeaningZh: string[];
  affixHints: string[];
  choices: string[];      // 4 Chinese meanings (1 correct + 3 distractors)
  correctIndex: number;
}

/**
 * Build an inference challenge: pick an unseen word that shares the root and
 * ask the learner to guess its meaning from the root + affix hints.
 * `excludeIds` removes words already attempted in the current session.
 */
export function buildInferenceChallenge(
  rootId: string,
  storage: LearningStorage,
  excludeIds: ReadonlySet<string> = new Set()
): InferenceChallenge | null {
  const root = requireRoot(rootId);
  const family = getWordsByRoot(rootId);
  const unseen = family.filter(
    (word) => !storage.words[word.id]?.firstLearnedAt && !excludeIds.has(word.id)
  );
  if (unseen.length === 0) return null;

  // Prefer core/extension words (more inferable) over advanced.
  const tier = { core: 0, extension: 1, advanced: 2 } as const;
  const target = [...unseen].sort(
    (a, b) => tier[a.rootTier] - tier[b.rootTier] || a.learningValueScore - b.learningValueScore
  )[0];

  const affixHints = [
    target.prefix ? `前缀 ${target.prefix.form}：${target.prefix.meaning}` : null,
    target.suffix ? `后缀 ${target.suffix.form}：${target.suffix.meaning}` : null,
  ].filter((hint): hint is string => Boolean(hint));

  const choices = buildMeaningChoices(target);
  const correctIndex = choices.indexOf(target.meaningZh[0]);

  return {
    wordId: target.id,
    word: target.word,
    root: root.root,
    rootMeaningZh: root.meaningZh,
    affixHints,
    choices,
    correctIndex,
  };
}

function buildMeaningChoices(target: Word): string[] {
  const correct = target.meaningZh[0];
  const distractors = words
    .filter((word) => word.id !== target.id && word.meaningZh[0] !== correct)
    .map((word) => word.meaningZh[0]);
  const seen = new Set<string>([correct]);
  const picked: string[] = [];
  for (const meaning of distractors) {
    if (seen.has(meaning)) continue;
    seen.add(meaning);
    picked.push(meaning);
    if (picked.length >= 3) break;
  }
  // Deterministic ordering (locale sort) so tests are stable.
  return [correct, ...picked].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

export type InferenceOutcome = "correct" | "wrong";

/** Return the updated inference stats for a RootProgress. */
export function scoreInference(
  progress: RootProgress | undefined,
  outcome: InferenceOutcome,
  fallback: RootProgress
): {
  inferenceScore: number;
  inferenceAttempts: number;
  inferenceCorrect: number;
  wordsSeen: number;
} {
  const base = progress ?? fallback;
  const attempts = base.inferenceAttempts + 1;
  const correct = base.inferenceCorrect + (outcome === "correct" ? 1 : 0);
  const inferenceScore = Math.round((correct / attempts) * 100);
  return { inferenceScore, inferenceAttempts: attempts, inferenceCorrect: correct, wordsSeen: base.wordsSeen + 1 };
}

// ---------------------------------------------------------------------------
// Adaptive question type
// ---------------------------------------------------------------------------

export type RootQuestionType = "recognition" | "derivation" | "inference";

/**
 * Practice the weakest skill: returns the skill with the lowest score.
 * Ties break in a fixed order (recognition -> derivation -> inference).
 */
export function selectRootQuestionType(progress: RootProgress | undefined): RootQuestionType {
  const recognition = progress?.recognitionScore ?? 0;
  const derivation = progress?.derivationScore ?? 0;
  const inference = progress?.inferenceScore ?? 0;
  if (recognition <= derivation && recognition <= inference) return "recognition";
  if (derivation <= inference) return "derivation";
  return "inference";
}

// ---------------------------------------------------------------------------
// Root Challenge (daily unseen words)
// ---------------------------------------------------------------------------

export interface RootChallengeItem {
  wordId: string;
  word: string;
  meaningZh: string;
  root: string;
  rootMeaningZh: string[];
  literalMeaning: string;
}

/**
 * A small daily set of unseen words. Deterministic for a given date, so the
 * same day always yields the same challenge (avoids re-rolling on refresh).
 */
export function buildRootChallenge(
  storage: LearningStorage,
  now: Date = new Date(),
  count = 4
): RootChallengeItem[] {
  const dateSeed = dateKey(now);
  const unseen = words.filter((word) => !storage.words[word.id]?.firstLearnedAt);

  // Deterministic shuffle keyed by date + word id.
  const seeded = unseen
    .map((word) => ({ word, hash: hashString(`${dateSeed}:${word.id}`) }))
    .sort((a, b) => a.hash - b.hash);

  return seeded.slice(0, count).map(({ word }) => {
    const root = requireRoot(word.rootIds[0] ?? "spect");
    return {
      wordId: word.id,
      word: word.word,
      meaningZh: word.meaningZh[0],
      root: root.root,
      rootMeaningZh: root.meaningZh,
      literalMeaning: word.literalMeaning,
    };
  });
}

// ---------------------------------------------------------------------------
// Rewards (no currency)
// ---------------------------------------------------------------------------

export interface RootRewards {
  masteredRoots: number;
  learningRoots: number;
  totalRoots: number;
  unlockedWords: number;
  totalWords: number;
}

export function getRootRewards(storage: LearningStorage): RootRewards {
  const rootsList = requireRoots();
  let masteredRoots = 0;
  let learningRoots = 0;
  for (const root of rootsList) {
    const progress = storage.roots[root.id];
    if (progress?.status === "mastered" || (progress?.mastery ?? 0) >= 70) masteredRoots += 1;
    else if (progress && progress.status !== "new") learningRoots += 1;
  }
  const unlockedWords = Object.values(storage.words).filter((item) => item.firstLearnedAt).length;
  return {
    masteredRoots,
    learningRoots,
    totalRoots: rootsList.length,
    unlockedWords,
    totalWords: words.length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireRoots(): Root[] {
  return allRoots;
}

function requireRoot(rootId: string): Root {
  const root = getRootById(rootId);
  if (!root) throw new Error(`Unknown root: ${rootId}`);
  return root;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
