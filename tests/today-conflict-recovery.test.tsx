import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {Daily30Flow} from "@/components/today/daily-30-flow";
import type {TodayPlanDTO, TodaySessionDTO} from "@/types/today";

const plan = {id: "plan-1", date: "2026-09-25", version: 1, status: "not-started", estimatedMinutes: 20,
  warmupReviewIds: [], warmupReviewEntries: [], rapidScanEntries: [], focusedLearningTarget: 0,
  sentenceTarget: 0, quizTarget: 0, readingCandidateIds: [], mix: {review: 0, newVocabulary: 100, reading: 0, sentence: 0},
  article: null, contextQuestions: [], stages: ["learn", "summary"], degradationReason: null,
  dailyTargets: [{wordId: "inspect", word: "inspect", lemma: "inspect", coreMeaningZh: "检查", coreDefinitionEn: "examine",
    partOfSpeech: ["verb"], example: "Inspect it.", examples: ["Inspect it."], source: "support", rootId: null, rootForm: null,
    rootMeaningEn: [], rootMeaningZh: [], rootExplanation: null, familyId: null, morphology: null, block: 1, position: 0}]
} as TodayPlanDTO;

function session(status: TodaySessionDTO["status"], revision: number): TodaySessionDTO {
  return {planId: plan.id, status, currentStage: "learn", completedQuestionIds: [], currentBlock: 1,
    completedTargetIds: status === "complete" ? ["inspect"] : [], targetProgress: {}, completedMiniReviewBlocks: [],
    finalReviewComplete: status === "complete", reviewAccuracy: {correct: 0, total: 0}, reviewAnswers: {}, eventRevision: revision};
}

afterEach(() => {cleanup(); vi.unstubAllGlobals();});

describe("Today ambiguous save recovery", () => {
  it("refreshes after a lost POST response and never replays the start operation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ok: true, json: async () => session("not-started", 0)})
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce({ok: true, json: async () => session("active", 2)});
    vi.stubGlobal("fetch", fetchMock);
    render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(screen.getByRole("button", {name: "开始今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "开始今日学习"}));
    expect(await screen.findByRole("button", {name: "继续今日学习"})).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("已同步最新进度");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  });

  it("handles a second-tab 409 by showing the authoritative completed state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ok: true, json: async () => session("not-started", 0)})
      .mockResolvedValueOnce({ok: false, status: 409})
      .mockResolvedValueOnce({ok: true, json: async () => session("complete", 3)}));
    render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(screen.getByRole("button", {name: "开始今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "开始今日学习"}));
    expect(await screen.findByRole("heading", {name: "1 / 1"})).toBeVisible();
    expect(screen.queryByRole("button", {name: "开始今日学习"})).not.toBeInTheDocument();
  });

  it("blocks another write when both POST outcome and refresh are unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ok: true, json: async () => session("not-started", 0)})
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("offline")));
    render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(screen.getByRole("button", {name: "开始今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "开始今日学习"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("保存状态尚不确定");
    expect(screen.getByRole("link", {name: "重新读取今日进度"})).toHaveAttribute("href", "/today");
    expect(screen.queryByRole("button", {name: "开始今日学习"})).not.toBeInTheDocument();
  });
});
