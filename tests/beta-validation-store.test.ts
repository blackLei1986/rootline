import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteBetaLog,
  exportBetaLog,
  getBetaParticipation,
  readBetaLog,
  recordBetaEvent,
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

  it("bounds journal text and removes account identity and content identifiers from export", async () => {
    setBetaParticipation("account-secret", true);
    recordBetaEvent("account-secret", "2026-09-26", {
      type: "journal",
      ratings: { difficulty: 4, fatigue: 3, rootUsefulness: 5, reviewUsefulness: 4 },
      continueTomorrow: true,
      note: `https://private.invalid/story article-secret word-secret ${"x".repeat(600)}`,
    });

    const exported = await exportBetaLog("account-secret").text();
    expect(exported).not.toContain("account-secret");
    expect(exported).not.toContain("word-secret");
    expect(exported).not.toContain("article-secret");
    expect(exported).not.toContain("https://private.invalid");
    const note = JSON.parse(exported).days[0].journal.note as string;
    expect(note.length).toBeLessThanOrEqual(500);
  });

  it("ignores malformed persisted schemas rather than exporting arbitrary local data", async () => {
    setBetaParticipation("account-a", true);
    localStorage.setItem("rootline:beta-validation:v1:log:account-a", JSON.stringify({ version: 9, days: [{ secret: "not-a-beta-record" }] }));

    expect(readBetaLog("account-a")).toEqual({ version: 1, days: [] });
    expect(await exportBetaLog("account-a").text()).not.toContain("not-a-beta-record");
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
});
