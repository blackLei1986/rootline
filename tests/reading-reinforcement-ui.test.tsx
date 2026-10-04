import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingReinforcement } from "@/components/reading/reading-reinforcement";
import type { PublicSession } from "@/lib/reading/reinforcement/types";
import type { FlushResult, SyncOperation } from "@/types/sync";
import { readBetaLog, setBetaParticipation } from "@/lib/beta/validation-store";

const mocks = vi.hoisted(() => ({
  listPendingWordOperations: vi.fn((): SyncOperation[] => []),
  flushSyncQueue: vi.fn(async (): Promise<FlushResult> => ({applied: 0, remaining: 0, retryAt: null})),
  hydrateAuthoritativeWordState: vi.fn()
}));
vi.mock("@/lib/sync/offline-queue", () => ({
  listPendingWordOperations: mocks.listPendingWordOperations,
  flushSyncQueue: mocks.flushSyncQueue
}));
vi.mock("@/lib/storage", () => ({hydrateAuthoritativeWordState: mocks.hydrateAuthoritativeWordState}));

const base: PublicSession = {
  id: "session-1", articleId: "article-1", articleLabel: "文章语境词汇", learningDate: "2026-09-25",
  status: "active", cursor: 0, total: 2, practiced: 0, correct: 0, outcomes: [],
  currentQuestion: {id: "q1", wordId: "adapt", type: "cloze", context: "They ____ quickly.", prompt: "填入英文词形。"}
};

describe("optional reading reinforcement UI", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => {cleanup(); vi.unstubAllGlobals();});

  it("keeps the typed answer and cursor unchanged after a failed request, then shows confirmed feedback", async () => {
    const next: PublicSession = {...base, cursor: 1, practiced: 1, correct: 1,
      currentQuestion: {id: "q2", wordId: "explain", type: "recall", context: "They explain findings.", prompt: "写出原形。"},
      outcomes: [{questionId: "q1", wordId: "adapt", submittedAnswer: "adapt", correct: true,
        correctDisplay: "adapt", answeredAt: "2026-09-25T01:00:00Z"}]};
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ok: true, json: async () => ({session: next, wordState: {wordId: "adapt", readingRevision: 1}})});
    vi.stubGlobal("fetch", fetchMock);
    render(<ReadingReinforcement initialSession={base} />);
    fireEvent.change(screen.getByRole("textbox", {name: "你的答案"}), {target: {value: "adapt"}});
    fireEvent.click(screen.getByRole("button", {name: "提交答案"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("未保存");
    expect(screen.getByRole("textbox", {name: "你的答案"})).toHaveValue("adapt");
    expect(screen.getByText("第 1 / 2 题")).toBeVisible();
    fireEvent.click(screen.getByRole("button", {name: "提交答案"}));
    await waitFor(() => expect(screen.getByText("第 2 / 2 题")).toBeVisible());
    expect(screen.getByText(/回答正确/)).toBeVisible();
    expect(mocks.hydrateAuthoritativeWordState).toHaveBeenCalledWith("adapt", {wordId: "adapt", readingRevision: 1});
  });

  it("counts Reading completion only after a confirmed transition to the complete state", async () => {
    localStorage.clear();
    setBetaParticipation("beta-user", true);
    const completed: PublicSession = {...base, status: "complete", cursor: 2, total: 2, practiced: 2, correct: 1, currentQuestion: null,
      outcomes: [{questionId: "q1", wordId: "adapt", submittedAnswer: "adapt", correct: true, correctDisplay: "adapt", answeredAt: "2026-09-26T08:00:00.000Z"}]};
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true, json: async () => ({session: completed, wordState: null})})));
    render(<ReadingReinforcement initialSession={base} betaUserId="beta-user" />);
    fireEvent.change(screen.getByRole("textbox", {name: "你的答案"}), {target: {value: "adapt"}});
    fireEvent.click(screen.getByRole("button", {name: "提交答案"}));
    await screen.findByText(/已完成 2 个词/);
    expect(readBetaLog("beta-user").days.reduce((sum, day) => sum + day.readingCompletions, 0)).toBe(1);
  });

  it("recovers a server-confirmed Reading completion after a lost final response without double counting", async () => {
    localStorage.clear();
    setBetaParticipation("beta-user", true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("response lost")));
    const view = render(<ReadingReinforcement initialSession={base} betaUserId="beta-user" />);
    fireEvent.change(screen.getByRole("textbox", {name: "你的答案"}), {target: {value: "adapt"}});
    fireEvent.click(screen.getByRole("button", {name: "提交答案"}));
    await screen.findByRole("alert");
    expect(readBetaLog("beta-user").days).toHaveLength(0);
    view.unmount();

    const completed: PublicSession = {...base, status: "complete", cursor: 2, practiced: 2, currentQuestion: null,
      outcomes: [{questionId: "q1", wordId: "adapt", submittedAnswer: "adapt", correct: true, correctDisplay: "adapt", answeredAt: "2026-09-26T08:00:00.000Z"}]};
    const reopened = render(<ReadingReinforcement initialSession={completed} betaUserId="beta-user" />);
    await waitFor(() => expect(readBetaLog("beta-user").days.reduce((sum, day) => sum + day.readingCompletions, 0)).toBe(1));
    reopened.unmount();
    render(<ReadingReinforcement initialSession={completed} betaUserId="beta-user" />);
    expect(readBetaLog("beta-user").days.reduce((sum, day) => sum + day.readingCompletions, 0)).toBe(1);
  });

  it("renders a persisted cursor and a read-only completed result", () => {
    const resumed = {...base, cursor: 1, practiced: 1, correct: 0,
      currentQuestion: {id: "q2", wordId: "explain", type: "recall" as const, context: "They explain findings.", prompt: "写出原形。"}};
    const view = render(<ReadingReinforcement initialSession={resumed} />);
    expect(screen.getByText("第 2 / 2 题")).toBeVisible();
    view.unmount();
    render(<ReadingReinforcement initialSession={{...resumed, status: "complete", cursor: 2, practiced: 2, currentQuestion: null}} />);
    expect(screen.getByText(/已完成 2 个词/)).toBeVisible();
    expect(screen.queryByRole("button", {name: "提交答案"})).not.toBeInTheDocument();
  });

  it("does not submit a selected word when its queued snapshot cannot be synced", async () => {
    mocks.listPendingWordOperations.mockReturnValue([{id: "stale", kind: "word-state", entityId: "adapt", version: 1,
      createdAt: "2026-09-25T00:00:00Z", payload: {wordId: "adapt"}}]);
    mocks.flushSyncQueue.mockResolvedValue({applied: 0, remaining: 1, retryAt: null,
      conflict: {operationId: "stale", entityId: "adapt"}});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReadingReinforcement initialSession={base} />);
    fireEvent.change(screen.getByRole("textbox", {name: "你的答案"}), {target: {value: "adapt"}});
    fireEvent.click(screen.getByRole("button", {name: "提交答案"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("本地同步冲突");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
