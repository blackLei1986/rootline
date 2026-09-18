import { getRootById } from "@/data/roots";
import { getWordById } from "@/data/words";
import { generateQuiz } from "@/lib/quiz-generator";
import type { LearningStorage } from "@/types/progress";
import type { QuizMode, QuizQuestion } from "@/types/quiz";

export type PracticeItem = QuizQuestion & { sourceWordId: string };

const modes: QuizMode[] = [
  "word-to-meaning",
  "meaning-to-word",
  "morphology-to-word",
  "word-to-root",
  "root-to-meaning"
];

export function buildPracticeQueue(
  wordIds: string[],
  storage: LearningStorage,
  now: Date = new Date()
): PracticeItem[] {
  const ordered = [...wordIds].sort((a, b) => {
    const aReview = storage.words[a]?.nextReviewAt;
    const bReview = storage.words[b]?.nextReviewAt;
    const aDue = aReview ? new Date(aReview).getTime() <= now.getTime() : false;
    const bDue = bReview ? new Date(bReview).getTime() <= now.getTime() : false;
    return Number(bDue) - Number(aDue);
  });
  if (!ordered.length) return [];

  return Array.from({ length: Math.min(10, Math.max(5, ordered.length)) }, (_, index) => {
    const wordId = ordered[index % ordered.length];
    const word = getWordById(wordId);
    const root = word ? getRootById(word.rootIds[0]) : undefined;
    if (!word) throw new Error(`Cannot build a quiz for unknown word ${wordId}.`);
    const mode = root ? modes[index % modes.length] : (["word-to-meaning", "meaning-to-word", "morphology-to-word"] as const)[index % 3];
    const question = generateQuiz({ word, root, mode });
    return {
      ...question,
      id: `${question.id}-practice-${index}`,
      wordId,
      sourceWordId: wordId
    };
  });
}

export function insertPracticeReinforcement(
  queue: PracticeItem[],
  currentIndex: number,
  repeatCount: number,
  random: () => number = Math.random
): PracticeItem[] {
  if (repeatCount >= 3) return queue;
  const current = queue[currentIndex];
  if (!current) return queue;
  const gap = 2 + Math.floor(random() * 4);
  const insertionIndex = Math.min(queue.length, currentIndex + 1 + gap);
  const next = [...queue];
  next.splice(insertionIndex, 0, {
    ...current,
    id: `${current.id}-repeat-${repeatCount + 1}`
  });
  return next;
}
