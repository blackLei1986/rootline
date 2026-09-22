import { z } from "zod";

export const morphologySegmentSchema = z.object({
  position: z.number().int().nonnegative(),
  kind: z.enum(["prefix", "root", "suffix"]),
  surfaceForm: z.string().trim().min(1),
  rootId: z.string().min(1).nullable(),
  meaning: z.string().trim().min(1).nullable(),
  explanation: z.string().trim().min(1).nullable().optional()
});

const reviewBaseSchema = z.object({
  recordId: z.uuid(),
  revision: z.number().int().positive(),
  actorId: z.uuid()
});

export const approveMorphologySchema = reviewBaseSchema.extend({
  reason: z.string().trim().min(1).optional()
});

export const editAndApproveMorphologySchema = reviewBaseSchema.extend({
  segments: z.array(morphologySegmentSchema).min(1)
});

export const rejectMorphologySchema = reviewBaseSchema.extend({
  reason: z.string().trim().min(1, "reason is required")
});
