import {describe, expect, it} from "vitest";
import {estimateRemainingMinutes} from "@/lib/today/remaining-effort";

describe("Today remaining effort", () => {
  it("uses the actual frozen target count for a proportional approximate estimate", () => {
    expect(estimateRemainingMinutes(30, 15, 30)).toBe(15);
    expect(estimateRemainingMinutes(30, 5, 23)).toBe(24);
    expect(estimateRemainingMinutes(30, 30, 30)).toBe(0);
  });

  it("does not invent a remaining-time estimate for missing targets or time", () => {
    expect(estimateRemainingMinutes(30, 0, 0)).toBeNull();
    expect(estimateRemainingMinutes(0, 5, 23)).toBeNull();
  });
});
