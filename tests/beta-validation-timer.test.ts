import { beforeEach, describe, expect, it, vi } from "vitest";
import { readBetaLog, setBetaParticipation } from "@/lib/beta/validation-store";
import { attachBetaVisibilityTracking, pauseBetaActivity, resumeBetaActivity, startBetaActivity, switchBetaActivity } from "@/lib/beta/validation-timer";

describe("foreground Beta activity timer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T09:00:00.000Z"));
    setBetaParticipation("user-a", true);
  });

  it("records only active foreground duration across switch and pause/resume", () => {
    startBetaActivity("user-a", "2026-09-26", "block-a");
    vi.advanceTimersByTime(60_000);
    switchBetaActivity("user-a", "2026-09-26", "mini-review-a");
    vi.advanceTimersByTime(30_000);
    pauseBetaActivity("user-a", "2026-09-26");
    vi.advanceTimersByTime(10 * 60_000);
    resumeBetaActivity("user-a", "2026-09-26");
    vi.advanceTimersByTime(15_000);
    pauseBetaActivity("user-a", "2026-09-26");

    expect(readBetaLog("user-a").days[0]).toMatchObject({
      activeMilliseconds: 105_000,
      activityMilliseconds: { "block-a": 60_000, "mini-review-a": 45_000 },
    });
  });

  it("does not resume another account's persisted timer", () => {
    startBetaActivity("user-a", "2026-09-26", "block-a");
    vi.advanceTimersByTime(5_000);
    setBetaParticipation("user-b", true);
    resumeBetaActivity("user-b", "2026-09-26");
    vi.advanceTimersByTime(5_000);
    pauseBetaActivity("user-b", "2026-09-26");
    expect(readBetaLog("user-b").days).toHaveLength(0);
  });

  it("pauses on pagehide so a closing tab cannot accrue foreground time", () => {
    startBetaActivity("user-a", "2026-09-26", "block-a");
    vi.advanceTimersByTime(2_000);
    const detach = attachBetaVisibilityTracking("user-a", "2026-09-26");
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(60_000);
    detach();

    expect(readBetaLog("user-a").days[0].activeMilliseconds).toBe(2_000);
  });

  it("does not count time across a terminated browser document", async () => {
    startBetaActivity("user-a", "2026-09-26", "block-a");
    vi.advanceTimersByTime(60_000);
    vi.resetModules();
    const reloaded = await import("@/lib/beta/validation-timer");
    reloaded.startBetaActivity("user-a", "2026-09-26", "block-a");
    vi.advanceTimersByTime(1_000);
    reloaded.pauseBetaActivity("user-a", "2026-09-26");
    expect(readBetaLog("user-a").days[0].activeMilliseconds).toBe(1_000);
  });
});
