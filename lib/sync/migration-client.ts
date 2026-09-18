"use client";

import { getStorageAdapter } from "@/lib/storage-adapter";
import {
  MIGRATION_COMPLETE_KEY,
  createMigrationEntities,
  type LocalMigrationSnapshot
} from "@/lib/sync/local-snapshot";
import type { MigrationSummary } from "@/types/migration";

const MIGRATION_CHUNK_SIZE = 100;

type MigrationFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json">>;

export async function migrateLocalSnapshot(
  snapshot: LocalMigrationSnapshot,
  request: MigrationFetch = fetch
): Promise<MigrationSummary> {
  const entities = await createMigrationEntities(snapshot);
  const chunks = chunk(entities, MIGRATION_CHUNK_SIZE);
  let summary: MigrationSummary | null = null;

  for (const [index, entitiesChunk] of chunks.entries()) {
    const response = await request("/api/migrations/local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceInstallationId: snapshot.sourceInstallationId,
        schemaVersion: snapshot.schemaVersion,
        isLastChunk: index === chunks.length - 1,
        entities: entitiesChunk
      })
    });
    const body = (await response.json()) as MigrationSummary | { message?: string };
    if (!response.ok) {
      throw new Error("message" in body && body.message ? body.message : "本地数据导入失败，请重试。");
    }
    summary = body as MigrationSummary;
  }

  if (!summary) throw new Error("没有可迁移的数据。");
  if (summary.complete) {
    getStorageAdapter().setItem(
      MIGRATION_COMPLETE_KEY,
      JSON.stringify({
        sourceInstallationId: snapshot.sourceInstallationId,
        schemaVersion: snapshot.schemaVersion,
        batchId: summary.batchId,
        completedAt: new Date().toISOString()
      })
    );
  }
  return summary;
}

function chunk<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [[]];
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}
