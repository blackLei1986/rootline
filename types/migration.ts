export type MigrationEntityType =
  | "word-state"
  | "learning-event"
  | "learner-auxiliary"
  | "reading-document"
  | "reading-progress"
  | "reading-queue"
  | "personal-sentence";

export interface MigrationEntity {
  type: MigrationEntityType;
  legacyId: string;
  contentHash: string;
  payload: unknown;
}

export interface MigrationChunkInput {
  sourceInstallationId: string;
  schemaVersion: number;
  isLastChunk: boolean;
  entities: MigrationEntity[];
}

export interface MigrationSummary {
  batchId: string;
  imported: number;
  skipped: number;
  failed: number;
  complete: boolean;
}

export interface MigrationItemResult {
  entityType: MigrationEntityType;
  legacyId: string;
  contentHash: string;
  result: "imported" | "skipped" | "failed";
  errorCategory?: string;
}
