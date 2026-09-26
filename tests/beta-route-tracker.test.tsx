import { describe, expect, it } from "vitest";
import { getBetaRouteCategory } from "@/components/beta/beta-route-tracker";
import { readBetaLog, recordBetaEvent, setBetaParticipation } from "@/lib/beta/validation-store";

describe("allowlisted Beta route categories", () => {
  it("collapses dynamic paths to safe categories and ignores unrelated routes", () => {
    expect(getBetaRouteCategory("/today")).toBe("today");
    expect(getBetaRouteCategory("/reading")).toBe("reading");
    expect(getBetaRouteCategory("/reading/article/article-private-id")).toBe("reading-article");
    expect(getBetaRouteCategory("/reading/reinforcement/session-private-id")).toBe("reading-article");
    expect(getBetaRouteCategory("/progress")).toBe("progress");
    expect(getBetaRouteCategory("/settings/account")).toBeNull();
  });

  it("keeps bounded route timing aggregates without persisting dynamic paths", () => {
    localStorage.clear();
    setBetaParticipation("beta-user", true);
    for (let sample = 0; sample < 105; sample++) {
      recordBetaEvent("beta-user", "2026-09-26", {type: "route-timing", route: "reading-article", milliseconds: 12});
    }
    const log = readBetaLog("beta-user");
    expect(log.days[0].routeTimings["reading-article"]).toHaveLength(100);
    expect(JSON.stringify(log)).not.toContain("article-private-id");
  });
});
