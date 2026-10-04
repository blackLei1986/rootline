import { describe, expect, it } from "vitest";
import { parseBetaEvidenceSubmission } from "@/lib/beta/evidence-schema";

const base = {
  eventKey: "event:550e8400-e29b-41d4-a716-446655440000",
  learningDate: "2026-10-04",
};

describe("Beta server evidence input", () => {
  it("accepts a bounded review outcome without account identity from the browser", () => {
    expect(parseBetaEvidenceSubmission({
      ...base,
      event: { type: "review-outcome", kind: "mini", source: "carryover", originSource: "root-core", correct: true },
    })).toMatchObject({
      eventKey: base.eventKey,
      learningDate: base.learningDate,
      event: { type: "review-outcome", kind: "mini", source: "carryover", originSource: "root-core", correct: true },
    });
  });

  it("rejects account spoofing, unknown fields, invalid dates and unbounded durations", () => {
    expect(() => parseBetaEvidenceSubmission({ ...base, userId: "another-user", event: { type: "today-open" } })).toThrow();
    expect(() => parseBetaEvidenceSubmission({ ...base, learningDate: "2026-02-30", event: { type: "today-open" } })).toThrow();
    expect(() => parseBetaEvidenceSubmission({ ...base, event: { type: "activity-duration", activity: "block-a", milliseconds: 90_000_000 } })).toThrow();
  });

  it("sanitizes and limits optional Journal text before it reaches the database", () => {
    const parsed = parseBetaEvidenceSubmission({ ...base, event: {
      type: "journal",
      ratings: { difficulty: 4, fatigue: 3, rootUsefulness: 5, reviewUsefulness: 4 },
      continueTomorrow: true,
      note: `https://private.invalid/story person@example.invalid ${"x".repeat(600)}`,
    } });
    if (parsed.event.type !== "journal") throw new Error("expected journal");
    expect(parsed.event.note).not.toContain("https://private.invalid");
    expect(parsed.event.note).not.toContain("person@example.invalid");
    expect(parsed.event.note.length).toBeLessThanOrEqual(500);
  });

  it("accepts deterministic Today revision keys while forbidding arbitrary identifiers", () => {
    expect(parseBetaEvidenceSubmission({
      eventKey: "today:2026-10-04:17",
      learningDate: "2026-10-04",
      event: { type: "session-started" },
    }).eventKey).toBe("today:2026-10-04:17");
    expect(parseBetaEvidenceSubmission({
      eventKey: "today-complete:2026-10-04:17",
      learningDate: "2026-10-04",
      event: { type: "session-completed" },
    }).eventKey).toBe("today-complete:2026-10-04:17");
    expect(() => parseBetaEvidenceSubmission({ ...base, eventKey: "today-complete:2026-10-05:17", event: { type: "session-completed" } })).toThrow();
    expect(() => parseBetaEvidenceSubmission({ ...base, eventKey: "../../private", event: { type: "today-open" } })).toThrow();
  });
});
