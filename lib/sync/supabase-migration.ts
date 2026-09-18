import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_STORAGE, migrateStorage } from "@/lib/storage";
import { mergeLearningState } from "@/lib/sync/merge";
import type {
  MigrationBatchRecord,
  MigrationBatchStore,
  MigrationEntityWriter
} from "@/lib/sync/migration-service";
import { throwRepositoryError, toJson } from "@/lib/repositories/supabase/shared";
import { SupabaseLearnerRepository } from "@/lib/repositories/supabase/learner-repository";
import { SupabaseReadingRepository } from "@/lib/repositories/supabase/reading-repository";
import type { Database, Json } from "@/types/database";
import type { LearningEvent, LearningStorage, WordProgress } from "@/types/progress";
import type {
  PersonalSentence,
  ReadingDocument,
  ReadingLearningItem,
  ReadingProgress
} from "@/types/reading";
import type { MigrationEntity, MigrationItemResult } from "@/types/migration";

type DatabaseClient = SupabaseClient<Database>;

export class SupabaseMigrationBatchStore implements MigrationBatchStore {
  constructor(private readonly client: DatabaseClient) {}

  async findOrCreateBatch(
    userId: string,
    sourceInstallationId: string,
    schemaVersion: number
  ): Promise<MigrationBatchRecord> {
    const existing = await this.findBatch(userId, sourceInstallationId, schemaVersion);
    if (existing) return existing;

    const { data, error } = await this.client
      .from("migration_batches")
      .insert({
        user_id: userId,
        source_installation_id: sourceInstallationId,
        schema_version: schemaVersion,
        status: "pending",
        attempt_count: 1,
        entity_counts: toJson({ imported: 0, skipped: 0, failed: 0 })
      })
      .select("id,user_id,source_installation_id,schema_version,status,entity_counts")
      .single();

    if (error?.code === "23505") {
      const concurrent = await this.findBatch(userId, sourceInstallationId, schemaVersion);
      if (concurrent) return concurrent;
    }
    throwRepositoryError(error, "create migration batch");
    if (!data) throw new Error("Migration batch was not created.");
    return mapBatch(data);
  }

  async getItem(
    batchId: string,
    type: MigrationEntity["type"],
    legacyId: string
  ): Promise<MigrationItemResult | null> {
    const { data, error } = await this.client
      .from("migration_items")
      .select("entity_type,legacy_id,content_hash,result,error_category")
      .eq("batch_id", batchId)
      .eq("entity_type", type)
      .eq("legacy_id", legacyId)
      .maybeSingle();
    throwRepositoryError(error, "load migration item");
    if (!data) return null;
    return {
      entityType: data.entity_type as MigrationEntity["type"],
      legacyId: data.legacy_id,
      contentHash: data.content_hash,
      result: data.result,
      ...(data.error_category ? { errorCategory: data.error_category } : {})
    };
  }

  async saveItem(batchId: string, item: MigrationItemResult): Promise<void> {
    const { data: batch, error: batchError } = await this.client
      .from("migration_batches")
      .select("user_id")
      .eq("id", batchId)
      .single();
    throwRepositoryError(batchError, "load migration owner");
    if (!batch) throw new Error("Migration owner was not found.");

    const { error } = await this.client.from("migration_items").upsert(
      {
        user_id: batch.user_id,
        batch_id: batchId,
        entity_type: item.entityType,
        legacy_id: item.legacyId,
        content_hash: item.contentHash,
        result: item.result,
        error_category: item.errorCategory ?? null
      },
      { onConflict: "batch_id,entity_type,legacy_id" }
    );
    throwRepositoryError(error, "save migration item");
  }

  async saveBatch(batch: MigrationBatchRecord): Promise<void> {
    const { error } = await this.client
      .from("migration_batches")
      .update({
        status: batch.status,
        entity_counts: toJson({
          imported: batch.imported,
          skipped: batch.skipped,
          failed: batch.failed
        }),
        ...(batch.status === "complete" ? { verified_at: new Date().toISOString() } : {})
      })
      .eq("id", batch.id)
      .eq("user_id", batch.userId);
    throwRepositoryError(error, "update migration batch");
  }

  private async findBatch(
    userId: string,
    sourceInstallationId: string,
    schemaVersion: number
  ): Promise<MigrationBatchRecord | null> {
    const { data, error } = await this.client
      .from("migration_batches")
      .select("id,user_id,source_installation_id,schema_version,status,entity_counts")
      .eq("user_id", userId)
      .eq("source_installation_id", sourceInstallationId)
      .eq("schema_version", schemaVersion)
      .maybeSingle();
    throwRepositoryError(error, "load migration batch");
    return data ? mapBatch(data) : null;
  }
}

