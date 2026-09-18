import { describe, expect, it } from "vitest";
import { applyRecognitionResult, applyVerificationResult, ratingForRecognition, shouldScheduleKnownVerification } from "@/lib/recognition-progress";
import { createWordProgress } from "@/lib/storage";

describe("recognition progress", () => {
  it("schedules a self-reported known word into a long review interval without full teaching", () => {
    const next = applyRecognitionResult(createWordProgress("inspect"), "known", 1800, true, new Date("2026-09-17T00:00:00.000Z"));
    expect(next.status).toBe("review");
    expect(next.firstLearnedAt).toBeNull();
    expect(next.recognitionState).toBe("known");
    expect(next.recognitionConfidence).toBeLessThanOrEqual(70);
    expect(next.verificationDue).toBe(true);
    expect(next.reviewCount).toBe(1);
    expect(next.nextReviewAt).not.toBeNull();
    expect(next.intervalMinutes).toBeGreaterThan(0);
  });

  it("branches the interval by self-assessment (known > fuzzy > unknown)", () => {
    const known = applyRecognitionResult(createWordProgress("a"), "known", 1500, false);
    const fuzzy = applyRecognitionResult(createWordProgress("b"), "fuzzy", 1500, false);
    const unknown = applyRecognitionResult(createWordProgress("c"), "unknown", 1500, false);
    expect(known.intervalMinutes).toBeGreaterThan(fuzzy.intervalMinutes);
    expect(fuzzy.intervalMinutes).toBeGreaterThan(unknown.intervalMinutes);
  });

  it("maps self-assessment to FSRS grades", () => {
    expect(ratingForRecognition("known")).toBe("easy");
    expect(ratingForRecognition("fuzzy")).toBe("good");
    expect(ratingForRecognition("unknown")).toBe("again");
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

