// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminClient: {kind: "server-admin"},
  receivedClient: null as unknown,
  upserts: [] as Array<{userId: string; date: string; count: number; version: string}>
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({createAdminSupabaseClient: () => mocks.adminClient}));
vi.mock("@/lib/today/server-service", () => ({loadProductionVocabulary: async () => [{id: "adapt"}]}));
vi.mock("@/lib/repositories/supabase/progress-repository", () => ({
  SupabaseProgressRepository: class {
    constructor(client: unknown) {mocks.receivedClient = client;}
    async getProfileTimeZone() {return "Asia/Shanghai";}
    async getFirstPlanDate() {return null;}
    async getRecentPlanDays() {return [];}
    async getStreakPlanDays() {return [];}
    async getMatchingSessions() {return [];}
    async getWordStates() {return new Map();}
    async getPassiveWordIds() {return new Set(["adapt"]);}
    async getTrustedRootLinks() {return [];}
    async getSnapshots() {return [{learningDate: "2026-09-25", stableCount: 0}];}
    async upsertSnapshot(userId: string, date: string, count: number, version: string) {
      mocks.upserts.push({userId, date, count, version});
    }
    async countCompletedReadingPractice() {return 0;}
  }
}));

import { createProductionProgressService } from "@/lib/progress/server";

describe("production Progress wiring", () => {
  beforeEach(() => {mocks.receivedClient = null; mocks.upserts.length = 0;});

  it("uses the server admin client and production manifest version for an account snapshot", async () => {
    const dashboard = await createProductionProgressService()
      .getDashboard("00000000-0000-0000-0000-0000000000a1", new Date("2026-09-25T12:00:00Z"));
    expect(mocks.receivedClient).toBe(mocks.adminClient);
    expect(dashboard.vocabulary).toMatchObject({touched: 1, stable: 0});
    expect(mocks.upserts).toEqual([{userId: "00000000-0000-0000-0000-0000000000a1",
      date: "2026-09-25", count: 0, version: "2026.09.production-v2"}]);
  });
});
