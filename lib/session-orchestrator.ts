import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import { getPhrasesByWord, getSentencesByWord } from "@/data/learning-content";
import { getWordById } from "@/data/words";
import { calculateDailyLoad } from "@/lib/adaptive-load";
import { buildCandidatePool } from "@/lib/candidate-pool";
import { explainLearningDepth } from "@/lib/learning-depth";
import { buildRecoveryPlan } from "@/lib/recovery-mode";
import { getDueWordIds, selectActiveRootId } from "@/lib/session-builder";
import type { LearningStorage, SessionLengthMinutes } from "@/types/progress";
import type { LearningSession, LearningSessionItem } from "@/types/session";

interface PlannedItem {
  item: LearningSessionItem;
  priority: number;
  estimatedSeconds: number;
  requiresItemId?: string;
}

export interface BuildOrchestratedSessionOptions {
  storage: LearningStorage;
  now?: Date;
  minutes?: SessionLengthMinutes;
}

export function getNextBestLearningItem(
  candidates: PlannedItem[],
  recentItems: LearningSessionItem[],
  remainingSeconds: number
): PlannedItem | null {
  const completedIds = new Set(recentItems.map((item) => item.id));
  const fitting = candidates.filter((candidate) => candidate.estimatedSeconds <= remainingSeconds && (!candidate.requiresItemId || completedIds.has(candidate.requiresItemId)));
  if (!fitting.length) return null;
  const recentTypes = recentItems.slice(-2).map((item) => item.type);
  const varied = fitting.filter((candidate) => !recentTypes.every((type) => type === candidate.item.type));
  return [...(varied.length ? varied : fitting)].sort((a, b) => b.priority - a.priority || a.estimatedSeconds - b.estimatedSeconds)[0];
}

function itemCost(item: LearningSessionItem): number {
  if (item.type === "quiz" || item.type === "review") return LEARNING_ENGINE_CONFIG.quizSeconds;
  if (item.type === "phrase") return LEARNING_ENGINE_CONFIG.quickCardSeconds;
  if (item.type === "sentence") return 12;
  if (item.type === "root") return item.stage === "root-intro" ? 20 : LEARNING_ENGINE_CONFIG.quizSeconds;
  return item.learningDepth === "deep"
    ? LEARNING_ENGINE_CONFIG.deepCardSeconds
    : item.learningDepth === "standard"
      ? LEARNING_ENGINE_CONFIG.standardCardSeconds
      : LEARNING_ENGINE_CONFIG.quickCardSeconds;
}

