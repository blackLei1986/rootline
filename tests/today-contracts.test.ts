import { describe, expect, it } from "vitest";
import { normalizeTodayPlan } from "@/types/today";

describe("Today contracts", () => {
  it("normalizes a legacy vocabulary-only plan", () => {
    const plan = normalizeTodayPlan({
      id: "today-legacy",
      date: "2026-09-17",
      estimatedMinutes: 20,
      warmupReviewIds: [],
      rapidScanEntries: [],
      focusedLearningTarget: 7,
      sentenceTarget: 5,
      quizTarget: 5,
      readingCandidateIds: [],
      mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 }
    });
    expect(plan.article).toBeNull();
    expect(plan.contextQuestions).toEqual([]);
    expect(plan.stages).toEqual(["warmup", "scan", "learn", "summary"]);
  });

  it("round-trips one article and five unique questions without storing article text", () => {
    const plan = normalizeTodayPlan({
      id: "today-new",
      date: "2026-09-17",
      version: 2,
      status: "not-started",
      estimatedMinutes: 22,
      warmupReviewIds: [],
      rapidScanEntries: [],
      focusedLearningTarget: 7,
      sentenceTarget: 0,
      quizTarget: 5,
      readingCandidateIds: [],
      mix: { review: 35, newVocabulary: 30, reading: 25, sentence: 10 },
      article: {
        articleId: "article-1",
        title: "Memory",
        sourceTitle: "Example",
        canonicalUrl: "https://example.com/memory",
        estimatedMinutes: 6,
        contentWordCoverage: 96,
        targetWordIds: ["retain"],
        selectionReasons: ["coverage-fit"],
        text: "must not persist"
      },
      contextQuestions: Array.from({ length: 5 }, (_, index) => ({
        id: `q-${index}`,
        articleId: "article-1",
        sentence: "Readers retain useful vocabulary.",
        targetWordId: "retain",
        prompt: "What does retain mean?",
        choices: ["keep", "lose"],
        correctChoice: "keep"
      }))
    });
    expect(plan.article).not.toHaveProperty("text");
    expect(plan.contextQuestions).toHaveLength(5);
    expect(plan.stages).toEqual(["warmup", "scan", "learn", "reading", "context-quiz", "summary"]);
  });

  it("rejects duplicate question IDs and more than one article", () => {
    expect(() => normalizeTodayPlan({ article: [{ articleId: "a" }, { articleId: "b" }] }))
      .toThrow(/article/i);
    expect(() => normalizeTodayPlan({
      article: { articleId: "a", title: "A", sourceTitle: "S", canonicalUrl: "https://example.com/a", estimatedMinutes: 6, contentWordCoverage: 96, targetWordIds: [], selectionReasons: [] },
      contextQuestions: [{ id: "same" }, { id: "same" }]
    })).toThrow(/question/i);
  });
});
