import { describe, expect, it } from "vitest";
import { learningDateForTimeZone, shiftLearningDate } from "@/lib/today/local-date";

describe("Today local date boundaries", () => {
  it("uses the profile timezone rather than UTC for the learning date", () => {
    const instant = new Date("2026-09-24T16:30:00.000Z");
    expect(learningDateForTimeZone(instant, "Asia/Shanghai")).toBe("2026-09-25");
    expect(learningDateForTimeZone(instant, "America/Los_Angeles")).toBe("2026-09-24");
  });

  it("shifts ISO learning dates across month, year, and leap-day boundaries", () => {
    expect(shiftLearningDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftLearningDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftLearningDate("2026-09-23", 1)).toBe("2026-09-24");
  });

  it("rejects malformed local dates instead of silently drifting", () => {
    expect(() => shiftLearningDate("2026-02-31", -1)).toThrow("learning date");
  });
});
