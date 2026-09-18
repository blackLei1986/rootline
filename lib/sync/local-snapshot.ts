"use client";

import { getStorageAdapter, type StorageAdapter } from "@/lib/storage-adapter";
import { EMPTY_STORAGE, STORAGE_KEY, STORAGE_VERSION, migrateStorage } from "@/lib/storage";
import {
  READING_STORAGE_KEY,
  READING_STORAGE_VERSION
} from "@/lib/reading-storage";
import type { LearningStorage } from "@/types/progress";
import type { ReadingStore } from "@/types/reading";
import type { MigrationEntity } from "@/types/migration";
import { validateMigrationEntity } from "@/lib/sync/migration-schemas";

const INSTALLATION_ID_KEY = "rootline-installation-id";
export const MIGRATION_COMPLETE_KEY = "rootline-cloud-migration-complete";

export interface LocalMigrationSnapshot {
  sourceInstallationId: string;
  schemaVersion: number;
  learning: LearningStorage;
  reading: ReadingStore;
}

const emptyReadingStore: ReadingStore = {
  version: READING_STORAGE_VERSION,
  documents: {},
  progress: {},
  learningQueue: [],
  personalSentences: []
};

export function createLocalSnapshot(
  adapter: StorageAdapter = getStorageAdapter()
): LocalMigrationSnapshot {
  const learning = parseLearning(adapter.getItem(STORAGE_KEY));
  const reading = parseReading(adapter.getItem(READING_STORAGE_KEY));

  return {
    sourceInstallationId: getOrCreateInstallationId(adapter),
    schemaVersion: Math.max(STORAGE_VERSION, READING_STORAGE_VERSION),
    learning,
    reading
  };
}

export async function createMigrationEntities(
  snapshot: LocalMigrationSnapshot
): Promise<MigrationEntity[]> {
  const auxiliary = {
    version: snapshot.learning.version,
    roots: snapshot.learning.roots,
    dailyStats: snapshot.learning.dailyStats,
    calibration: snapshot.learning.calibration,
    settings: snapshot.learning.settings,
    transferStats: snapshot.learning.transferStats
  };
  const candidates: Array<Omit<MigrationEntity, "contentHash">> = [
    ...Object.values(snapshot.learning.words).map((payload) => ({
      type: "word-state" as const,
      legacyId: payload.wordId,
      payload
    })),
    ...snapshot.learning.events.map((payload) => ({
      type: "learning-event" as const,
      legacyId: payload.id,
      payload
    })),
    {
      type: "learner-auxiliary" as const,
      legacyId: "learner-auxiliary",
      payload: auxiliary
    },
    ...Object.values(snapshot.reading.documents).map((payload) => ({
      type: "reading-document" as const,
      legacyId: payload.id,
      payload
    })),
    ...Object.values(snapshot.reading.progress).map((payload) => ({
      type: "reading-progress" as const,
      legacyId: payload.documentId,
      payload
    })),
    ...snapshot.reading.learningQueue.map((payload) => ({
      type: "reading-queue" as const,
      legacyId: `${payload.documentId}:${payload.wordId}`,
      payload
    })),
    ...snapshot.reading.personalSentences.map((payload) => ({
      type: "personal-sentence" as const,
      legacyId: payload.id,
      payload
    }))
  ];

  return Promise.all(
    candidates.map(async (candidate) =>
      validateMigrationEntity({
        ...candidate,
        contentHash: await contentHash(candidate.payload)
      })
    )
  );
}

function parseLearning(raw: string | null): LearningStorage {
  if (!raw) return structuredClone(EMPTY_STORAGE);
  try {
    return migrateStorage(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY_STORAGE);
  }
}

function parseReading(raw: string | null): ReadingStore {
  if (!raw) return structuredClone(emptyReadingStore);
  try {
    const candidate = JSON.parse(raw) as Partial<ReadingStore>;
    return {
      version: READING_STORAGE_VERSION,
      documents: candidate.documents ?? {},
      progress: candidate.progress ?? {},
      learningQueue: candidate.learningQueue ?? [],
      personalSentences: candidate.personalSentences ?? []
    };
  } catch {
    return structuredClone(emptyReadingStore);
  }
}

function getOrCreateInstallationId(adapter: StorageAdapter): string {
  const existing = adapter.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  adapter.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

async function contentHash(payload: unknown): Promise<string> {
  const data = new TextEncoder().encode(stableStringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
