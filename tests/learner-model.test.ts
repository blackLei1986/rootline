import { describe, expect, it } from "vitest";
import { buildLearnerModel } from "@/lib/learner-model";
import { createWordProgress, EMPTY_STORAGE } from "@/lib/storage";

describe("learner model", () => {
  it("summarizes verification, speed, retention and preferred session length", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.settings.learningGoal.sessionMinutes = 30;
    storage.words.inspect = {
      ...createWordProgress("inspect"),
      knownCount: 2,
      verificationCorrectCount: 2,
      averageResponseTime: 1600,
      correctCount: 4,
      wrongCount: 1,
      memoryStrength: 70
    };
    const model = buildLearnerModel(storage);
    expect(model.recognitionAccuracy).toBe(100);
    expect(model.selfRatingCalibration).toBe(100);
    expect(model.responseSpeed).toBeGreaterThan(90);
    expect(model.retention).toBeGreaterThan(70);
    expect(model.preferredSessionLength).toBe(30);
  });
});
