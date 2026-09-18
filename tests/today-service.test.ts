import { describe, expect, it } from "vitest";
import { createTodayService, type TodayPlanStore } from "@/lib/today/service";
import { EMPTY_STORAGE, createWordProgress } from "@/lib/storage";
import type { ArticleCandidate, ArticleVocabularyMatch } from "@/types/articles";
import type { TodayPlan } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

describe("Today service", () => {
  it("returns one stable persisted plan for concurrent requests", async () => {
    const harness = createHarness();
    const [first, second] = await Promise.all([
      harness.service.getOrCreateTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T08:00:00Z")),
      harness.service.getOrCreateTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T08:00:00Z"))
    ]);

    expect(first.id).toBe(second.id);
    expect(first.article?.articleId).toBe("article-1");
    expect(second.article?.articleId).toBe(first.article?.articleId);
    expect(first.contextQuestions).toHaveLength(5);
    expect(first.warmupReviewIds).toHaveLength(15);
    expect(first.rapidScanEntries).toHaveLength(30);
    expect(first.focusedLearningTarget).toBe(7);
  });

  it("reopens a started plan with its stored article and questions", async () => {
    const harness = createHarness();
    const first = await harness.service.getOrCreateTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T08:00:00Z"));
    const storedQuestionIds = first.contextQuestions.map((question) => question.id);
    harness.candidates.reverse();
    harness.article.text = "The source content changed after the plan started.";

    const reopened = await harness.service.getOrCreateTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T09:00:00Z"));

    expect(reopened.id).toBe(first.id);
    expect(reopened.article?.articleId).toBe(first.article?.articleId);
    expect(reopened.contextQuestions.map((question) => question.id)).toEqual(storedQuestionIds);
  });

  it("regenerates only before the first session event", async () => {
    const harness = createHarness();
    const first = await harness.service.getOrCreateTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T08:00:00Z"));
    const regenerated = await harness.service.regenerateUnstartedTodayPlan("user-1", "2026-09-17", new Date("2026-09-17T08:05:00Z"));
    expect(regenerated.version).toBe(2);
    expect(regenerated.id).not.toBe(first.id);

    harness.store.startedPlanIds.add(regenerated.id);
    await expect(harness.service.regenerateUnstartedTodayPlan(
      "user-1",
      "2026-09-17",
      new Date("2026-09-17T08:10:00Z")
    )).rejects.toThrow("started");
  });
});

function createHarness() {
  const vocabulary = Array.from({ length: 40 }, (_, index) => entry(index));
  const article = {
    id: "article-1",
    text: vocabulary.slice(0, 8).map((word) => `Readers use ${word.word} when they explain evidence.`).join(" "),
    lexicalMatches: vocabulary.slice(0, 8).map((word) => lexicalMatch(word))
  };
  const candidates = [candidate("article-1", 96), candidate("article-2", 88)];
  const store = new MemoryTodayPlanStore();
  const snapshot = structuredClone(EMPTY_STORAGE);
  snapshot.settings.learningGoal.sessionMinutes = 20;
  snapshot.settings.dailyReviewGoal = 18;
  for (let index = 0; index < 15; index += 1) {
    const progress = createWordProgress(`review-${index}`);
    progress.nextReviewAt = "2026-09-16T08:00:00Z";
    snapshot.words[progress.wordId] = progress;
  }

  const service = createTodayService({
    plans: store,
    getLearnerSnapshot: async () => snapshot,
    getDailyVocabulary: async () => vocabulary,
    getVocabularyEntries: async (ids) => vocabulary.filter((word) => ids.includes(word.id)),
    getArticleCandidates: async () => candidates,
    getRecentArticleHistory: async () => [],
    getArticleBundle: async (_userId, articleId) => articleId === article.id ? article : null
  });
  return { service, store, candidates, article };
}

class MemoryTodayPlanStore implements TodayPlanStore {
  readonly startedPlanIds = new Set<string>();
  private readonly plans = new Map<string, TodayPlan[]>();

  async getPlan(userId: string, date: string): Promise<TodayPlan | null> {
    return structuredClone(this.plans.get(`${userId}:${date}`)?.at(-1) ?? null);
  }

  async createPlan(userId: string, plan: TodayPlan): Promise<TodayPlan> {
    await Promise.resolve();
    const key = `${userId}:${plan.date}`;
    const versions = this.plans.get(key) ?? [];
    const existing = versions.find((candidate) => candidate.version === plan.version);
    if (existing) return structuredClone(existing);
    versions.push(structuredClone(plan));
    versions.sort((left, right) => left.version - right.version);
    this.plans.set(key, versions);
    return structuredClone(plan);
  }

  async hasSessionEvents(_userId: string, planId: string): Promise<boolean> {
    return this.startedPlanIds.has(planId);
  }
}

function candidate(articleId: string, score: number): ArticleCandidate {
  return {
    articleId,
    title: `Article ${articleId}`,
    sourceTitle: `Source ${articleId}`,
    canonicalUrl: `https://example.com/${articleId}`,
    estimatedMinutes: 6,
    contentWordCoverage: 96,
    valuableUnknownWordIds: ["contextword0", "contextword1", "contextword2", "contextword3", "contextword4"],
    score,
    explanationCodes: ["coverage-fit", "valuable-new-words"]
  };
}

function lexicalMatch(word: ProductionVocabularyEntry): ArticleVocabularyMatch {
  return {
    wordId: word.id,
    lemma: word.lemma,
    familyId: word.wordFamilyId,
    occurrences: 1,
    frequencyRank: word.frequencyRank,
    learningValue: word.learningValueScore,
    vocabularyBand: "core-3000",
    coverageTags: word.coverageTags
  };
}

function entry(index: number): ProductionVocabularyEntry {
  const word = `contextword${index}`;
  return {
    id: word, word, lemma: word, wordFamilyId: word, surfaceForms: [word], partOfSpeech: ["noun"], coreMeaningZh: `含义${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}
