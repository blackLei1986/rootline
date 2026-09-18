import type {
  MigrationChunkInput,
  MigrationEntity,
  MigrationItemResult,
  MigrationSummary
} from "@/types/migration";

export interface MigrationBatchRecord {
  id: string;
  userId: string;
  sourceInstallationId: string;
  schemaVersion: number;
  status: "pending" | "running" | "partial" | "complete" | "failed";
  imported: number;
  skipped: number;
  failed: number;
}

export interface MigrationBatchStore {
  findOrCreateBatch(
    userId: string,
    sourceInstallationId: string,
    schemaVersion: number
  ): Promise<MigrationBatchRecord>;
  getItem(
    batchId: string,
    type: MigrationEntity["type"],
    legacyId: string
  ): Promise<MigrationItemResult | null>;
  saveItem(batchId: string, item: MigrationItemResult): Promise<void>;
  saveBatch(batch: MigrationBatchRecord): Promise<void>;
}

export interface MigrationEntityWriter {
  apply(userId: string, batchId: string, entity: MigrationEntity): Promise<void>;
}

export async function processMigrationChunk(
  userId: string,
  input: MigrationChunkInput,
  store: MigrationBatchStore,
  writer: MigrationEntityWriter
): Promise<MigrationSummary> {
  const batch = await store.findOrCreateBatch(
    userId,
    input.sourceInstallationId,
    input.schemaVersion
  );
  if (batch.status === "complete") return toSummary(batch);

  batch.status = "running";
  await store.saveBatch(batch);

  for (const entity of input.entities) {
    const existing = await store.getItem(batch.id, entity.type, entity.legacyId);
    if (existing?.result === "imported" || existing?.result === "skipped") continue;

    try {
      await writer.apply(userId, batch.id, entity);
      await store.saveItem(batch.id, {
        entityType: entity.type,
        legacyId: entity.legacyId,
        contentHash: entity.contentHash,
        result: "imported"
      });
      batch.imported += 1;
      if (existing?.result === "failed") batch.failed = Math.max(0, batch.failed - 1);
    } catch {
      await store.saveItem(batch.id, {
        entityType: entity.type,
        legacyId: entity.legacyId,
        contentHash: entity.contentHash,
        result: "failed",
        errorCategory: "write-failed"
      });
      if (existing?.result !== "failed") batch.failed += 1;
    }
  }

  batch.status = input.isLastChunk
    ? batch.failed === 0
      ? "complete"
      : "partial"
    : "pending";
  await store.saveBatch(batch);
  return toSummary(batch);
}

function toSummary(batch: MigrationBatchRecord): MigrationSummary {
  return {
    batchId: batch.id,
    imported: batch.imported,
    skipped: batch.skipped,
    failed: batch.failed,
    complete: batch.status === "complete"
  };
}
