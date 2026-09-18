import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TodayLearningFlow } from "@/components/today-learning-flow";
import type { TodayPlanDTO } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

afterEach(cleanup);

describe("Today Reading flow", () => {
  it("shows the 15 / 30 / 7 / 1 / 5 plan and opens Reading before context questions", () => {
    render(<TodayLearningFlow initialPlan={planWithArticle()} onEvent={vi.fn()} />);

    expect(screen.getByText("约 22 分钟")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /开始今日学习/ }));
    for (let index = 0; index < 15; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "显示答案" }));
      fireEvent.click(screen.getByRole("button", { name: /想起来了/ }));
    }
    for (let index = 0; index < 30; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "模糊" }));
    }
    for (let index = 0; index < 7; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /继续/ }));
    }

    expect(screen.getByRole("heading", { name: "A useful article" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /完成阅读/ }));
    expect(screen.getByText("语境题 1 / 5")).toBeInTheDocument();
  });

  it("skips Reading and context quiz when the stored plan has no article", () => {
    const plan = planWithArticle();
    plan.article = null;
    plan.contextQuestions = [];
    plan.stages = ["warmup", "scan", "learn", "summary"];
    plan.degradationReason = "NO_FRESH_ARTICLES";
    render(<TodayLearningFlow initialPlan={plan} onEvent={vi.fn()} />);

    expect(screen.getByText(/今天没有合适的新文章/)).toBeInTheDocument();
    expect(screen.queryByText("A useful article")).not.toBeInTheDocument();
  });
});

function planWithArticle(): TodayPlanDTO {
  const rapidScanEntries = Array.from({ length: 30 }, (_, index) => entry(index));
  const warmupReviewEntries = Array.from({ length: 15 }, (_, index) => entry(index + 30));
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    date: "2026-09-17",
    version: 1,
    status: "not-started",
    estimatedMinutes: 22,
    warmupReviewIds: warmupReviewEntries.map((word) => word.id),
    warmupReviewEntries,
    rapidScanEntries,
    focusedLearningTarget: 7,
    sentenceTarget: 7,
    quizTarget: 5,
    readingCandidateIds: rapidScanEntries.slice(0, 5).map((word) => word.id),
    mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 },
    article: {
      articleId: "article-1",
      title: "A useful article",
      sourceTitle: "Example source",
      canonicalUrl: "https://example.com/article",
      estimatedMinutes: 6,
      contentWordCoverage: 96,
      targetWordIds: rapidScanEntries.slice(0, 5).map((word) => word.id),
      selectionReasons: ["coverage-fit"],
      text: "This is the first paragraph. This is the second paragraph."
    },
    contextQuestions: Array.from({ length: 5 }, (_, index) => ({
      id: `question-${index}`,
      articleId: "article-1",
      sentence: `Readers use ____ in context ${index}.`,
      targetWordId: rapidScanEntries[index].id,
      prompt: "根据文章语境，空格处单词最合适的含义是？",
      choices: [`含义${index}`, `干扰项${index}`],
      correctChoice: `含义${index}`
    })),
    stages: ["warmup", "scan", "learn", "reading", "context-quiz", "summary"],
    degradationReason: null
  };
}

function entry(index: number): ProductionVocabularyEntry {
  const word = `word${index}`;
  return {
    id: word, word, lemma: word, wordFamilyId: word, surfaceForms: [word], partOfSpeech: ["noun"], coreMeaningZh: `含义${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index / 10, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}
