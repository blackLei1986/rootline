import { scheduleNextReview } from "@/lib/spaced-repetition";
import type { FrozenQuestion } from "@/lib/reading/reinforcement/types";
import type { ReviewRating, WordProgress } from "@/types/progress";

export function applyReadingResult(
  current: WordProgress, question: FrozenQuestion, correct: boolean, now: Date
): {
  nextState: WordProgress;
  eventType: "quiz_correct" | "quiz_wrong";
  metadata: Record<string, string | number | boolean>;
} {
  const mode = `reading-${question.type}`;
  const eventType = correct ? "quiz_correct" : "quiz_wrong";
  const readingRevision = (current.readingRevision ?? 0) + 1;
  if (question.type === "recognition") {
    return {
      nextState: {
        ...current, readingRevision,
        recognitionState: correct ? "known" : "unknown",
        recognitionCount: current.recognitionCount + 1,
        knownCount: current.knownCount + (correct ? 1 : 0),
        unknownCount: current.unknownCount + (correct ? 0 : 1),
        wrongCount: current.wrongCount + (correct ? 0 : 1),
        lastRecognizedAt: now.toISOString(),
        encounters: {...current.encounters, totalCount: current.encounters.totalCount + 1,
          quizCount: current.encounters.quizCount + 1, lastEncounterAt: now.toISOString()}
      },
      eventType,
      metadata: {mode, correct}
    };
  }
  const rating: ReviewRating = !correct ? "again" : question.type === "cloze" ? "hard" : "good";
  const scheduled = scheduleNextReview({progress: current, rating, now});
  return {
    nextState: {
      ...current, ...scheduled, readingRevision,
      correctCount: current.correctCount + (correct ? 1 : 0),
      wrongCount: current.wrongCount + (correct ? 0 : 1),
      streak: correct ? current.streak + 1 : 0,
      lastReviewedAt: now.toISOString(),
      firstLearnedAt: current.firstLearnedAt ?? now.toISOString(),
      lastRating: rating,
      firstSeenSource: current.firstSeenSource ?? "reading",
      encounters: {...current.encounters, totalCount: current.encounters.totalCount + 1,
        quizCount: current.encounters.quizCount + 1, lastEncounterAt: now.toISOString()}
    },
    eventType,
    metadata: {mode, correct, rating, ...(correct ? {activeRecall: true} : {})}
  };
}
