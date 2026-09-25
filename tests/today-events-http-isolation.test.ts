import {describe, expect, it, vi} from "vitest";
import {TodayPlanNotFoundError} from "@/lib/today/events";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/http", () => ({requireVerifiedViewerHttp: async () => ({userId: "other", emailVerified: true})}));
vi.mock("@/lib/today/server-service", () => ({createProductionTodayEventService: () => ({getTodaySession: async () => {
  throw new TodayPlanNotFoundError();
}})}));

import {GET} from "@/app/api/today/events/route";

describe("Today cross-account read", () => {
  it("returns a sanitized 404 for a non-owned plan", async () => {
    const response = await GET(new Request("http://localhost/api/today/events?planId=550e8400-e29b-41d4-a716-446655440000"));
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("user");
  });
});
