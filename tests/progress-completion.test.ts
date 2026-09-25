import { describe, expect, it } from "vitest";
import { calculateCompletion } from "@/lib/progress/completion";
import type { ProgressPlanDay, ProgressSessionDay } from "@/lib/progress/types";
import { learningDateForTimeZone, shiftLearningDate } from "@/lib/today/local-date";

function plan(date: string, overrides: Partial<ProgressPlanDay> = {}): ProgressPlanDay {
  return {
    id: `plan-${date}`, learningDate: date, generationVersion: 1, status: "complete",
    completedAt: `${date}T12:00:00Z`, requiredTargetIds: ["a", "b"], degradationReason: null,
    ...overrides
  };
}

function session(planId: string, overrides: Partial<ProgressSessionDay> = {}): ProgressSessionDay {
  return {planId, status: "complete", completedTargetIds: ["a", "b"], ...overrides};
}

describe("frozen Today completion", () => {
  it("uses the latest frozen generation and one eligible date for a first-day learner", () => {
    const older = plan("2026-09-25", {id: "older", generationVersion: 1, requiredTargetIds: ["a"]});
    const latest = plan("2026-09-25", {id: "latest", generationVersion: 2, status: "active", completedAt: null,
      requiredTargetIds: ["a", "b"], degradationReason: "Only two targets available"});
    const result = calculateCompletion([older, latest], [session("older", {completedTargetIds: ["a"]}),
      session("latest", {status: "active", completedTargetIds: ["a", "unrelated"]})], "2026-09-25", "2026-09-25");
    expect(result.today).toEqual({date: "2026-09-25", state: "active", completed: 1, required: 2,
      degradationReason: "Only two targets available"});
    expect(result.last7).toMatchObject({completed: 0, eligible: 1, percent: 0});
    expect(result.last30).toMatchObject({completed: 0, eligible: 1, percent: 0});
    expect(result.streak).toBe(0);
  });

  it("reports unavailable rates before the first saved Today plan", () => {
    const result = calculateCompletion([], [], null, "2026-09-25");
    expect(result.today).toMatchObject({state: "not-started", completed: 0, required: 0});
    expect(result.last7).toMatchObject({completed: 0, eligible: 0, percent: null, days: []});
    expect(result.last30.percent).toBeNull();
    expect(result.streak).toBe(0);
  });

  it("counts dates without a generated plan after learning began as eligible misses", () => {
    const first = plan("2026-09-23");
    const result = calculateCompletion([first], [session(first.id)], "2026-09-23", "2026-09-25");
    expect(result.last7).toMatchObject({completed: 1, eligible: 3, percent: 33});
    expect(result.last7.days.map((day) => [day.date, day.state])).toEqual([
      ["2026-09-23", "complete"], ["2026-09-24", "missing"], ["2026-09-25", "missing"]
    ]);
    expect(result.streak).toBe(0);
  });

  it("clips the 30-day window while preserving all-time streak input", () => {
    const outside = plan("2026-08-26");
    const inside = plan("2026-09-25");
    const result = calculateCompletion([outside, inside], [session(outside.id), session(inside.id)],
      "2026-08-26", "2026-09-25");
    expect(result.last30).toMatchObject({completed: 1, eligible: 30, percent: 3});
    expect(result.last30.days[0].date).toBe("2026-08-27");
    expect(result.last7).toMatchObject({completed: 1, eligible: 7, percent: 14});
  });

  it("does not complete a day from plan status or target count without its completed session", () => {
    const frozen = plan("2026-09-25");
    const result = calculateCompletion([frozen], [session(frozen.id, {status: "active"})],
      "2026-09-25", "2026-09-25");
    expect(result.today.state).toBe("active");
    expect(result.last7.completed).toBe(0);
  });

  it("allows today's unfinished plan as a grace day for yesterday's streak", () => {
    const yesterday = plan("2026-09-24");
    const today = plan("2026-09-25", {status: "active", completedAt: null});
    const result = calculateCompletion([yesterday, today], [session(yesterday.id), session(today.id, {status: "active"})],
      "2026-09-24", "2026-09-25");
    expect(result.streak).toBe(1);
    expect(result.last7).toMatchObject({completed: 1, eligible: 2, percent: 50});
  });

  it("uses calendar dates through leap day", () => {
    const feb = plan("2024-02-29");
    const mar = plan("2024-03-01");
    const result = calculateCompletion([feb, mar], [session(feb.id), session(mar.id)],
      "2024-02-29", "2024-03-01");
    expect(result.streak).toBe(2);
    expect(result.last7.days.map((day) => day.date)).toEqual(["2024-02-29", "2024-03-01"]);
  });

  it("counts a 45-day streak beyond the 30-day reporting window", () => {
    const dates = Array.from({length: 45}, (_, offset) => shiftLearningDate("2026-09-25", -offset));
    const plans = dates.map((date, index) => plan(date, {id: `p${index}`}));
    const sessions = plans.map((item) => session(item.id));
    expect(calculateCompletion(plans, sessions, "2026-08-12", "2026-09-25").streak).toBe(45);
  });

  it("keeps the stored learning date even when completion timestamp crosses UTC midnight", () => {
    expect(learningDateForTimeZone(new Date("2026-09-25T16:30:00Z"), "Asia/Shanghai"))
      .toBe("2026-09-26");
    const frozen = plan("2026-09-25", {completedAt: "2026-09-26T00:30:00Z"});
    const result = calculateCompletion([frozen], [session(frozen.id)], "2026-09-25", "2026-09-25");
    expect(result.today).toMatchObject({date: "2026-09-25", state: "complete"});
    expect(result.last7.completed).toBe(1);
  });
});
