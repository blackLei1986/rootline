import { beforeEach, describe, expect, it } from "vitest";
import { memoryStorageAdapter } from "@/lib/storage-adapter";
import {
  enqueueSyncOperation,
  flushSyncQueue,
  readSyncQueue
} from "@/lib/sync/offline-queue";
import type { SyncOperation } from "@/types/sync";

describe("offline sync queue", () => {
  beforeEach(() => {
    memoryStorageAdapter.removeItem("rootline-sync-queue");
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
