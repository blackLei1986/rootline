import { z } from "zod";

import type {
  MorphologyRecord,
  MorphologyReviewRepository,
  MorphologySegment
} from "@/lib/morphology/review-service";
import { throwRepositoryError, toJson, type DatabaseClient } from "@/lib/repositories/supabase/shared";

const reviewSnapshotSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  confidence: z.enum(["verified", "derived", "none"]),
  review_status: z.enum(["pending", "approved", "rejected"]),
  reviewed_at: z.string().nullable().optional(),
  reviewed_by: z.string().uuid().nullable().optional(),
  segments: z.array(z.object({
    position: z.number().int().nonnegative(),
    kind: z.enum(["prefix", "root", "suffix"]),
    surface_form: z.string(),
    root_id: z.string().uuid().nullable(),
    meaning: z.string().nullable(),
    explanation: z.string().nullable().optional()
  })).default([])
});

export class SupabaseMorphologyRepository implements MorphologyReviewRepository {
  constructor(private readonly client: DatabaseClient) {}

  async get(recordId: string): Promise<MorphologyRecord | null> {
    const { data, error } = await this.client
      .from("word_morphology_records")
      .select("id,revision,confidence,review_status,reviewed_at,reviewed_by,word_morphology_segments(position,kind,surface_form,root_id,meaning,explanation)")
      .eq("id", recordId)
      .maybeSingle();
    throwRepositoryError(error, "load morphology record");
    if (!data) return null;

    const nestedSegments = (data as unknown as { word_morphology_segments?: unknown[] }).word_morphology_segments ?? [];
    const snapshot = { ...data, segments: nestedSegments };
    return toMorphologyRecord(snapshot);
  }

  async apply(input: Parameters<MorphologyReviewRepository["apply"]>[0]): Promise<MorphologyRecord> {
    const { data, error } = await this.client.rpc("apply_morphology_review", {
      p_record_id: input.recordId,
      p_expected_revision: input.expectedRevision,
      p_action: input.action,
      p_actor_id: input.actorId,
      p_reason: input.reason ?? null,
      p_segments: input.segments ? toJson(input.segments.map(toDatabaseSegment)) : null
    });
    throwRepositoryError(error, "apply morphology review");
    return toMorphologyRecord(data);
  }
}

function toDatabaseSegment(segment: MorphologySegment) {
  return {
    position: segment.position,
    kind: segment.kind,
    surface_form: segment.surfaceForm,
    root_id: segment.rootId,
    meaning: segment.meaning,
    explanation: segment.explanation ?? null
  };
}

function toMorphologyRecord(snapshot: unknown): MorphologyRecord {
  const parsed = reviewSnapshotSchema.parse(snapshot);
  const segments: MorphologySegment[] = parsed.segments.map((segment) => ({
    position: segment.position,
    kind: segment.kind,
    surfaceForm: segment.surface_form,
    rootId: segment.root_id,
    meaning: segment.meaning,
    explanation: segment.explanation ?? undefined
  }));
  return {
    id: parsed.id,
    revision: parsed.revision,
    confidence: parsed.confidence,
    reviewStatus: parsed.review_status,
    rootIds: [...new Set(segments.flatMap((segment) => segment.rootId ? [segment.rootId] : []))],
    segments,
    reviewedAt: parsed.reviewed_at ?? undefined,
    reviewedBy: parsed.reviewed_by ?? undefined
  };
}
