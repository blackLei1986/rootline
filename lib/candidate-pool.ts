import { words as defaultWords } from "@/data/words";
import type { Word } from "@/types";
import type { LearningGoal, LearningStorage, RecognitionState, WordProgress } from "@/types/progress";

export interface CandidatePoolItem {
  word: Word;
  score: number;
  knowledgeGapScore: number;
  pathRelevance: number;
  reasons: string[];
}

export interface BuildCandidatePoolInput {
  storage: LearningStorage;
  goal?: LearningGoal;
  catalog?: Word[];
  limit?: number;
  excludeWordIds?: Iterable<string>;
}

const bandRank = {
  "core-1000": 1,
  "core-2000": 2,
  "core-3000": 3,
  "core-5000": 4,
  academic: 5,
  advanced: 6
} as const;

const stateGap: Record<RecognitionState, number> = {
  known: 0.1,
  fuzzy: 0.6,
  unknown: 1
};

export function calculateKnowledgeGap(progress?: WordProgress): number {
  if (!progress?.recognitionState) return 0.9;
  const base = stateGap[progress.recognitionState];
  const accuracyAttempts = progress.correctCount + progress.wrongCount;
  const accuracy = accuracyAttempts ? progress.correctCount / accuracyAttempts : 0.5;
  const performanceGap = 1 - accuracy;
  const memoryGap = 1 - progress.memoryStrength / 100;
  return Math.max(0.05, Math.min(1, base * 0.65 + performanceGap * 0.2 + memoryGap * 0.15));
}

export function calculatePathRelevance(word: Word, goal: LearningGoal): number {
  if (goal.path === "ielts-toefl") {
    const inIelts = word.coverageTags.includes("ielts");
    const inToefl = word.coverageTags.includes("toefl");
    if (inIelts && inToefl) return 1;
    if (inIelts || inToefl) return 0.78;
    return Math.max(word.examRelevance.ielts, word.examRelevance.toefl) / 200 + 0.25;
  }
  const relevance = word.examRelevance[goal.path];
  return word.coverageTags.includes(goal.path) ? Math.max(0.75, relevance / 100) : Math.max(0.25, relevance / 125);
}

function bandRelevance(word: Word, goal: LearningGoal): number {
  if (goal.vocabularyBand === "academic") return word.vocabularyBand === "academic" ? 1 : word.coverageTags.includes("academic") ? 0.88 : 0.55;
  const distance = Math.abs(bandRank[word.vocabularyBand] - bandRank[goal.vocabularyBand]);
  return Math.max(0.45, 1 - distance * 0.14);
}

export function buildCandidatePool({
  storage,
  goal = storage.settings.learningGoal,
  catalog = defaultWords,
  limit = 100,
  excludeWordIds = []
}: BuildCandidatePoolInput): CandidatePoolItem[] {
  const excluded = new Set(excludeWordIds);
  return catalog
    .filter((word) => !excluded.has(word.id))
    .map((word) => {
      const progress = storage.words[word.id];
      const gap = calculateKnowledgeGap(progress);
      const path = calculatePathRelevance(word, goal);
      const band = bandRelevance(word, goal);
      const unseenBoost = progress?.lastRecognizedAt || progress?.firstLearnedAt ? 1 : 1.12;
      const verifiedKnownPenalty = progress?.recognitionState === "known" && progress.verificationCorrectCount > 0 ? 0.45 : 1;
      const score = Math.round(word.learningValueScore * gap * path * band * unseenBoost * verifiedKnownPenalty * 100) / 100;
      const reasons = [
        !progress?.lastRecognizedAt ? "unseen" : progress.recognitionState ?? "seen",
        word.learningValueScore >= 72 ? "high-learning-value" : "standard-learning-value",
        path >= 0.9 ? "strong-path-match" : "path-match"
      ];
      return { word, score, knowledgeGapScore: gap, pathRelevance: path, reasons };
    })
    .sort((a, b) => b.score - a.score || b.word.learningValueScore - a.word.learningValueScore || a.word.id.localeCompare(b.word.id))
    .slice(0, Math.max(0, limit));
}
