import { describe, expect, it } from "vitest";
import { buildObservedGrowth } from "@/lib/progress/growth";

describe("observed stable-vocabulary growth", () => {
  it("does not invent a historical trend with zero or one observation", () => {
    expect(buildObservedGrowth([], "2026-09-25")).toEqual({points: [], hasTrend: false, firstObservedDate: null});
    expect(buildObservedGrowth([{learningDate: "2026-09-25", stableCount: 4}], "2026-09-25"))
      .toEqual({points: [{date: "2026-09-25", stable: 4}], hasTrend: false,
        firstObservedDate: "2026-09-25"});
  });

  it("keeps nonconsecutive observed dates and an honest decline without interpolation", () => {
    const result = buildObservedGrowth([
      {learningDate: "2026-09-25", stableCount: 8},
      {learningDate: "2026-09-28", stableCount: 5}
    ], "2026-09-28");
    expect(result).toEqual({points: [{date: "2026-09-25", stable: 8}, {date: "2026-09-28", stable: 5}],
      hasTrend: true, firstObservedDate: "2026-09-25"});
  });

  it("uses the latest supplied same-day observation and excludes future-dated rows", () => {
    const result = buildObservedGrowth([
      {learningDate: "2026-09-25", stableCount: 3},
      {learningDate: "2026-09-26", stableCount: 99},
      {learningDate: "2026-09-25", stableCount: 4}
    ], "2026-09-25");
    expect(result).toEqual({points: [{date: "2026-09-25", stable: 4}], hasTrend: false,
      firstObservedDate: "2026-09-25"});
  });
});
