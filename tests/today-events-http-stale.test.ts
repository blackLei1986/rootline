import {describe, expect, it, vi} from "vitest";
import {TodayEventConflictError} from "@/lib/today/events";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/http", () => ({requireVerifiedViewerHttp: async () => ({userId: "owner", emailVerified: true})}));
vi.mock("@/lib/today/server-service", () => ({createProductionTodayEventService: () => ({recordTodayEvent: async () => {
  throw new TodayEventConflictError();
}})}));
vi.mock("@/lib/supabase/admin", () => ({createAdminSupabaseClient: () => ({})}));

import {POST} from "@/app/api/today/events/route";

describe("Today stale-tab HTTP conflict", () => {
  it("returns a sanitized 409", async () => {
    const response = await POST(new Request("http://localhost/api/today/events", {method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({operationId: "op-stale", planId: "550e8400-e29b-41d4-a716-446655440000", type: "target_recognized",
        targetId: "word-0", block: 1, recognitionState: "known", stage: "learn",
        occurredAt: "2026-09-25T12:00:00Z", expectedRevision: 0})}));
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("今日进度已变化");
  });
});
