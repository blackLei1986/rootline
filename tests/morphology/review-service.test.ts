import { describe, expect, it } from "vitest";
import { MorphologyReviewService } from "@/lib/morphology/review-service";
import type { MorphologyRecord, MorphologyReviewRepository } from "@/lib/morphology/review-service";

const reviewerId = "00000000-0000-4000-8000-000000000001";
const recordId = "00000000-0000-4000-8000-000000000010";

function record(overrides: Partial<MorphologyRecord> = {}): MorphologyRecord {
  return {
    id: recordId,
    revision: 1,
    confidence: "derived",
    reviewStatus: "pending",
    rootIds: ["spect"],
    segments: [{ position: 0, kind: "root", surfaceForm: "spect", rootId: "spect", meaning: "look" }],
    ...overrides
  };
}

class MemoryRepository implements MorphologyReviewRepository {
  current = record();
  events: Array<{ action: string; previous: MorphologyRecord; result: MorphologyRecord }> = [];
  async get(recordId: string) { return recordId === this.current.id ? this.current : null; }
  async apply(input: { action: "approve" | "edit" | "reject"; previous: MorphologyRecord; result: MorphologyRecord }) {
    this.current = input.result;
    this.events.push({ action: input.action, previous: input.previous, result: input.result });
    return input.result;
  }
}

describe("MorphologyReviewService", () => {
  it("approves a derived candidate as verified and preserves an event snapshot", async () => {
    const repository = new MemoryRepository();
    const service = new MorphologyReviewService(repository);
    const result = await service.approve({ recordId, revision: 1, actorId: reviewerId });
    expect(result).toMatchObject({ confidence: "verified", reviewStatus: "approved", revision: 2 });
    expect(repository.events).toHaveLength(1);
    expect(repository.events[0]).toMatchObject({ action: "approve", previous: { confidence: "derived" }, result: { confidence: "verified" } });
  });

  it("edits segments only while promoting the candidate to verified", async () => {
    const repository = new MemoryRepository();
    const service = new MorphologyReviewService(repository);
    const result = await service.editAndApprove({
      recordId,
      revision: 1,
      actorId: reviewerId,
      segments: [
        { position: 0, kind: "root", surfaceForm: "spect", rootId: "spect", meaning: "look" },
        { position: 1, kind: "root", surfaceForm: "vis", rootId: "vis", meaning: "see" }
      ]
    });
    expect(result).toMatchObject({ confidence: "verified", reviewStatus: "approved", rootIds: ["spect", "vis"], revision: 2 });
    expect(result.segments).toHaveLength(2);
  });

  it("rejects with none, requires a reason, and prevents stale reviews", async () => {
    const repository = new MemoryRepository();
    const service = new MorphologyReviewService(repository);
    await expect(service.reject({ recordId, revision: 1, actorId: reviewerId, reason: "not teachable" }))
      .resolves.toMatchObject({ confidence: "none", reviewStatus: "rejected", revision: 2 });
    await expect(service.reject({ recordId, revision: 2, actorId: reviewerId, reason: "" })).rejects.toThrow("reason");
    await expect(service.approve({ recordId, revision: 1, actorId: reviewerId })).rejects.toThrow("stale");
  });

  it("does not allow a verified record to be weakened", async () => {
    const repository = new MemoryRepository();
    repository.current = record({ confidence: "verified", reviewStatus: "approved" });
    const service = new MorphologyReviewService(repository);
    await expect(service.reject({ recordId, revision: 1, actorId: reviewerId, reason: "undo" })).rejects.toThrow("verified");
  });
});
