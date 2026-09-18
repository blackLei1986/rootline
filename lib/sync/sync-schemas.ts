import { z } from "zod";
import type { SyncOperation, SyncOperationKind } from "@/types/sync";

const payloadSchemas: Record<SyncOperationKind, z.ZodType> = {
  "word-state": z.object({ wordId: z.string().min(1) }).passthrough(),
  "learning-event": z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
      timestamp: z.iso.datetime({ offset: true })
    })
    .passthrough(),
  "learner-auxiliary": z
    .object({
      version: z.number().int().positive(),
      roots: z.record(z.string(), z.unknown()),
      dailyStats: z.record(z.string(), z.unknown()),
      settings: z.object({}).passthrough(),
      transferStats: z.object({}).passthrough()
    })
    .passthrough(),
  "reading-document": z
    .object({
      id: z.string().min(1),
      text: z.string(),
      sourceType: z.string().min(1),
      createdAt: z.iso.datetime({ offset: true }),
      analysisVersion: z.string().min(1)
    })
    .passthrough(),
  "reading-progress": z
    .object({ documentId: z.string().min(1), startedAt: z.iso.datetime({ offset: true }) })
    .passthrough(),
  "personal-sentence": z
    .object({
      id: z.string().min(1),
      documentId: z.string().min(1),
      text: z.string().min(1),
      targetWordIds: z.array(z.string()),
      createdAt: z.iso.datetime({ offset: true })
    })
    .passthrough(),
  "today-event": z.object({
    planId: z.string().min(1),
    type: z.string().min(1),
    stage: z.string().min(1),
    occurredAt: z.iso.datetime({ offset: true })
  }).passthrough()
};

export const syncOperationSchema = z.object({
  id: z.string().min(1).max(300),
  kind: z.enum([
    "word-state",
    "learning-event",
    "learner-auxiliary",
    "reading-document",
    "reading-progress",
    "personal-sentence",
    "today-event"
  ]),
  entityId: z.string().min(1).max(500),
  version: z.number().int().positive().max(2_147_483_647),
  createdAt: z.iso.datetime({ offset: true }),
  payload: z.unknown()
});

export function validateSyncOperation(input: unknown): SyncOperation {
  const operation = syncOperationSchema.parse(input) as SyncOperation;
  payloadSchemas[operation.kind].parse(operation.payload);
  return operation;
}
