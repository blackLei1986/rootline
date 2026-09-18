import { roots } from "@/data/roots";
import { words } from "@/data/words";
import { isDueForReview } from "@/lib/spaced-repetition";
import { enhancedReviewPriorityScore } from "@/lib/progress-calculation";
import { buildRecoveryPlan } from "@/lib/recovery-mode";
import { getRecommendedWords } from "@/lib/course-engine";
import { recommendNextRoot } from "@/lib/root-recommender";
import type { LearningStorage, WordProgress } from "@/types/progress";
import type { QuizMode } from "@/types/quiz";
import type { LearningSession, LearningSessionItem } from "@/types/session";

export interface BuildSessionOptions {
  storage: LearningStorage;
  now?: Date;
  maxNewWords?: number;
  maxReviewWords?: number;
  random?: () => number;
}

const quizModes: QuizMode[] = [
  "word-to-meaning",
  "meaning-to-word",
  "morphology-to-word",
  "word-to-root"
];

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function selectActiveRootId(storage: LearningStorage): string {
  return recommendNextRoot(storage)?.id ?? roots[0].id;
}

function selectReviewWords(
  storage: LearningStorage,
  now: Date,
  limit: number
): string[] {
  const progressEntries = Object.values(storage.words);
  const due = progressEntries.filter((item) => isDueForReview(item, now));
  const recentWrong = progressEntries.filter(
    (item) => item.lastRating === "again" && !due.some((dueItem) => dueItem.wordId === item.wordId)
  );
  const learning = progressEntries.filter(
    (item) => item.status === "learning" &&
      !due.some((dueItem) => dueItem.wordId === item.wordId) &&
      !recentWrong.some((wrongItem) => wrongItem.wordId === item.wordId)
  );
  const maintenance = progressEntries
    .filter((item) => item.status === "mastered" && !due.some((dueItem) => dueItem.wordId === item.wordId))
    .slice(0, 2);

  const byPriority = (items: WordProgress[]) =>
    [...items].sort((a, b) => enhancedReviewPriorityScore(b, words.find((word) => word.id === b.wordId), now) - enhancedReviewPriorityScore(a, words.find((word) => word.id === a.wordId), now));

  return [
    ...byPriority(due),
    ...byPriority(recentWrong),
    ...byPriority(learning),
    ...byPriority(maintenance)
  ]
    .filter((progress) => words.some((word) => word.id === progress.wordId))
    .slice(0, limit)
    .map((progress) => progress.wordId);
}

function createCoreItems(rootId: string, newWordIds: string[]): LearningSessionItem[] {
  const items: LearningSessionItem[] = [
    { id: `root-intro-${rootId}`, type: "root", stage: "root-intro", rootId },
    { id: `root-recall-${rootId}`, type: "root", stage: "root-recall", rootId, mode: "root-to-meaning" }
  ];
  for (const [index, wordId] of newWordIds.entries()) {
    items.push(
      { id: `word-intro-${wordId}`, type: "word", stage: "word-intro", rootId, wordId },
      {
        id: `word-recall-${wordId}`,
        type: "quiz",
        stage: "word-recall",
        rootId,
        wordId,
        mode: quizModes[index % quizModes.length]
      }
    );
  }
  return items;
}

export function buildTodaySession({
  storage,
  now = new Date(),
  maxNewWords = 5,
  maxReviewWords = 15,
  random = Math.random
}: BuildSessionOptions): LearningSession {
  const rootId = selectActiveRootId(storage);
  const recovery = buildRecoveryPlan(storage, now);
  const reviewWordIds = recovery.active
    ? recovery.wordIds.slice(0, maxReviewWords)
    : selectReviewWords(storage, now, maxReviewWords);
  const newWordIds = getRecommendedWords(rootId, storage, maxNewWords).map((word) => word.id);
  const coreItems = createCoreItems(rootId, newWordIds);
  const mixedWordIds = shuffle(
    [...new Set([...reviewWordIds, ...newWordIds])],
    random
  ).slice(0, Math.max(8, maxNewWords + Math.min(8, reviewWordIds.length)));
  const mixedItems: LearningSessionItem[] = mixedWordIds.map((wordId, index) => {
    const word = words.find((candidate) => candidate.id === wordId);
    const hasRoot = Boolean(word?.rootIds[0]);
    const rootlessModes = ["word-to-meaning", "meaning-to-word", "morphology-to-word"] as const;
    return {
      id: `mixed-${wordId}-${index}`,
      type: "quiz",
      stage: "mixed-quiz",
      rootId: word?.rootIds[0],
      wordId,
      mode: hasRoot ? quizModes[index % quizModes.length] : rootlessModes[index % rootlessModes.length]
    };
  });

  return {
    id: `session-${now.getTime()}`,
    startedAt: now.toISOString(),
    rootIds: [rootId],
    newWordIds,
    reviewWordIds,
    items: [...coreItems, ...mixedItems],
    currentIndex: 0,
    answers: [],
    reinforcementCounts: {},
    rootMasteryBefore: { [rootId]: storage.roots[rootId]?.mastery ?? 0 }
  };
}

export function getDueWordIds(
  storage: LearningStorage,
  now: Date = new Date()
): string[] {
  return Object.values(storage.words)
    .filter((progress: WordProgress) => isDueForReview(progress, now))
    .sort((a, b) => enhancedReviewPriorityScore(b, words.find((word) => word.id === b.wordId), now) - enhancedReviewPriorityScore(a, words.find((word) => word.id === a.wordId), now))
    .map((progress) => progress.wordId);
}