export class SupabaseMigrationEntityWriter implements MigrationEntityWriter {
  private readonly learner: SupabaseLearnerRepository;
  private readonly reading: SupabaseReadingRepository;
  private snapshots = new Map<string, LearningStorage>();

  constructor(private readonly client: DatabaseClient) {
    this.learner = new SupabaseLearnerRepository(client);
    this.reading = new SupabaseReadingRepository(client);
  }

  async apply(userId: string, batchId: string, entity: MigrationEntity): Promise<void> {
    const operationId = `migration:${batchId}:${entity.type}:${entity.legacyId}`;

    switch (entity.type) {
      case "word-state":
        await this.applyWordState(userId, operationId, entity.payload as WordProgress);
        return;
      case "learning-event":
        await this.learner.appendEvents(userId, [entity.payload as LearningEvent]);
        return;
      case "learner-auxiliary":
        await this.applyAuxiliary(userId, operationId, entity.payload as AuxiliaryPayload);
        return;
      case "reading-document":
        await this.reading.saveDocument(
          userId,
          entity.payload as ReadingDocument,
          operationId
        );
        return;
      case "reading-progress":
        await this.reading.saveProgress(
          userId,
          entity.payload as ReadingProgress,
          operationId
        );
        return;
      case "reading-queue":
        await this.applyReadingQueue(userId, entity.payload as ReadingLearningItem, operationId);
        return;
      case "personal-sentence":
        await this.applyPersonalSentence(userId, entity.payload as PersonalSentence);
    }
  }

  private async applyWordState(
    userId: string,
    operationId: string,
    localWord: WordProgress
  ): Promise<void> {
    const server = await this.getSnapshot(userId);
    const local = migrateStorage({
      ...structuredClone(EMPTY_STORAGE),
      words: { [localWord.wordId]: localWord }
    });
    const merged = mergeLearningState(server, local);
    const selected = merged.words[localWord.wordId];
    await this.learner.upsertWordState(userId, selected, operationId);
    server.words[localWord.wordId] = structuredClone(selected);
  }

  private async applyAuxiliary(
    userId: string,
    operationId: string,
    local: AuxiliaryPayload
  ): Promise<void> {
    const server = await this.getSnapshot(userId);
    const localStorage = migrateStorage({
      ...structuredClone(EMPTY_STORAGE),
      ...local,
      words: {},
      events: []
    });
    const merged = mergeLearningState(server, localStorage);
    await this.learner.saveAuxiliaryState(userId, merged, operationId);
    this.snapshots.set(userId, merged);
  }

  private async applyReadingQueue(
    userId: string,
    item: ReadingLearningItem,
    operationId: string
  ): Promise<void> {
    await this.learner.appendEvents(userId, [
      {
        id: operationId,
        type: "reading_queue_added",
        timestamp: new Date().toISOString(),
        wordId: item.wordId,
        metadata: {
          documentId: item.documentId,
          queueItem: JSON.stringify(item)
        }
      }
    ]);
  }

  private async applyPersonalSentence(userId: string, sentence: PersonalSentence): Promise<void> {
    const { error } = await this.client.from("personal_sentences").upsert(
      {
        id: sentence.id,
        user_id: userId,
        document_id: sentence.documentId,
        text: sentence.text,
        target_word_ids: sentence.targetWordIds,
        created_at: sentence.createdAt
      },
      { onConflict: "id" }
    );
    throwRepositoryError(error, "save personal sentence");
  }

  private async getSnapshot(userId: string): Promise<LearningStorage> {
    const existing = this.snapshots.get(userId);
    if (existing) return existing;
    const loaded = await this.learner.getSnapshot(userId);
    this.snapshots.set(userId, loaded);
    return loaded;
  }
}

type AuxiliaryPayload = Pick<
  LearningStorage,
  "version" | "roots" | "dailyStats" | "calibration" | "settings" | "transferStats"
>;

function mapBatch(row: {
  id: string;
  user_id: string;
  source_installation_id: string;
  schema_version: number;
  status: MigrationBatchRecord["status"];
  entity_counts: Json;
}): MigrationBatchRecord {
  const counts = asCounts(row.entity_counts);
  return {
    id: row.id,
    userId: row.user_id,
    sourceInstallationId: row.source_installation_id,
    schemaVersion: row.schema_version,
    status: row.status,
    imported: counts.imported,
    skipped: counts.skipped,
    failed: counts.failed
  };
}

function asCounts(value: Json): { imported: number; skipped: number; failed: number } {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { imported: 0, skipped: 0, failed: 0 };
  }
  return {
    imported: typeof value.imported === "number" ? value.imported : 0,
    skipped: typeof value.skipped === "number" ? value.skipped : 0,
    failed: typeof value.failed === "number" ? value.failed : 0
  };
}