function planItems(storage: LearningStorage, now: Date, minutes: SessionLengthMinutes): { items: LearningSessionItem[]; newWordIds: string[]; reviewWordIds: string[]; recoveryMode: boolean; estimatedSeconds: number } {
  const load = calculateDailyLoad(storage, now, minutes);
  const recovery = buildRecoveryPlan(storage, now);
  const reviewWordIds = (recovery.active ? recovery.wordIds : getDueWordIds(storage, now)).slice(0, load.reviewWords);
  const reviewSet = new Set(reviewWordIds);
  const newCandidates = load.newWords > 0
    ? buildCandidatePool({ storage, limit: load.newWords * 3 }).filter((candidate) => !reviewSet.has(candidate.word.id) && !storage.words[candidate.word.id]?.firstLearnedAt).slice(0, load.newWords)
    : [];
  const candidates: PlannedItem[] = [];

  for (const [index, candidate] of newCandidates.entries()) {
    const progress = storage.words[candidate.word.id];
    const recognitionState = progress?.recognitionState ?? "unknown";
    const decision = explainLearningDepth({ word: candidate.word, recognitionState, wordProgress: progress });
    const learningDepth = decision.depth === "skip" ? "quick" : decision.depth;
    const wordItem: LearningSessionItem = {
      id: `adaptive-word-${candidate.word.id}`,
      type: "word",
      stage: "word-intro",
      wordId: candidate.word.id,
      rootId: candidate.word.rootIds[0],
      learningDepth,
      reasonCodes: decision.reasons,
      priority: 100 - index
    };
    candidates.push({ item: wordItem, priority: 100 - index, estimatedSeconds: itemCost(wordItem) });
    const phrase = getPhrasesByWord(candidate.word.id)[0];
    if (phrase && index < load.sentenceCount) {
      const phraseItem: LearningSessionItem = { id: `adaptive-phrase-${candidate.word.id}`, type: "phrase", stage: "phrase-reinforcement", wordId: candidate.word.id, phraseId: phrase.id, priority: 76 - index };
      candidates.push({ item: phraseItem, priority: 76 - index, estimatedSeconds: itemCost(phraseItem), requiresItemId: wordItem.id });
    }
    const sentence = getSentencesByWord(candidate.word.id)[0];
    if (sentence && index < load.sentenceCount) {
      const sentenceItem: LearningSessionItem = { id: `adaptive-sentence-${candidate.word.id}`, type: "sentence", stage: "sentence-reinforcement", wordId: candidate.word.id, sentenceId: sentence.id, priority: 68 - index };
      candidates.push({ item: sentenceItem, priority: 68 - index, estimatedSeconds: itemCost(sentenceItem), requiresItemId: wordItem.id });
    }
    const quizItem: LearningSessionItem = { id: `adaptive-quiz-${candidate.word.id}`, type: "quiz", stage: "word-recall", wordId: candidate.word.id, rootId: candidate.word.rootIds[0], mode: "word-to-meaning", priority: 58 - index };
    candidates.push({ item: quizItem, priority: 58 - index, estimatedSeconds: itemCost(quizItem), requiresItemId: wordItem.id });
  }

  for (const [index, wordId] of reviewWordIds.entries()) {
    const word = getWordById(wordId);
    if (!word) continue;
    const reviewItem: LearningSessionItem = { id: `adaptive-review-${wordId}`, type: "review", stage: "review-recall", wordId, rootId: word.rootIds[0], mode: index % 2 ? "meaning-to-word" : "word-to-meaning", priority: 94 - index };
    candidates.push({ item: reviewItem, priority: 94 - index, estimatedSeconds: itemCost(reviewItem) });
  }

  const items: LearningSessionItem[] = [];
  let remainingSeconds = minutes * 60;
  const pending = [...candidates];
  while (pending.length) {
    const next = getNextBestLearningItem(pending, items, remainingSeconds);
    if (!next) break;
    const index = pending.indexOf(next);
    pending.splice(index, 1);
    items.push({ ...next.item, estimatedSeconds: next.estimatedSeconds });
    remainingSeconds -= next.estimatedSeconds;
  }
  const estimatedSeconds = minutes * 60 - remainingSeconds;
  const selectedNewWordIds = items.filter((item) => item.stage === "word-intro" && item.wordId).map((item) => item.wordId!);
  const selectedReviewWordIds = items.filter((item) => item.stage === "review-recall" && item.wordId).map((item) => item.wordId!);
  return { items, newWordIds: selectedNewWordIds, reviewWordIds: selectedReviewWordIds, recoveryMode: load.recoveryMode, estimatedSeconds };
}

export function buildOrchestratedSession({
  storage,
  now = new Date(),
  minutes = storage.settings.learningGoal.sessionMinutes
}: BuildOrchestratedSessionOptions): LearningSession {
  const rootId = selectActiveRootId(storage);
  const plan = planItems(storage, now, minutes);
  return {
    id: `adaptive-session-${now.getTime()}`,
    startedAt: now.toISOString(),
    rootIds: [rootId],
    newWordIds: plan.newWordIds,
    reviewWordIds: plan.reviewWordIds,
    items: plan.items,
    currentIndex: 0,
    answers: [],
    reinforcementCounts: {},
    rootMasteryBefore: { [rootId]: storage.roots[rootId]?.mastery ?? 0 },
    timeBudgetMinutes: minutes,
    estimatedSeconds: plan.estimatedSeconds,
    recoveryMode: plan.recoveryMode
  };
}
