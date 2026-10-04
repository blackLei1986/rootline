import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {Daily30Flow} from "@/components/today/daily-30-flow";
import type {TodayPlanDTO, TodaySessionDTO} from "@/types/today";
import {getWordProgress, resetProgress} from "@/lib/storage";
import {creditAcceptedTodayEvent, readPendingTodayCredit, savePendingTodayCredit} from "@/lib/today/learning-credit";
import {readBetaLog, setBetaParticipation} from "@/lib/beta/validation-store";

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

afterEach(() => {cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.localStorage.clear(); resetProgress();});

describe("Today ambiguous save recovery", () => {
  it("does not create a second Beta completion when a completed Today page reopens", async () => {
    setBetaParticipation("beta-account", true);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => session("complete", 30) })));
    const first = render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 / 1" })).toBeVisible());
    const completedAt = readBetaLog("beta-account").days[0].completedAt;
    expect(completedAt).toBeTruthy();
    first.unmount();
    render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 / 1" })).toBeVisible());
    expect(readBetaLog("beta-account").days[0].completedAt).toBe(completedAt);
  });
  it("excludes a pending save from active learning duration", async () => {
    setBetaParticipation("beta-account", true);
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
      ? new Promise(() => {})
      : {ok: true, json: async () => session("active", 1)}));
    render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("button", {name: "继续今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "继续今日学习"}));
    expect(screen.getByRole("button", {name: "认识"})).toBeVisible();
    now = 1_000;
    fireEvent.click(screen.getByRole("button", {name: "认识"}));
    await waitFor(() => expect(screen.getByRole("button", {name: "认识"})).toBeDisabled());
    expect(readBetaLog("beta-account").days[0].activeMilliseconds).toBe(1_000);
    now = 10_000;
    expect(readBetaLog("beta-account").days[0].activeMilliseconds).toBe(1_000);
  });
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
    setBetaParticipation("beta-account", true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ok: true, json: async () => session("not-started", 0)})
      .mockResolvedValueOnce({ok: false, status: 409})
      .mockResolvedValueOnce({ok: true, json: async () => session("complete", 3)}));
    render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("button", {name: "开始今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "开始今日学习"}));
    expect(await screen.findByRole("heading", {name: "1 / 1"})).toBeVisible();
    expect(screen.queryByRole("button", {name: "开始今日学习"})).not.toBeInTheDocument();
    expect(readBetaLog("beta-account").days[0].completedAt).toBeTruthy();
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

  it("credits an accepted wrong review exactly once after its response is lost", async () => {
    setBetaParticipation("beta-account", true);
    resetProgress();
    const before = {...session("active", 1), completedTargetIds: ["inspect"],
      targetProgress: {inspect: {targetId: "inspect", block: 1, status: "complete", currentActivity: null,
        recognitionState: "unknown", outcomes: {}}}} as TodaySessionDTO;
    const after = {...before, eventRevision: 2, reviewAnswers: {"mini:inspect": false},
      reviewAccuracy: {correct: 0, total: 1}} as TodaySessionDTO;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("response lost");
      if (url.includes("operationId=")) return {ok: true, json: async () => ({applied: true})};
      return {ok: true, json: async () => fetchMock.mock.calls.some(([, options]) => options?.method === "POST") ? after : before};
    });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("button", {name: "继续今日学习"})).toBeEnabled());
    fireEvent.click(screen.getByRole("button", {name: "继续今日学习"}));
    fireEvent.click(screen.getByRole("button", {name: "没想起来"}));
    await waitFor(() => expect(getWordProgress("inspect").wrongCount).toBe(1));
    expect(readPendingTodayCredit(plan.id)).toBeNull();
    expect(readBetaLog("beta-account").days[0].reviewOutcomes["mini:support:support"]).toEqual({correct: 0, total: 1});
    view.unmount();
    render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(screen.getByRole("button", {name: "继续今日学习"})).toBeEnabled());
    expect(getWordProgress("inspect").wrongCount).toBe(1);
    expect(readBetaLog("beta-account").days[0].reviewOutcomes["mini:support:support"]).toEqual({correct: 0, total: 1});
  });

  it("reconciles a durable pending accepted review after a page reload", async () => {
    resetProgress();
    setBetaParticipation("beta-account", true);
    savePendingTodayCredit({operationId: "accepted-op", planId: plan.id, occurredAt: "2026-09-25T12:00:00Z",
      type: "review_answered", stage: "learn", reviewKind: "mini", targetId: "inspect", block: 1, correct: false});
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("operationId=")
      ? {ok: true, json: async () => ({applied: true})}
      : {ok: true, json: async () => ({...session("complete", 2), reviewAnswers: {"mini:inspect": false}})}));
    render(<Daily30Flow plan={plan} betaUserId="beta-account" />);
    await waitFor(() => expect(getWordProgress("inspect").wrongCount).toBe(1));
    expect(readPendingTodayCredit(plan.id)).toBeNull();
    expect(readBetaLog("beta-account").days[0].reviewOutcomes["mini:support:support"]).toEqual({correct: 0, total: 1});
    expect(readBetaLog("beta-account").days[0].completedAt).toBeTruthy();
  });

  it("replays the same operation ID when the first status read races an in-flight POST", async () => {
    resetProgress();
    savePendingTodayCredit({operationId: "race-op", planId: plan.id, occurredAt: "2026-09-25T12:00:00Z",
      type: "review_answered", stage: "learn", reviewKind: "mini", targetId: "inspect", block: 1, correct: false});
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => init?.method === "POST"
      ? {ok: true, json: async () => session("active", 2)}
      : url.includes("operationId=")
        ? {ok: true, json: async () => ({applied: false})}
        : {ok: true, json: async () => session("active", 2)});
    vi.stubGlobal("fetch", fetchMock);
    render(<Daily30Flow plan={plan} />);
    await waitFor(() => expect(getWordProgress("inspect").wrongCount).toBe(1));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post![1]!.body as string).operationId).toBe("race-op");
    expect(readPendingTodayCredit(plan.id)).toBeNull();
  });

  it("keeps the pending operation when neither status nor replay can establish acceptance", async () => {
    resetProgress();
    savePendingTodayCredit({operationId: "unknown-op", planId: plan.id, occurredAt: "2026-09-25T12:00:00Z",
      type: "review_answered", stage: "learn", reviewKind: "mini", targetId: "inspect", block: 1, correct: false});
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") throw new Error("offline");
      if (url.includes("operationId=")) return {ok: true, json: async () => ({applied: false})};
      throw new Error("Unexpected session read");
    }));
    render(<Daily30Flow plan={plan} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("保存状态尚不确定");
    expect(readPendingTodayCredit(plan.id)?.operationId).toBe("unknown-op");
    expect(getWordProgress("inspect").wrongCount).toBe(0);
  });

  it("applies the same confirmed review operation only once", () => {
    resetProgress();
    const event = {operationId: "same-op", planId: plan.id, occurredAt: "2026-09-25T12:00:00Z",
      type: "review_answered" as const, stage: "learn" as const, reviewKind: "mini" as const,
      targetId: "inspect", block: 1 as const, correct: false};
    creditAcceptedTodayEvent(event);
    creditAcceptedTodayEvent(event);
    expect(getWordProgress("inspect").wrongCount).toBe(1);
    expect(getWordProgress("inspect").reviewCount).toBe(1);
  });
});
