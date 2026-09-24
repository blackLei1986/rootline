import { describe, expect, it } from "vitest";
import { readRecommendationProfileTimeZone } from "@/lib/reading/profile-time-zone";

describe("recommendation profile timezone lookup", () => {
  it("distinguishes a missing profile timezone from a failed database lookup", () => {
    expect(readRecommendationProfileTimeZone({ data: null, error: null })).toBeNull();
    expect(() => readRecommendationProfileTimeZone({ data: null, error: { code: "DB_UNAVAILABLE" } }))
      .toThrow("load recommendation learning timezone");
  });
});
