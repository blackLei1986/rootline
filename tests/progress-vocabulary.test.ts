import { describe, expect, it } from "vitest";
import { classifyProgressVocabulary } from "@/lib/progress/vocabulary";
import { createWordProgress } from "@/lib/storage";
import { applyRecognitionResult } from "@/lib/recognition-progress";
import type { WordProgress } from "@/types/progress";

const now = new Date("2026-09-25T12:00:00Z");

function stableWord(id: string): WordProgress {
  return {...createWordProgress(id), status: "review", firstLearnedAt: "2026-09-20T12:00:00Z",
    lastReviewedAt: "2026-09-22T12:00:00Z", nextReviewAt: "2026-10-01T12:00:00Z",
    correctCount: 2, memoryStrength: 60, lastRating: "good"};
}

describe("Progress vocabulary classification", () => {
  it("counts passive Reading once as touched but never as stable or learning", () => {
    const result = classifyProgressVocabulary(new Set(["adapt"]), new Map(), new Set(["adapt"]), now);
    expect(result).toMatchObject({touched: 1, learning: 0, stable: 0, stablePercent: 0});
    expect([...result.byWordId]).toEqual([["adapt", "touched"]]);
  });

  it("keeps recognition-only and unseen state rows out of stable and learning", () => {
    const recognition = {...createWordProgress("inspect"), recognitionState: "known" as const,
      recognitionCount: 1, knownCount: 1};
    const states = new Map([["inspect", recognition], ["unseen", createWordProgress("unseen")]]);
    const result = classifyProgressVocabulary(new Set(["inspect", "unseen"]), states, new Set(), now);
    expect(result).toMatchObject({touched: 1, learning: 0, stable: 0});
    expect([...result.byWordId]).toEqual([["inspect", "touched"]]);
  });

  it("keeps a recognition click touched even when it schedules an SRS review", () => {
    const recognized = applyRecognitionResult(createWordProgress("inspect"), "known", 900, true, now);
    const result = classifyProgressVocabulary(new Set(["inspect"]), new Map([["inspect", recognized]]),
      new Set(["inspect"]), now);
    expect(result).toMatchObject({touched: 1, learning: 0, stable: 0});
    expect(result.byWordId.get("inspect")).toBe("touched");
  });

  it("uses the shared delayed-review stable predicate and one category per catalog word", () => {
    const supportWord = stableWord("spectator");
    const learning = {...createWordProgress("retract"), status: "learning" as const,
      firstLearnedAt: "2026-09-25T08:00:00Z", correctCount: 1};
    const states = new Map([["spectator", supportWord], ["retract", learning],
      ["old-legacy", stableWord("old-legacy")]]);
    const result = classifyProgressVocabulary(new Set(["spectator", "retract", "adapt"]), states,
      new Set(["spectator", "adapt", "adapt", "old-legacy"]), now);
    expect(result).toMatchObject({touched: 1, learning: 1, stable: 1, stablePercent: 0});
    expect([...result.byWordId].sort()).toEqual([
      ["adapt", "touched"], ["retract", "learning"], ["spectator", "stable"]
    ]);
  });

  it("reports conservative one-decimal progress against 10,000, not catalog size", () => {
    const ids = Array.from({length: 1_284}, (_, index) => `word-${index}`);
    const states = new Map(ids.map((id): [string, WordProgress] => [id, stableWord(id)]));
    const result = classifyProgressVocabulary(new Set(ids), states, new Set(), now);
    expect(result.stable).toBe(1_284);
    expect(result.stablePercent).toBe(12.8);
  });

  it("demotes an overdue or failed word instead of freezing its former stable count", () => {
    const failed = {...stableWord("adapt"), lastRating: "again" as const};
    const overdue = {...stableWord("inspect"), nextReviewAt: "2026-09-01T00:00:00Z"};
    const result = classifyProgressVocabulary(new Set(["adapt", "inspect"]),
      new Map<string, WordProgress>([["adapt", failed], ["inspect", overdue]]), new Set(), now);
    expect(result).toMatchObject({stable: 0, learning: 2});
  });
});
