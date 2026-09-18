import { describe, expect, it } from "vitest";
import { applyRecognitionResult, applyVerificationResult, shouldScheduleKnownVerification } from "@/lib/recognition-progress";
import { createWordProgress } from "@/lib/storage";

describe("recognition progress", () => {
  it("does not promote a self-reported known word into long-term learning", () => {
    const next = applyRecognitionResult(createWordProgress("inspect"), "known", 1800, true, new Date("2026-09-17T00:00:00.000Z"));
    expect(next.status).toBe("new");
    expect(next.firstLearnedAt).toBeNull();
    expect(next.recognitionState).toBe("known");
    expect(next.recognitionConfidence).toBeLessThanOrEqual(70);
    expect(next.verificationDue).toBe(true);
  });

  it("downgrades a failed known verification to fuzzy", () => {
    const known = applyRecognitionResult(createWordProgress("significant"), "known", 1200, true);
    const failed = applyVerificationResult(known, false);
    expect(failed.recognitionState).toBe("fuzzy");
    expect(failed.recognitionConfidence).toBeLessThan(known.recognitionConfidence);
    expect(failed.verificationWrongCount).toBe(1);
  });

  it("uses an injectable random source for stable verification sampling", () => {
    expect(shouldScheduleKnownVerification(undefined, () => 0.1)).toBe(true);
    expect(shouldScheduleKnownVerification(undefined, () => 0.9)).toBe(false);
  });
});
