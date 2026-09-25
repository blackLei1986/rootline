import type { z } from "zod";

import {
  approveMorphologySchema,
  editAndApproveMorphologySchema,
  rejectMorphologySchema,
  morphologySegmentSchema
} from "@/lib/morphology/review-schemas";
import type { MorphologyConfidenceV2, MorphologyReviewStatus } from "@/lib/morphology/types";

export type MorphologySegment = z.infer<typeof morphologySegmentSchema>;
export type MorphologyReviewAction = "approve" | "edit" | "reject";

export interface MorphologyRecord {
  id: string;
  revision: number;
  confidence: MorphologyConfidenceV2;
  reviewStatus: MorphologyReviewStatus;
  rootIds: string[];
  segments: MorphologySegment[];
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface MorphologyReviewRepository {
  get(recordId: string): Promise<MorphologyRecord | null>;
  apply(input: {
    recordId: string;
    expectedRevision: number;
    action: MorphologyReviewAction;
    actorId: string;
    reason?: string;
    segments?: MorphologySegment[];
    previous: MorphologyRecord;
    result: MorphologyRecord;
  }): Promise<MorphologyRecord>;
}

export interface MorphologyReviewer {
  approve(input: z.input<typeof approveMorphologySchema>): Promise<MorphologyRecord>;
  editAndApprove(input: z.input<typeof editAndApproveMorphologySchema>): Promise<MorphologyRecord>;
  reject(input: z.input<typeof rejectMorphologySchema>): Promise<MorphologyRecord>;
}

export class MorphologyReviewService implements MorphologyReviewer {
  constructor(private readonly repository: MorphologyReviewRepository) {}

  async approve(input: z.input<typeof approveMorphologySchema>): Promise<MorphologyRecord> {
    const parsed = approveMorphologySchema.parse(input);
    return this.transition(parsed, "approve", parsed.reason, undefined, (current) => ({
      ...current,
      confidence: "verified",
      reviewStatus: "approved"
    }));
  }

  async editAndApprove(input: z.input<typeof editAndApproveMorphologySchema>): Promise<MorphologyRecord> {
    const parsed = editAndApproveMorphologySchema.parse(input);
    return this.transition(parsed, "edit", undefined, parsed.segments, (current) => ({
      ...current,
      segments: parsed.segments,
      rootIds: rootIdsFromSegments(parsed.segments),
      confidence: "verified",
      reviewStatus: "approved"
    }));
  }

  async reject(input: z.input<typeof rejectMorphologySchema>): Promise<MorphologyRecord> {
    const parsed = rejectMorphologySchema.parse(input);
    return this.transition(parsed, "reject", parsed.reason, undefined, (current) => {
      if (current.confidence === "verified") throw new Error("verified records cannot be weakened");
      return { ...current, confidence: "none", reviewStatus: "rejected" };
    });
  }

  private async transition(
    input: { recordId: string; revision: number; actorId: string },
    action: MorphologyReviewAction,
    reason: string | undefined,
    segments: MorphologySegment[] | undefined,
    mutate: (current: MorphologyRecord) => MorphologyRecord
  ): Promise<MorphologyRecord> {
    const current = await this.repository.get(input.recordId);
    if (!current) throw new Error("record not found");
    if (current.revision !== input.revision) throw new Error("stale review revision");

    const previous = structuredClone(current);
    const result = {
      ...mutate(current),
      revision: current.revision + 1,
      reviewedAt: new Date().toISOString(),
      reviewedBy: input.actorId
    };

    return this.repository.apply({
      recordId: input.recordId,
      expectedRevision: input.revision,
      action,
      actorId: input.actorId,
      reason,
      segments,
      previous,
      result
    });
  }
}

function rootIdsFromSegments(segments: MorphologySegment[]): string[] {
  return [...new Set(segments.flatMap((segment) => segment.rootId ? [segment.rootId] : []))];
}
