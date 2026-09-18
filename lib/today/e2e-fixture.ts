import type { TodayPlanDTO, TodaySessionDTO } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { TodayEventInput } from "@/lib/today/events";

const words = Array.from({ length: 30 }, (_, index) => entry(index));
let currentStage = "setup";
let completedQuestionIds: string[] = [];

export function getE2ETodayPlan(): TodayPlanDTO {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    date: "2026-09-17",
    version: 1,
    status: "not-started",
    estimatedMinutes: 22,
    warmupReviewIds: Array.from({ length: 15 }, (_, index) => `review-${index}`),
    warmupReviewEntries: [entry(50)],
    rapidScanEntries: words,
    focusedLearningTarget: 7,
    sentenceTarget: 7,
    quizTarget: 5,
    readingCandidateIds: words.slice(0, 5).map((word) => word.id),
    mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 },
    article: { articleId: "article-1", title: "A useful article", sourceTitle: "Fixture source", canonicalUrl: "https://example.com/article", estimatedMinutes: 6, contentWordCoverage: 96, targetWordIds: words.slice(0, 5).map((word) => word.id), selectionReasons: ["coverage-fit"], text: "A useful article provides authentic context." },
    contextQuestions: Array.from({ length: 5 }, (_, index) => ({ id: `q-${index}`, articleId: "article-1", sentence: `Readers use ____ in context ${index}.`, targetWordId: words[index].id, prompt: "根据文章语境选择含义", choices: [`含义${index}`, `干扰${index}`], correctChoice: `含义${index}` })),
    stages: ["warmup", "scan", "learn", "reading", "context-quiz", "summary"],
    degradationReason: null
  };
}

export function getE2ETodaySession(): TodaySessionDTO {
  return {
    planId: getE2ETodayPlan().id,
    status: currentStage === "setup" ? "not-started" : currentStage === "summary" ? "complete" : "active",
    currentStage,
    completedQuestionIds
  };
}

export function recordE2ETodayEvent(event: TodayEventInput): TodaySessionDTO {
  if (event.type === "today_started") currentStage = event.stage;
  if (event.type === "stage_completed") {
    const stages = getE2ETodayPlan().stages;
    currentStage = stages[stages.indexOf(event.stage) + 1] ?? "summary";
  }
  if (event.type === "article_opened") currentStage = "reading";
  if (event.type === "context_answered" && event.questionId && !completedQuestionIds.includes(event.questionId)) {
    completedQuestionIds = [...completedQuestionIds, event.questionId];
    if (completedQuestionIds.length === 5) currentStage = "summary";
  }
  return getE2ETodaySession();
}

function entry(index: number): ProductionVocabularyEntry {
  const word = `word${index}`;
  return { id: word, word, lemma: word, wordFamilyId: word, surfaceForms: [word], partOfSpeech: ["noun"], coreMeaningZh: `含义${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index / 10, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 } };
}
