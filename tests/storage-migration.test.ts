import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARNING_GOAL,
  EMPTY_STORAGE,
  STORAGE_VERSION,
  createWordProgress,
  migrateStorage
} from "@/lib/storage";

describe("progress storage v2", () => {
  it("keeps recognition and long-term learning state separate by default", () => {
    const progress = createWordProgress("significant");

    expect(progress.status).toBe("new");
    expect(progress.recognitionState).toBeNull();
    expect(progress.recognitionConfidence).toBe(0);
    expect(progress.fluencyScore).toBe(0);
    expect(progress.verificationDue).toBe(false);
  });

  it("migrates v1 progress without losing SRS history", () => {
    const migrated = migrateStorage({
      version: 1,
      words: {
        inspect: {
          wordId: "inspect",
          status: "review",
          reviewCount: 4,
          correctCount: 3,
          wrongCount: 1,
          streak: 2,
          lapses: 1,
          memoryStrength: 68,
          difficulty: 42,
          intervalMinutes: 4320,
          lastReviewedAt: "2026-09-15T08:00:00.000Z",
          nextReviewAt: "2026-09-18T08:00:00.000Z",
          firstLearnedAt: "2026-09-01T08:00:00.000Z",
          lastRating: "good"
        }
      },
      roots: {},
      dailyStats: {},
      settings: { dailyNewWordGoal: 12, dailyReviewGoal: 24 },
      transferStats: { attempts: 2, correct: 1 }
    });

    expect(migrated.version).toBe(STORAGE_VERSION);
    expect(migrated.words.inspect).toMatchObject({
      status: "review",
      reviewCount: 4,
      memoryStrength: 68,
      recognitionState: null,
      recognitionConfidence: 0,
      averageResponseTime: null
    });
    expect(migrated.settings).toEqual({
      dailyNewWordGoal: 12,
      dailyReviewGoal: 24,
      learningGoal: DEFAULT_LEARNING_GOAL
    });
    expect(migrated.transferStats).toEqual({ attempts: 2, correct: 1 });
  });

  it("fills missing nested learning-goal fields while preserving choices", () => {
    const migrated = migrateStorage({
      ...structuredClone(EMPTY_STORAGE),
      settings: {
        dailyNewWordGoal: 10,
        dailyReviewGoal: 18,
        learningGoal: { path: "ielts-toefl", sessionMinutes: 30 }
      }
    });

    expect(migrated.settings.learningGoal).toEqual({
      path: "ielts-toefl",
      vocabularyBand: "core-3000",
      sessionMinutes: 30,
      goalType: "understanding"
    });
  });
});
