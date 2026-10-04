import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  duplicate: false,
  existing: null as Record<string, unknown> | null,
  rows: [] as Array<Record<string, unknown>>,
  plans: [] as Array<Record<string, unknown>>,
  sessions: [] as Array<Record<string, unknown>>,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/http", () => ({ requireVerifiedViewerHttp: async () => ({ userId: "verified-owner", emailVerified: true }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabaseClient: () => ({
  from: (table: string) => ({
    insert: async (row: Record<string, unknown>) => {
      database.inserted.push(row);
      return { error: database.duplicate ? { code: "23505" } : null };
    },
    select: () => {
      const query = {
        eq: (column: string, value: unknown) => { database.filters.push([column, value]); return query; },
        order: () => query,
        maybeSingle: async () => ({ data: database.existing, error: null }),
        in: () => query,
        range: async () => ({ data: table === "today_plans" ? database.plans : table === "today_sessions" ? database.sessions : database.rows, error: null }),
      };
      return query;
    },
  }),
}) }));

import { GET, POST } from "@/app/api/beta/evidence/route";

const submission = {
  eventKey: "event:550e8400-e29b-41d4-a716-446655440000",
  learningDate: "2026-10-04",
  event: { type: "today-open" },
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/beta/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("Beta evidence HTTP boundary", () => {
  beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_BETA_EVIDENCE_ENABLED", "1"); database.inserted = []; database.duplicate = false; database.existing = null; database.rows = []; database.plans = []; database.sessions = []; database.filters = []; });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("keeps the endpoint closed when Web Beta server evidence is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_BETA_EVIDENCE_ENABLED", "0");
    expect((await POST(request(submission))).status).toBe(404);
    expect((await GET(new Request("http://localhost/api/beta/evidence"))).status).toBe(404);
    expect(database.inserted).toHaveLength(0);
  });

  it("derives account and commit on the server instead of trusting browser fields", async () => {
    const response = await POST(request(submission));
    expect(response.status).toBe(201);
    expect(database.inserted[0]).toMatchObject({ user_id: "verified-owner", event_key: submission.eventKey, learning_date: "2026-10-04", event_type: "today-open" });
    expect(database.inserted[0].deployment_commit).toEqual(expect.any(String));
  });

  it("rejects forged account fields before touching the database", async () => {
    const response = await POST(request({ ...submission, userId: "other-account" }));
    expect(response.status).toBe(400);
    expect(database.inserted).toHaveLength(0);
  });

  it("acknowledges exact retries but rejects a changed payload for the same event key", async () => {
    database.duplicate = true;
    database.existing = { learning_date: "2026-10-04", event_type: "today-open", payload: { type: "today-open" } };
    expect((await POST(request(submission))).status).toBe(200);
    database.existing = { learning_date: "2026-10-04", event_type: "progress-open", payload: { type: "progress-open" } };
    expect((await POST(request(submission))).status).toBe(409);
  });

  it("exports only the verified account's selected learning date from server rows", async () => {
    database.rows = [{ event_key: submission.eventKey, learning_date: "2026-10-04", event_type: "today-open", payload: { type: "today-open" }, deployment_commit: "beta-commit", recorded_at: "2026-10-04T01:00:00.000Z" }];
    const response = await GET(new Request("http://localhost/api/beta/evidence?date=2026-10-04"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ accountId: "verified-owner", days: [{ learningDate: "2026-10-04", todayOpens: 1 }] });
    expect(database.filters).toContainEqual(["user_id", "verified-owner"]);
    expect(database.filters).toContainEqual(["learning_date", "2026-10-04"]);
  });

  it("never verifies fabricated completion telemetry without an authoritative completed plan and session", async () => {
    database.rows = [{ event_key: "event:550e8400-e29b-41d4-a716-446655440000", learning_date: "2026-10-04", event_type: "session-completed", payload: { type: "session-completed" }, deployment_commit: "beta-commit", recorded_at: "2026-10-04T01:30:00.000Z" }];
    const unverified = await GET(new Request("http://localhost/api/beta/evidence"));
    expect((await unverified.json()).days[0]).toMatchObject({ todayCompletedFromEvents: true, todayCompletionVerified: false });
    database.plans = [{ id: "plan-1", learning_date: "2026-10-04", status: "complete", completed_at: "2026-10-04T01:29:00.000Z" }];
    database.sessions = [{ plan_id: "plan-1", status: "complete", completed_at: "2026-10-04T01:29:00.000Z" }];
    const verified = await GET(new Request("http://localhost/api/beta/evidence"));
    expect((await verified.json()).days[0]).toMatchObject({ todayCompletionVerified: true, authoritativeCompletedAt: "2026-10-04T01:29:00.000Z" });
  });
});
