import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {Daily30Flow} from "@/components/today/daily-30-flow";
import type {TodayPlanDTO, TodaySessionDTO} from "@/types/today";

vi.mock("next/navigation", () => ({redirect: (path: string) => {throw new Error(`redirect:${path}`);}}));
import HomePage from "@/app/page";

afterEach(() => {cleanup(); vi.unstubAllGlobals();});

function plan(count: number): TodayPlanDTO {
  return {
    id: "plan-1", date: "2026-09-25", version: 1, status: "active", estimatedMinutes: 30,
    warmupReviewIds: [], warmupReviewEntries: [], rapidScanEntries: [], focusedLearningTarget: 0,
    sentenceTarget: 0, quizTarget: 0, readingCandidateIds: [],
    mix: {review: 0, newVocabulary: 100, reading: 0, sentence: 0}, article: null,
    contextQuestions: [], stages: ["learn", "summary"], degradationReason: count < 30 ? "词库暂不足" : null,
    dailyTargets: Array.from({length: count}, (_, index) => ({
      wordId: `word-${index}`, word: `word-${index}`, lemma: `word-${index}`,
      coreMeaningZh: "释义", coreDefinitionEn: "meaning", partOfSpeech: ["noun"], example: "Example.",
      examples: ["Example."], source: "support" as const, rootId: null, rootForm: null,
      rootMeaningEn: [], rootMeaningZh: [], rootExplanation: null, familyId: null, morphology: null,
      block: (Math.floor(index / 10) + 1) as 1 | 2 | 3, position: index
    }))
  };
}

function session(status: TodaySessionDTO["status"], done: number): TodaySessionDTO {
  return {planId: "plan-1", status, currentStage: "learn", completedQuestionIds: [],
    currentBlock: 1, completedTargetIds: Array.from({length: done}, (_, index) => `word-${index}`),
    targetProgress: {}, completedMiniReviewBlocks: [], finalReviewComplete: status === "complete",
    reviewAccuracy: {correct: 2, total: 3}, reviewAnswers: {}, eventRevision: 7};
}

describe("Beta Today home", () => {
  it("routes the product home directly to Today", () => {
    expect(() => HomePage()).toThrow("redirect:/today");
  });

  it("shows a frozen shortfall denominator and a Continue action after resume", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true, json: async () => session("active", 5)})));
    render(<Daily30Flow plan={plan(23)} />);
    expect(await screen.findByRole("button", {name: "继续今日学习"})).toBeVisible();
    expect(screen.getByText("5 / 23")).toBeVisible();
    expect(screen.getByText(/约 24 分钟/)).toBeVisible();
    expect(screen.queryByText("5 / 30")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name: /再来 30|重新生成|换一批/})).not.toBeInTheDocument();
  });

  it("keeps a completed day locked and offers Reading and Progress only", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true, json: async () => session("complete", 23)})));
    render(<Daily30Flow plan={plan(23)} />);
    await waitFor(() => expect(screen.getByRole("heading", {name: "23 / 23"})).toBeVisible());
    expect(screen.getByText("今日完成")).toBeVisible();
    expect(screen.getByRole("link", {name: "今日阅读"})).toHaveAttribute("href", "/reading");
    expect(screen.getByRole("link", {name: "查看进度"})).toHaveAttribute("href", "/progress");
    expect(screen.queryByRole("button", {name: /再来 30|重新生成|换一批/})).not.toBeInTheDocument();
  });
});
