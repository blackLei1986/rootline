import {beforeEach, describe, expect, it, vi} from "vitest";

const viewer = {userId: "owner-1", email: "reader@example.com", emailVerified: true};
const db = vi.hoisted(() => ({select: vi.fn(), update: vi.fn()}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({requireVerifiedViewer: async () => viewer}));
vi.mock("@/lib/supabase/server", () => ({createServerSupabaseClient: async () => ({from: (name: string) => ({
  select: (columns: string) => db.select(name, columns), update: (values: unknown) => db.update(name, values)
})})}));

import {getCurrentAccount, updateCurrentTimeZone} from "@/lib/auth/account";

beforeEach(() => {
  db.select.mockReset(); db.update.mockReset();
  db.select.mockImplementation((name: string) => ({eq: () => ({
    maybeSingle: async () => ({data: name === "profiles" ? {display_name: "Reader", timezone: "Asia/Shanghai"} : {daily_time_budget: 30}, error: null})
  })}));
  db.update.mockImplementation(() => ({eq: vi.fn(async () => ({error: null}))}));
});

describe("Me timezone persistence", () => {
  it("reads the scoped profile and persisted daily-time preference", async () => {
    await expect(getCurrentAccount()).resolves.toEqual({email: viewer.email, displayName: "Reader", timeZone: "Asia/Shanghai", dailyTimeBudget: 30});
    expect(db.select).toHaveBeenCalledWith("profiles", "display_name,timezone");
    expect(db.select).toHaveBeenCalledWith("user_preferences", "daily_time_budget");
  });

  it("rejects malformed zones before any database write", async () => {
    for (const zone of ["Mars/Olympus", "", "x".repeat(65)]) {
      await expect(updateCurrentTimeZone(zone)).rejects.toThrow("请选择有效的学习时区。");
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("writes a valid IANA timezone only to the verified owner", async () => {
    await updateCurrentTimeZone("America/New_York");
    expect(db.update).toHaveBeenCalledWith("profiles", {timezone: "America/New_York"});
    expect(db.update.mock.results[0].value.eq).toHaveBeenCalledWith("user_id", "owner-1");
  });
});
