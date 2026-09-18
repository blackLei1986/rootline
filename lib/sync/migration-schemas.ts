import { z } from "zod";
import type { MigrationEntity, MigrationEntityType } from "@/types/migration";

const wordStateSchema = z.object({ wordId: z.string().min(1) }).passthrough();
const learningEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    timestamp: z.iso.datetime({ offset: true })
  })
  .passthrough();
const auxiliarySchema = z
  .object({
    version: z.number().int().positive(),
    roots: z.record(z.string(), z.unknown()),
    dailyStats: z.record(z.string(), z.unknown()),
    calibration: z.unknown().nullable(),
    settings: z.object({}).passthrough(),
    transferStats: z.object({}).passthrough()
  })
  .passthrough();
const readingDocumentSchema = z
  .object({
    id: z.string().min(1),
    text: z.string(),
    sourceType: z.string().min(1),
    createdAt: z.iso.datetime({ offset: true }),
    analysisVersion: z.string().min(1)
  })
  .passthrough();
const readingProgressSchema = z
  .object({ documentId: z.string().min(1), startedAt: z.iso.datetime({ offset: true }) })
  .passthrough();
const readingQueueSchema = z
  .object({ documentId: z.string().min(1), wordId: z.string().min(1), status: z.string() })
  .passthrough();
const personalSentenceSchema = z
  .object({ id: z.string().min(1), documentId: z.string().min(1), text: z.string().min(1) })
  .passthrough();

const payloadSchemas: Record<MigrationEntityType, z.ZodType> = {
  "word-state": wordStateSchema,
  "learning-event": learningEventSchema,
  "learner-auxiliary": auxiliarySchema,
  "reading-document": readingDocumentSchema,
  "reading-progress": readingProgressSchema,
  "reading-queue": readingQueueSchema,
  "personal-sentence": personalSentenceSchema
};

export const migrationEntitySchema = z.object({
  type: z.enum([
    "word-state",
    "learning-event",
    "learner-auxiliary",
    "reading-document",
    "reading-progress",
    "reading-queue",
    "personal-sentence"
  ]),
  legacyId: z.string().min(1).max(500),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.unknown()
});

export const migrationChunkSchema = z.object({
  sourceInstallationId: z.string().min(1).max(200),
  schemaVersion: z.number().int().positive(),
  isLastChunk: z.boolean(),
  entities: z.array(migrationEntitySchema).max(100)
});

export function validateMigrationEntity(entity: MigrationEntity): MigrationEntity {
  migrationEntitySchema.parse(entity);
  payloadSchemas[entity.type].parse(entity.payload);
  return entity;
}
