import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteBetaLog,
  exportBetaLog,
  getBetaParticipation,
  readBetaLog,
  recordBetaEvent,
  recordTodayBetaTransition,
  setBetaParticipation,
} from "@/lib/beta/validation-store";

describe("private Beta validation store", () => {
  beforeEach(() => localStorage.clear());

  it("isolates participation and logs by verified account namespace", () => {
    setBetaParticipation("account-a", true);
    setBetaParticipation("account-b", false);
    recordBetaEvent("account-a", "2026-09-26", { type: "plan-observed", targetCount: 30 });
    recordBetaEvent("account-b", "2026-09-26", { type: "plan-observed", targetCount: 30 });

    expect(getBetaParticipation("account-a")).toBe(true);
    expect(getBetaParticipation("account-b")).toBe(false);
    expect(readBetaLog("account-a").days).toHaveLength(1);
    expect(readBetaLog("account-b").days).toHaveLength(0);
  });

  it("does not collect before opt-in and stores aggregates rather than event history", () => {
    recordBetaEvent("account-a", "2026-09-26", { type: "plan-observed", targetCount: 30 });
    expect(readBetaLog("account-a").days).toHaveLength(0);

    setBetaParticipation("account-a", true);
    recordBetaEvent("account-a", "2026-09-26", { type: "plan-observed", targetCount: 30 });
    const log = readBetaLog("account-a");
    expect(log.version).toBe(1);
    expect(log.days[0]).toMatchObject({ learningDate: "2026-09-26", planObserved: true, targetCount: 30 });
    expect(JSON.stringify(log)).not.toContain('"events"');
  });

  it("rejects impossible learning dates rather than creating malformed daily aggregates", () => {
    setBetaParticipation("account-a", true);
    recordBetaEvent("account-a", "2026-99-99", {type: "plan-observed", targetCount: 30});
    expect(readBetaLog("account-a").days).toHaveLength(0);
  });

  it("bounds journal text and removes account identity and content identifiers from export", async () => {
    setBetaParticipation("account-secret", true);
    recordBetaEvent("account-secret", "2026-09-26", {
      type: "journal",
      ratings: { difficulty: 4, fatigue: 3, rootUsefulness: 5, reviewUsefulness: 4 },
      continueTomorrow: true,
      note: `https://private.invalid/story article-secret word-secret 550e8400-e29b-41d4-a716-446655440000 ${"x".repeat(600)}`,
    });

    const exported = await exportBetaLog("account-secret").text();
    expect(exported).not.toContain("account-secret");
    expect(exported).not.toContain("word-secret");
    expect(exported).not.toContain("article-secret");
    expect(exported).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(exported).not.toContain("https://private.invalid");
    const note = JSON.parse(exported).days[0].journal.note as string;
    expect(note.length).toBeLessThanOrEqual(500);
  });

  it("preserves malformed persisted data instead of silently overwriting it", async () => {
    setBetaParticipation("account-a", true);
    localStorage.setItem("rootline:beta-validation:v1:log:account-a", JSON.stringify({ version: 9, days: [{ secret: "not-a-beta-record" }] }));

    expect(readBetaLog("account-a")).toEqual({ version: 1, days: [] });
    expect(await exportBetaLog("account-a").text()).not.toContain("not-a-beta-record");
    recordBetaEvent("account-a", "2026-09-26", {type: "plan-observed", targetCount: 30});
    expect(localStorage.getItem("rootline:beta-validation:v1:log:account-a")).toContain("not-a-beta-record");
  });

  it("exports only allowlisted schema fields even if local storage has unknown properties", async () => {
    setBetaParticipation("account-a", true);
    recordBetaEvent("account-a", "2026-09-26", {type: "plan-observed", targetCount: 30});
    const key = "rootline:beta-validation:v1:log:account-a";
    const persisted = JSON.parse(localStorage.getItem(key) ?? "{}");
    persisted.email = "private@example.invalid";
    persisted.days[0].articleTitle = "private article title";
    localStorage.setItem(key, JSON.stringify(persisted));

    const exported = await exportBetaLog("account-a").text();
    expect(exported).not.toContain("private@example.invalid");
    expect(exported).not.toContain("private article title");
  });

  it("deletes only the selected account's participation and validation data", () => {
    setBetaParticipation("account-a", true);
    setBetaParticipation("account-b", true);
    recordBetaEvent("account-a", "2026-09-26", { type: "plan-observed", targetCount: 30 });
    recordBetaEvent("account-b", "2026-09-26", { type: "plan-observed", targetCount: 30 });

    deleteBetaLog("account-a");
    expect(getBetaParticipation("account-a")).toBe(false);
    expect(readBetaLog("account-a").days).toHaveLength(0);
    expect(getBetaParticipation("account-b")).toBe(true);
    expect(readBetaLog("account-b").days).toHaveLength(1);
  });

  it("removes a deleted account's in-flight Beta timer", async () => {
    const {startBetaActivity} = await import("@/lib/beta/validation-timer");
    setBetaParticipation("account-a", true);
    startBetaActivity("account-a", "2026-09-26", "block-a");
    expect(Array.from({length: localStorage.length}, (_, index) => localStorage.key(index)).some((key) => key?.startsWith("rootline:beta-validation:timer:v1:account-a:"))).toBe(true);
    deleteBetaLog("account-a");
    setBetaParticipation("account-a", true);
    const {pauseBetaActivity} = await import("@/lib/beta/validation-timer");
    pauseBetaActivity("account-a", "2026-09-26");
    expect(readBetaLog("account-a").days).toHaveLength(0);
  });

  it("applies each confirmed Today event revision only once", () => {
    setBetaParticipation("account-a", true);
    recordTodayBetaTransition("account-a", "2026-09-26", 4, { type: "review-outcome", kind: "mini", source: "root-core", correct: true });
    recordTodayBetaTransition("account-a", "2026-09-26", 4, { type: "review-outcome", kind: "mini", source: "root-core", correct: true });
    recordTodayBetaTransition("account-a", "2026-09-26", 5, { type: "review-outcome", kind: "final", source: "root-core", correct: false });
    recordTodayBetaTransition("account-a", "2026-09-26", 6, { type: "review-outcome", kind: "mini", source: "carryover", originSource: "root-core", correct: false });

    expect(readBetaLog("account-a").days[0].reviewOutcomes["mini:root-core:root-core"]).toEqual({ correct: 1, total: 1 });
    expect(readBetaLog("account-a").days[0].reviewOutcomes["final:root-core:root-core"]).toEqual({ correct: 0, total: 1 });
    expect(readBetaLog("account-a").days[0].reviewOutcomes["mini:carryover:root-core"]).toEqual({ correct: 0, total: 1 });
  });

  it("counts distinct confirmed review revisions even when responses arrive out of order", () => {
    setBetaParticipation("account-a", true);
    recordTodayBetaTransition("account-a", "2026-09-26", 9, {type: "review-outcome", kind: "final", source: "support", correct: true});
    recordTodayBetaTransition("account-a", "2026-09-26", 8, {type: "review-outcome", kind: "mini", source: "support", correct: false});
    recordTodayBetaTransition("account-a", "2026-09-26", 8, {type: "review-outcome", kind: "mini", source: "support", correct: false});
    const outcomes = readBetaLog("account-a").days[0].reviewOutcomes;
    expect(outcomes["final:support:support"]).toEqual({correct: 1, total: 1});
    expect(outcomes["mini:support:support"]).toEqual({correct: 0, total: 1});
  });

  it("keeps new-word totals separate from original source counts", () => {
    setBetaParticipation("account-a", true);
    recordBetaEvent("account-a", "2026-09-26", {type: "plan-observed", targetCount: 30, newWordCount: 20, sourceCounts: {carryover: 5, weak: 5, "root-core": 12, support: 13}});
    expect(readBetaLog("account-a").days[0]).toMatchObject({newWordCount: 20, sourceCounts: {carryover: 5, weak: 5, "root-core": 12, support: 13}});
  });

  it("counts a Reading session once across dates without exporting its deduplication token", async () => {
    setBetaParticipation("account-a", true);
    recordBetaEvent("account-a", "2026-09-26", {type: "reading-completed", sessionId: "private-session-1"});
    recordBetaEvent("account-a", "2026-09-27", {type: "reading-completed", sessionId: "private-session-1"});
    expect(readBetaLog("account-a").days.reduce((sum, day) => sum + day.readingCompletions, 0)).toBe(1);
    expect(readBetaLog("account-a").days).toHaveLength(1);
    const exported = await exportBetaLog("account-a").text();
    expect(exported).not.toContain("private-session-1");
    expect(exported).not.toContain("readingCompletionTokens");
  });
});
