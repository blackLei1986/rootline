import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncQueueFlusher } from "@/components/sync-queue-flusher";

const mocks = vi.hoisted(() => ({
  flushSyncQueue: vi.fn(),
  listPendingWordOperations: vi.fn(),
  discardPendingWordOperations: vi.fn(),
  hydrateAuthoritativeWordState: vi.fn()
}));
vi.mock("@/lib/sync/offline-queue", () => ({
  SYNC_QUEUE_EVENT: "rootline-sync-queue-updated",
  flushSyncQueue: mocks.flushSyncQueue,
  listPendingWordOperations: mocks.listPendingWordOperations,
  discardPendingWordOperations: mocks.discardPendingWordOperations
}));
vi.mock("@/lib/storage", () => ({ hydrateAuthoritativeWordState: mocks.hydrateAuthoritativeWordState }));

describe("sync revision conflict recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.flushSyncQueue.mockResolvedValue({applied: 0, remaining: 1, retryAt: null,
      conflict: {operationId: "stale", entityId: "adapt"}});
    mocks.listPendingWordOperations.mockReturnValue([{id: "stale", kind: "word-state", entityId: "adapt"}]);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("keeps a revision conflict visible and preserves local edits until explicit choice", async () => {
    render(<SyncQueueFlusher />);
    expect(await screen.findByRole("alert")).toHaveTextContent("adapt");
    expect(screen.getByRole("link", {name: "导出本地修改"})).toBeVisible();
    expect(mocks.discardPendingWordOperations).not.toHaveBeenCalled();
    expect(mocks.hydrateAuthoritativeWordState).not.toHaveBeenCalled();
  });

  it("replaces only the selected word after confirmation and verified server fetch", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("fetch", vi.fn(async () => ({ok: true, json: async () => ({wordState: {wordId: "adapt", readingRevision: 1}})})));
    mocks.flushSyncQueue.mockResolvedValueOnce({applied: 0, remaining: 1, retryAt: null,
      conflict: {operationId: "stale", entityId: "adapt"}})
      .mockResolvedValue({applied: 0, remaining: 0, retryAt: null});
    render(<SyncQueueFlusher />);
    fireEvent.click(await screen.findByRole("link", {name: "导出本地修改"}));
    fireEvent.click(await screen.findByRole("button", {name: "使用云端版本"}));
    await waitFor(() => expect(mocks.discardPendingWordOperations).toHaveBeenCalledWith("adapt"));
    expect(mocks.hydrateAuthoritativeWordState).toHaveBeenCalledWith("adapt", {wordId: "adapt", readingRevision: 1});
  });
});
