import { describe, expect, it } from "vitest";
import { words } from "@/data/words";
import { buildOrchestratedSession, getNextBestLearningItem } from "@/lib/session-orchestrator";
import { createWordProgress, EMPTY_STORAGE } from "@/lib/storage";
import type { LearningSessionItem } from "@/types/session";

const now = new Date("2026-09-17T12:00:00.000Z");

describe("session orchestrator", () => {
  it("mixes word, phrase, sentence, quiz and review within the time budget", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.inspect = {
      ...createWordProgress("inspect"),
      status: "review",
      firstLearnedAt: "2026-09-01T00:00:00.000Z",
      nextReviewAt: "2026-09-16T00:00:00.000Z"
    };
    const session = buildOrchestratedSession({ storage, now, minutes: 20 });
    const types = new Set(session.items.map((item) => item.type));
    expect(types.has("word")).toBe(true);
    expect(types.has("phrase")).toBe(true);
    expect(types.has("sentence")).toBe(true);
    expect(types.has("quiz")).toBe(true);
    expect(types.has("review")).toBe(true);
    expect(session.estimatedSeconds).toBeLessThanOrEqual(20 * 60);
    const introduced = new Set(session.items.filter((item) => item.stage === "word-intro").map((item) => item.wordId));
    expect(session.items.filter((item) => item.type === "phrase" || item.type === "sentence").every((item) => introduced.has(item.wordId))).toBe(true);
  });

  it("avoids a third identical item type when another choice fits", () => {
    const recent: LearningSessionItem[] = [
      { id: "a", type: "word", stage: "word-intro" },
      { id: "b", type: "word", stage: "word-intro" }
    ];
    const word = { item: { id: "c", type: "word", stage: "word-intro" } as LearningSessionItem, priority: 100, estimatedSeconds: 10 };
    const sentence = { item: { id: "d", type: "sentence", stage: "sentence-reinforcement" } as LearningSessionItem, priority: 80, estimatedSeconds: 10 };
    expect(getNextBestLearningItem([word, sentence], recent, 20)?.item.type).toBe("sentence");
  });

  it("uses recovery mode without adding new words when backlog is extreme", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    for (const word of words.slice(0, 90)) {
      storage.words[word.id] = { ...createWordProgress(word.id), status: "review", firstLearnedAt: "2026-09-01T00:00:00.000Z", nextReviewAt: "2026-09-16T00:00:00.000Z" };
    }
    const session = buildOrchestratedSession({ storage, now, minutes: 20 });
    expect(session.recoveryMode).toBe(true);
    expect(session.newWordIds).toHaveLength(0);
    expect(session.reviewWordIds.length).toBeLessThanOrEqual(25);
  });
});
