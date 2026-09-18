import { describe, it, expect } from "vitest";
import {
  ROOT_STAGES,
  getRootStage,
  advanceStage,
  calculateRootPriority,
  recommendTodayRoots,
  buildInferenceChallenge,
  scoreInference,
  selectRootQuestionType,
  buildRootChallenge,
  getRootRewards,
  type RootQuestionType,
} from "@/lib/learning/root-learning";
import { createRootProgress, EMPTY_STORAGE } from "@/lib/storage";
import { getRootById } from "@/data/roots";
import type { LearningStorage } from "@/types/progress";

const NOW = new Date("2026-09-18T00:00:00Z");

describe("4-stage flow", () => {
  it("starts at stage 1 for a new root", () => {
    expect(getRootStage(undefined)).toBe(1);
    expect(getRootStage(createRootProgress("spect"))).toBe(1);
  });

  it("advances one stage at a time and caps at 4", () => {
    let progress = createRootProgress("spect");
    progress = { ...progress, ...advanceStage(progress, NOW) };
    expect(progress.lastStage).toBe(1);
    expect(getRootStage(progress)).toBe(2);

    progress = { ...progress, ...advanceStage(progress, NOW) };
    progress = { ...progress, ...advanceStage(progress, NOW) };
    progress = { ...progress, ...advanceStage(progress, NOW) };
    expect(progress.lastStage).toBe(4);
    expect(getRootStage(progress)).toBe(4);
    expect(advanceStage(progress, NOW).lastStage).toBe(4); // no overflow
  });

  it("defines 4 ordered stages", () => {
    expect(ROOT_STAGES.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(ROOT_STAGES.map((s) => s.key)).toEqual(["recognise", "decompose", "expand", "test"]);
  });
});

describe("root priority", () => {
  const root = getRootById("spect")!;

  it("ranks a new root higher than a mastered one", () => {
    const fresh = calculateRootPriority({ root, progress: undefined, now: NOW });
    const mastered = calculateRootPriority({
      root,
      progress: { ...createRootProgress("spect"), status: "mastered", mastery: 90 },
      now: NOW,
    });
    expect(fresh).toBeGreaterThan(mastered);
  });

  it("an overdue in-progress root outranks a fresh one", () => {
    const fresh = calculateRootPriority({ root, progress: undefined, now: NOW });
    const overdue = calculateRootPriority({
      root,
      progress: {
        ...createRootProgress("spect"),
        status: "review",
        mastery: 40,
        nextReviewAt: new Date(NOW.getTime() - 48 * 3_600_000).toISOString(), // 2 days overdue
      },
      now: NOW,
    });
    expect(overdue).toBeGreaterThan(fresh);
  });
});

describe("today's root picks", () => {
  it("returns a small, ranked set", () => {
    const picks = recommendTodayRoots(EMPTY_STORAGE, 3, NOW);
    expect(picks).toHaveLength(3);
    expect(picks[0].id).toBe("spect"); // spect has the highest value + priority 1
  });

  it("returns fewer than the limit when the library is smaller", () => {
    const picks = recommendTodayRoots(EMPTY_STORAGE, 3, NOW);
    expect(picks.length).toBeLessThanOrEqual(3);
  });
});

describe("inference challenge", () => {
  it("picks an unseen word that shares the root", () => {
    const storage: LearningStorage = structuredClone(EMPTY_STORAGE);
    const challenge = buildInferenceChallenge("spect", storage);
    expect(challenge).not.toBeNull();
    expect(challenge!.root).toBe("spect");
    expect(challenge!.choices).toHaveLength(4);
    expect(challenge!.choices[challenge!.correctIndex]).toBeTruthy();
  });

  it("excludes already-attempted words", () => {
    const storage: LearningStorage = structuredClone(EMPTY_STORAGE);
    const first = buildInferenceChallenge("spect", storage)!;
    const second = buildInferenceChallenge("spect", storage, new Set([first.wordId]))!;
    expect(second.wordId).not.toBe(first.wordId);
  });

  it("returns null when the whole family is learned", () => {
    const storage: LearningStorage = structuredClone(EMPTY_STORAGE);
    for (const word of ["inspect", "respect", "expect", "suspect", "prospect", "spectator", "spectacle", "perspective", "aspect", "retrospect"]) {
      storage.words[word] = { ...storage.words[word], firstLearnedAt: NOW.toISOString() } as never;
    }
    expect(buildInferenceChallenge("spect", storage)).toBeNull();
  });
});

describe("inference scoring", () => {
  it("updates accuracy over attempts", () => {
    const fallback = createRootProgress("spect");
    const first = scoreInference(undefined, "correct", fallback);
    expect(first.inferenceAttempts).toBe(1);
    expect(first.inferenceCorrect).toBe(1);
    expect(first.inferenceScore).toBe(100);

    const progress = { ...fallback, ...first };
    const second = scoreInference(progress, "wrong", fallback);
    expect(second.inferenceAttempts).toBe(2);
    expect(second.inferenceCorrect).toBe(1);
    expect(second.inferenceScore).toBe(50);
  });
});

describe("adaptive question type", () => {
  it("picks the weakest skill", () => {
    const base = createRootProgress("spect");
    expect(selectRootQuestionType(base)).toBe("recognition"); // all 0 -> ties to recognition

    const weakInference = { ...base, recognitionScore: 80, derivationScore: 70, inferenceScore: 30 };
    expect(selectRootQuestionType(weakInference)).toBe("inference");

    const weakDerivation = { ...base, recognitionScore: 90, derivationScore: 10, inferenceScore: 50 };
    expect(selectRootQuestionType(weakDerivation)).toBe("derivation");
  });
});

describe("root challenge", () => {
  it("returns up to 4 unseen words, deterministically", () => {
    const a = buildRootChallenge(EMPTY_STORAGE, NOW, 4);
    const b = buildRootChallenge(EMPTY_STORAGE, NOW, 4);
    expect(a).toHaveLength(4);
    expect(a).toEqual(b);
    for (const item of a) {
      expect(item.root).toBeTruthy();
      expect(item.meaningZh).toBeTruthy();
    }
  });

  it("respects the requested count", () => {
    expect(buildRootChallenge(EMPTY_STORAGE, NOW, 3)).toHaveLength(3);
  });
});

describe("rewards", () => {
  it("counts mastered roots and unlocked words, no currency", () => {
    const storage: LearningStorage = structuredClone(EMPTY_STORAGE);
    storage.roots.spect = { ...createRootProgress("spect"), status: "mastered", mastery: 85, learnedWordIds: ["inspect", "respect"] };
    storage.words.inspect = { ...storage.words.inspect, firstLearnedAt: NOW.toISOString() } as never;

    const rewards = getRootRewards(storage);
    expect(rewards.masteredRoots).toBe(1);
    expect(rewards.unlockedWords).toBe(1);
    expect(rewards.totalRoots).toBe(20);
  });
});

describe("root question type typing", () => {
  it("exposes the three skill axes", () => {
    const types: RootQuestionType[] = ["recognition", "derivation", "inference"];
    expect(types).toHaveLength(3);
  });
});
