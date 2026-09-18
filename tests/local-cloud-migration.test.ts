import { describe, expect, it } from "vitest";
import { EMPTY_STORAGE, createWordProgress } from "@/lib/storage";
import { mergeLearningState } from "@/lib/sync/merge";
import {
  processMigrationChunk,
  type MigrationBatchRecord,
  type MigrationBatchStore,
  type MigrationEntityWriter
} from "@/lib/sync/migration-service";
import type { MigrationChunkInput, MigrationItemResult } from "@/types/migration";

describe("local-to-cloud migration", () => {
  it("keeps the newer server word state and deduplicates events", () => {
    const server = structuredClone(EMPTY_STORAGE);
    server.words.inspect = {
      ...createWordProgress("inspect"),
      recognitionState: "known",
      lastReviewedAt: "2026-09-17T09:00:00.000Z"
    };
    server.events = [event("event-1", "2026-09-17T08:00:00.000Z")];

    const local = structuredClone(EMPTY_STORAGE);
    local.words.inspect = {
      ...createWordProgress("inspect"),
      recognitionState: "fuzzy",
      lastReviewedAt: "2026-09-17T07:00:00.000Z"
    };
    local.events = [
      event("event-1", "2026-09-17T08:00:00.000Z"),
      event("event-2", "2026-09-17T10:00:00.000Z")
    ];

    const merged = mergeLearningState(server, local);

    expect(merged.words.inspect.recognitionState).toBe("known");
    expect(merged.words.inspect.lastReviewedAt).toBe("2026-09-17T09:00:00.000Z");
    expect(merged.events.map((item) => item.id)).toEqual(["event-1", "event-2"]);
  });

  it("reuses a completed batch when the same installation and schema retry", async () => {
    const store = new MemoryMigrationBatchStore();
    const writer = new CountingWriter();
    const input: MigrationChunkInput = {
      sourceInstallationId: "installation-1",
      schemaVersion: 2,
      isLastChunk: true,
      entities: [
        {
          type: "word-state",
          legacyId: "inspect",
          contentHash: "hash-1",
          payload: { wordId: "inspect" }
        }
      ]
    };

    const first = await processMigrationChunk("user-1", input, store, writer);
    const second = await processMigrationChunk("user-1", input, store, writer);

    expect(first).toEqual({
      batchId: first.batchId,
      imported: 1,
      skipped: 0,
      failed: 0,
      complete: true
    });
    expect(second).toEqual(first);
    expect(writer.applied).toBe(1);
  });
});

function event(id: string, timestamp: string) {
  return { id, type: "word_seen" as const, timestamp, wordId: "inspect" };
}

class MemoryMigrationBatchStore implements MigrationBatchStore {
  private batch: MigrationBatchRecord | null = null;
  private readonly items = new Map<string, MigrationItemResult>();

  async findOrCreateBatch(
    userId: string,
    sourceInstallationId: string,
    schemaVersion: number
  ): Promise<MigrationBatchRecord> {
    if (!this.batch) {
      this.batch = {
        id: "batch-1",
        userId,
        sourceInstallationId,
        schemaVersion,
        status: "pending",
        imported: 0,
        skipped: 0,
        failed: 0
      };
    }
    return structuredClone(this.batch);
  }

  async getItem(_batchId: string, type: string, legacyId: string) {
    return this.items.get(`${type}:${legacyId}`) ?? null;
  }

  async saveItem(_batchId: string, item: MigrationItemResult) {
    this.items.set(`${item.entityType}:${item.legacyId}`, item);
  }

  async saveBatch(batch: MigrationBatchRecord) {
    this.batch = structuredClone(batch);
  }
}

class CountingWriter implements MigrationEntityWriter {
  applied = 0;

  async apply() {
    this.applied += 1;
  }
}
