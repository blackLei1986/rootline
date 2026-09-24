import { describe, expect, it, vi } from "vitest";
import { createDailyReadingRecommendationsGetHandler } from "@/lib/reading/daily-reading-recommendations-http";

const result = { learningDate: "2026-09-25", algorithmVersion: "daily-3-v1", generatedAt: "2026-09-24T16:30:00.000Z", recommendations: [] };

describe("daily reading recommendations HTTP boundary", () => {
  it("rejects unauthenticated requests before invoking the service", async () => {
    const unauthorized = Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    const getForToday = vi.fn();
    const handler = createDailyReadingRecommendationsGetHandler({
      requireViewer: async () => unauthorized,
      service: { getForToday }
    });
    const response = await handler(new Request("https://rootline.test/api/reading/recommendations"));
    expect(response).toBe(unauthorized);
    expect(getForToday).not.toHaveBeenCalled();
  });

  it("uses the verified session identity and ignores caller-supplied user/date overrides", async () => {
    const getForToday = vi.fn(async () => result);
    const handler = createDailyReadingRecommendationsGetHandler({
      requireViewer: async () => ({ userId: "verified-owner", email: "owner@example.test", emailVerified: true }),
      service: { getForToday }
    });
    const response = await handler(new Request("https://rootline.test/api/reading/recommendations?userId=attacker&date=1900-01-01"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(getForToday).toHaveBeenCalledWith("verified-owner");
  });

  it("returns a generic unavailable response when recommendation data sources fail", async () => {
    const handler = createDailyReadingRecommendationsGetHandler({
      requireViewer: async () => ({ userId: "verified-owner", email: "owner@example.test", emailVerified: true }),
      service: { getForToday: async () => { throw new Error("database detail must not leak"); } }
    });
    const response = await handler(new Request("https://rootline.test/api/reading/recommendations"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "READING_RECOMMENDATIONS_UNAVAILABLE" });
  });
});
