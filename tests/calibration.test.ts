import { describe, expect, it } from "vitest";
import { buildCalibrationSample, calculateCalibrationResult } from "@/lib/calibration";
import { words } from "@/data/words";

describe("vocabulary calibration", () => {
  it("samples across several vocabulary bands", () => {
    const sample = buildCalibrationSample(words, 30);
    expect(sample).toHaveLength(30);
    expect(new Set(sample.map((word) => word.vocabularyBand)).size).toBeGreaterThanOrEqual(4);
  });

  it("places broadly recognized vocabulary above an unknown profile", () => {
    const sample = buildCalibrationSample(words, 30);
    const strong = calculateCalibrationResult(sample.map((word) => ({ wordId: word.id, state: "known" as const })), words);
    const starting = calculateCalibrationResult(sample.map((word) => ({ wordId: word.id, state: "unknown" as const })), words);
    const order = ["core-1000", "core-2000", "core-3000", "core-5000", "academic", "advanced"];
    expect(order.indexOf(strong.estimatedBand)).toBeGreaterThan(order.indexOf(starting.estimatedBand));
  });
});
