import {describe, expect, it, vi} from "vitest";
import {RepositoryError} from "@/lib/repositories/contracts";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/http", () => ({requireVerifiedViewerHttp: async () => ({userId: "owner", emailVerified: true})}));
vi.mock("@/lib/today/server-service", () => ({createProductionTodayEventService: () => ({recordTodayEvent: async () => {
  throw new RepositoryError("PERSISTENCE_UNAVAILABLE", "private persistence detail", {code: "40001", message: "private SQL detail"});
}})}));
vi.mock("@/lib/supabase/admin", () => ({createAdminSupabaseClient: () => ({})}));

import {POST} from "@/app/api/today/events/route";

describe("Today HTTP revision conflict", () => {
  it("returns a safe 409 for the Postgres revision guard", async () => {
    const response = await POST(new Request("http://localhost/api/today/events", {method: "POST", headers: {"content-type": "application/json"},
      body: JSON.stringify({operationId: "op-1", planId: "550e8400-e29b-41d4-a716-446655440000", type: "today_started", stage: "learn",
        occurredAt: "2026-09-25T12:00:00Z", expectedRevision: 0})}));
    expect(response.status).toBe(409);
    const body = await response.text();
    expect(body).toContain("今日进度已变化");
    expect(body).not.toContain("private");
  });
});
