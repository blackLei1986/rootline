import { beforeEach, describe, expect, it } from "vitest";
import { getStorageAdapter, memoryStorageAdapter } from "@/lib/storage-adapter";
import {
  enqueueSyncOperation,
  flushSyncQueue,
  readSyncQueue
} from "@/lib/sync/offline-queue";
import { SyncConflictError, discardConflictingWordStateOperation, listPendingWordOperations } from "@/lib/sync/offline-queue";
import { createWordProgress, getWordProgress, hydrateAuthoritativeWordState, loadProgress, saveProgress } from "@/lib/storage";
import type { SyncOperation } from "@/types/sync";

describe("offline sync queue", () => {
  beforeEach(() => {
    memoryStorageAdapter.removeItem("rootline-sync-queue");
    getStorageAdapter().removeItem("rootline-sync-queue");
  });

  it("preserves ordered work after a partial failure and never replays an applied id", async () => {
    const operations = [operation("operation-1"), operation("operation-2"), operation("operation-3")];
    operations.forEach((item) => enqueueSyncOperation(item, memoryStorageAdapter));
    const received: string[] = [];

    const first = await flushSyncQueue({
      adapter: memoryStorageAdapter,
      transport: async (item) => {
        if (item.id === "operation-2") throw new Error("offline");
        received.push(item.id);
      }
    });

    expect(first.applied).toBe(1);
    expect(readSyncQueue(memoryStorageAdapter).map((item) => item.id)).toEqual([
      "operation-2",
      "operation-3"
    ]);

    const second = await flushSyncQueue({
      adapter: memoryStorageAdapter,
      transport: async (item) => {
        received.push(item.id);
      }
    });

    expect(second).toEqual({ applied: 2, remaining: 0, retryAt: null });
    expect(received).toEqual(["operation-1", "operation-2", "operation-3"]);
  });

  it("deduplicates an operation id before transport", () => {
    enqueueSyncOperation(operation("same-id"), memoryStorageAdapter);
    enqueueSyncOperation(operation("same-id"), memoryStorageAdapter);
    expect(readSyncQueue(memoryStorageAdapter)).toHaveLength(1);
  });

  it("keeps work enqueued while an earlier operation is in flight", async () => {
    enqueueSyncOperation(operation("first"), memoryStorageAdapter);
    const sent: string[] = [];
    const result = await flushSyncQueue({adapter: memoryStorageAdapter, transport: async (item) => {
      sent.push(item.id);
      if (item.id === "first") enqueueSyncOperation(operation("second"), memoryStorageAdapter);
    }});
    expect(sent).toEqual(["first", "second"]);
    expect(result).toEqual({applied: 2, remaining: 0, retryAt: null});
  });

  it("does not delete a newer coalesced snapshot after acknowledging the old one", async () => {
    enqueueSyncOperation({...operation("old"), entityId: "inspect"}, memoryStorageAdapter);
    const sent: string[] = [];
    await flushSyncQueue({adapter: memoryStorageAdapter, transport: async (item) => {
      sent.push(item.id);
      if (item.id === "old") enqueueSyncOperation({...operation("new"), entityId: "inspect"}, memoryStorageAdapter);
    }});
    expect(sent).toEqual(["old", "new"]);
  });

  it("continues with a replacement when the obsolete in-flight snapshot conflicts", async () => {
    enqueueSyncOperation({...operation("obsolete"), entityId: "inspect"}, memoryStorageAdapter);
    const sent: string[] = [];
    const result = await flushSyncQueue({adapter: memoryStorageAdapter, transport: async (item) => {
      sent.push(item.id);
      if (item.id === "obsolete") {
        enqueueSyncOperation({...operation("replacement"), entityId: "inspect"}, memoryStorageAdapter);
        throw new SyncConflictError();
      }
    }});
    expect(sent).toEqual(["obsolete", "replacement"]);
    expect(result.conflict).toBeUndefined();
    expect(readSyncQueue(memoryStorageAdapter)).toEqual([]);
  });

  it("serializes simultaneous flushes using the same storage adapter", async () => {
    enqueueSyncOperation(operation("once"), memoryStorageAdapter);
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {release = resolve;});
    const sent: string[] = [];
    const transport = async (item: SyncOperation) => {sent.push(item.id); await held;};
    const first = flushSyncQueue({adapter: memoryStorageAdapter, transport});
    const second = flushSyncQueue({adapter: memoryStorageAdapter, transport});
    release?.();
    await Promise.all([first, second]);
    expect(sent).toEqual(["once"]);
  });

  it("retains an offline operation until a later transport succeeds", async () => {
    enqueueSyncOperation(operation("offline-1"), memoryStorageAdapter);
    const failed = await flushSyncQueue({adapter: memoryStorageAdapter, transport: async () => {throw new Error("offline");}});
    expect(failed.remaining).toBe(1);
    expect(readSyncQueue(memoryStorageAdapter).map((item) => item.id)).toEqual(["offline-1"]);
    const succeeded = await flushSyncQueue({adapter: memoryStorageAdapter, transport: async () => {}});
    expect(succeeded.remaining).toBe(0);
    expect(readSyncQueue(memoryStorageAdapter)).toEqual([]);
  });

  it("preserves the exact stale word operation and stops automatic retry on a revision conflict", async () => {
    const stale = operation("old-snapshot");
    stale.entityId = "adapt";
    enqueueSyncOperation(stale, memoryStorageAdapter);
    const result = await flushSyncQueue({adapter: memoryStorageAdapter,
      transport: async () => {throw new SyncConflictError("READING_REVISION_CONFLICT");}});
    expect(result.conflict).toEqual({operationId: "old-snapshot", entityId: "adapt"});
    expect(result.retryAt).toBeNull();
    expect(readSyncQueue(memoryStorageAdapter)[0]).toEqual(stale);
  });

  it("discards only the confirmed conflicting snapshot, preserving later evidence", () => {
    const stale = {...operation("stale-adapt"), entityId: "adapt", payload: {wordId: "adapt"}};
    const event = {...operation("event-adapt"), kind: "learning-event" as const, entityId: "event-adapt", payload: {wordId: "adapt", id: "event-adapt"}};
    const other = {...operation("other-analyze"), entityId: "analyze", payload: {wordId: "analyze"}};
    [stale, event, other].forEach((item) => enqueueSyncOperation(item, memoryStorageAdapter));
    expect(listPendingWordOperations("adapt", memoryStorageAdapter)).toEqual([stale, event]);
    expect(discardConflictingWordStateOperation("stale-adapt", "adapt", memoryStorageAdapter)).toBe(true);
    expect(readSyncQueue(memoryStorageAdapter)).toEqual([event, other]);
    expect(discardConflictingWordStateOperation("event-adapt", "adapt", memoryStorageAdapter)).toBe(false);
    expect(readSyncQueue(memoryStorageAdapter)).toEqual([event, other]);
  });

  it("hydrates a confirmed server word without queueing another word snapshot", () => {
    saveProgress({...loadProgress(), words: {adapt: createWordProgress("adapt")}});
    getStorageAdapter().removeItem("rootline-sync-queue");
    const server = {...createWordProgress("adapt"), readingRevision: 1, correctCount: 1};
    hydrateAuthoritativeWordState("adapt", server);
    expect(getWordProgress("adapt").readingRevision).toBe(1);
    expect(readSyncQueue().filter((item) => item.kind === "word-state" && item.entityId === "adapt")).toEqual([]);
  });
});

function operation(id: string): SyncOperation {
  return {
    id,
    kind: "word-state",
    entityId: id,
    version: 1,
    createdAt: "2026-09-17T00:00:00.000Z",
    payload: { wordId: "inspect" }
  };
}
