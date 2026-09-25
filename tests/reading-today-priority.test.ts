import {beforeEach, describe, expect, it, vi} from "vitest";

const db = vi.hoisted(() => ({getProfileTimeZone: vi.fn(), getRecentPlanDays: vi.fn(), getMatchingSessions: vi.fn()}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({createAdminSupabaseClient: () => ({})}));
vi.mock("@/lib/repositories/supabase/progress-repository", () => ({SupabaseProgressRepository: class {
  getProfileTimeZone = db.getProfileTimeZone;
  getRecentPlanDays = db.getRecentPlanDays;
  getMatchingSessions = db.getMatchingSessions;
}}));

import {shouldEmphasizeToday} from "@/lib/reading/today-priority";

const now = new Date("2026-09-25T00:30:00Z");
const plan = {id: "p1", learningDate: "2026-09-24", generationVersion: 1, status: "complete", completedAt: "2026-09-24T00:00:00Z", requiredTargetIds: ["a"], degradationReason: null};

beforeEach(() => {
  db.getProfileTimeZone.mockReset().mockResolvedValue("America/Los_Angeles");
  db.getRecentPlanDays.mockReset().mockResolvedValue([]);
  db.getMatchingSessions.mockReset().mockResolvedValue([]);
});

describe("Reading Today priority", () => {
  it("emphasizes Today when no plan exists without creating one", async () => {
    expect(await shouldEmphasizeToday("owner", now)).toBe(true);
    expect(db.getRecentPlanDays).toHaveBeenCalledWith("owner", "2026-09-24", "2026-09-24");
    expect(db.getMatchingSessions).not.toHaveBeenCalled();
  });

  it("does not emphasize Today when the profile-local plan and session are complete", async () => {
    db.getRecentPlanDays.mockResolvedValue([plan]);
    db.getMatchingSessions.mockResolvedValue([{planId: "p1", status: "complete", completedTargetIds: ["a"]}]);
    expect(await shouldEmphasizeToday("owner", now)).toBe(false);
    expect(db.getMatchingSessions).toHaveBeenCalledWith("owner", ["p1"]);
  });

  it("keeps Today prominent if only the plan says complete", async () => {
    db.getRecentPlanDays.mockResolvedValue([plan]);
    db.getMatchingSessions.mockResolvedValue([{planId: "p1", status: "active", completedTargetIds: []}]);
    expect(await shouldEmphasizeToday("owner", now)).toBe(true);
  });
});
