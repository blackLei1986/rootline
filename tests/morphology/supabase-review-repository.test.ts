import { describe, expect, it, vi } from "vitest";

import { SupabaseMorphologyRepository } from "@/lib/repositories/supabase/morphology-repository";
import type { MorphologyRecord } from "@/lib/morphology/review-service";

const recordId = "00000000-0000-4000-8000-000000000010";
const reviewerId = "00000000-0000-4000-8000-000000000001";
const rootId = "00000000-0000-4000-8000-000000000020";

function record(overrides: Partial<MorphologyRecord> = {}): MorphologyRecord {
  return {
    id: recordId,
    revision: 1,
    confidence: "derived",
    reviewStatus: "pending",
    rootIds: [rootId],
    segments: [{ position: 0, kind: "root", surfaceForm: "spect", rootId, meaning: "look" }],
    ...overrides
  };
}

describe("SupabaseMorphologyRepository", () => {
  it("calls the server-only transaction function with mapped segments", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: recordId,
        revision: 2,
        confidence: "verified",
        review_status: "approved",
        reviewed_at: "2026-09-22T00:00:00.000Z",
        reviewed_by: reviewerId,
        segments: [{ position: 0, kind: "root", surface_form: "spect", root_id: rootId, meaning: "look", explanation: null }]
      },
      error: null
    });
    const repository = new SupabaseMorphologyRepository({ rpc } as never);
    const previous = record();
    const result = await repository.apply({
      recordId,
      expectedRevision: 1,
      action: "approve",
      actorId: reviewerId,
      previous,
      result: record({ confidence: "verified", reviewStatus: "approved", revision: 2 })
    });

    expect(rpc).toHaveBeenCalledWith("apply_morphology_review", {
      p_record_id: recordId,
      p_expected_revision: 1,
      p_action: "approve",
      p_actor_id: reviewerId,
      p_reason: null,
      p_segments: null
    });
    expect(result).toMatchObject({ confidence: "verified", reviewStatus: "approved", revision: 2, rootIds: [rootId] });
  });
});
