import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TodayLearningFlow } from "@/components/today-learning-flow";
import { Daily30Flow } from "@/components/today/daily-30-flow";
import type { TodayPlanDTO } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Today Reading flow", () => {
  it("uses learner-facing loading copy without an outdated catalog size", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<TodayLearningFlow />);
    expect(screen.getByText("正在准备今日学习…")).toBeVisible();
    expect(screen.queryByText(/9000 词/)).not.toBeInTheDocument();
  });

  it("hides backend errors and offers a Today retry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {throw new Error("RPC private database detail");}));
    render(<TodayLearningFlow />);
    expect(await screen.findByRole("alert")).toHaveTextContent("今日计划暂时无法加载");
    expect(screen.getByRole("link", {name: "重试"})).toHaveAttribute("href", "/today");
    expect(screen.queryByText(/RPC private database detail/)).not.toBeInTheDocument();
  });

  it("shows 今日阅读 below the Daily-30 card only in setup/complete, not during active learning", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: string, init?: RequestInit) => ({
      ok: true,
      json: async () => init?.method === "POST"
        ? { status: "active", eventRevision: 1, currentBlock: 1, completedTargetIds: [], targetProgress: {} }
        : { status: "not-started", eventRevision: 0, currentBlock: 1, completedTargetIds: [], targetProgress: {} }
    })));
    const { unmount } = render(<Daily30Flow plan={daily30Plan()} />);
    expect(screen.getByRole("link", { name: "今日阅读" })).toHaveAttribute("href", "/reading");
    await waitFor(() => expect(screen.getByRole("button", { name: "开始今日学习" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "开始今日学习" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "今日阅读" })).not.toBeInTheDocument());
    unmount();

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ status: "complete", eventRevision: 2, currentBlock: 1, completedTargetIds: ["target-1"], targetProgress: { "target-1": { outcomes: {}, recognitionState: "known" } } }) })));
    render(<Daily30Flow plan={daily30Plan()} />);
    await screen.findByText("今日完成");
    expect(await screen.findByRole("link", { name: "今日阅读" })).toHaveAttribute("href", "/reading");
  });

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

function daily30Plan(): TodayPlanDTO {
  const base = planWithArticle();
  return {
    ...base,
    dailyTargets: [{ wordId: "target-1", word: "adapt", lemma: "adapt", coreMeaningZh: "适应", coreDefinitionEn: "adjust", partOfSpeech: ["verb"], example: "Adapt.", examples: ["Adapt."], source: "support", rootId: null, rootForm: null, rootMeaningEn: [], rootMeaningZh: [], rootExplanation: null, familyId: null, morphology: null, block: 1, position: 0 }]
  };
}

function entry(index: number): ProductionVocabularyEntry {
  const word = `word${index}`;
  return {
    id: word, word, lemma: word, wordFamilyId: word, surfaceForms: [word], partOfSpeech: ["noun"], coreMeaningZh: `含义${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index / 10, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}
