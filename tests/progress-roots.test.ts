import { describe, expect, it } from "vitest";
import { aggregateRootMastery } from "@/lib/progress/roots";
import { createWordProgress } from "@/lib/storage";
import type { ProgressWordState } from "@/lib/progress/types";

const now = new Date("2026-09-25T12:00:00Z");

describe("trusted root mastery", () => {
  it("deduplicates a Support Word within a root but allows a word in two roots", () => {
    const categories = new Map<string, ProgressWordState>([["inspect", "stable"], ["retract", "learning"]]);
    const states = new Map([["inspect", createWordProgress("inspect")],
      ["retract", createWordProgress("retract")]]);
    const rows = aggregateRootMastery([
      {rootId: "spect-id", rootKey: "spect", wordId: "inspect"},
      {rootId: "spect-id", rootKey: "spect", wordId: "inspect"},
      {rootId: "spect-id", rootKey: "spect", wordId: "retract"},
      {rootId: "tract-id", rootKey: "tract", wordId: "retract"}
    ], states, categories, now);
    expect(rows.find((row) => row.rootKey === "spect")).toMatchObject({usable: 2, learned: 2, stable: 1, percent: 50});
    expect(rows.find((row) => row.rootKey === "tract")).toMatchObject({usable: 1, learned: 1, stable: 0, percent: 0});
  });

  it("does not count a root-page view or passive touched word as learned", () => {
    const rows = aggregateRootMastery([
      {rootId: "spect-id", rootKey: "spect", wordId: "spectator"}
    ], new Map(), new Map([["spectator", "touched"]]), now);
    expect(rows[0]).toMatchObject({usable: 1, learned: 0, stable: 0, percent: 0});
  });

  it("shows at most three currently weak words, ordered by urgency", () => {
    const states = new Map(["overdue", "again-new", "again-old", "again-extra"].map((id) => {
      const state = createWordProgress(id);
      state.status = "review";
      state.nextReviewAt = id === "overdue" ? "2026-08-30T00:00:00Z" : "2026-10-01T00:00:00Z";
      state.lastRating = id === "overdue" ? "good" : "again";
      state.lastReviewedAt = id === "again-new" ? "2026-09-25T10:00:00Z" : "2026-09-24T10:00:00Z";
      return [id, state] as const;
    }));
    const rows = aggregateRootMastery([...states.keys()].map((wordId) =>
      ({rootId: "spect-id", rootKey: "spect", wordId})), states,
      new Map([...states.keys()].map((id) => [id, "learning" as const])), now);
    expect(rows[0].weakWordIds).toEqual(["overdue", "again-new", "again-extra"]);
  });

  it("does not keep a recovered historical lapse in the current weak list", () => {
    const recovered = createWordProgress("recovered");
    recovered.lapses = 3;
    recovered.lastRating = "good";
    recovered.fsrsState = 2;
    recovered.nextReviewAt = "2026-10-01T00:00:00Z";
    const rows = aggregateRootMastery([{rootId: "spect-id", rootKey: "spect", wordId: "recovered"}],
      new Map([["recovered", recovered]]), new Map([["recovered", "learning"]]), now);
    expect(rows[0].weakWordIds).toEqual([]);
  });
});
