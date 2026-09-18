// @vitest-environment node

import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "@/lib/jobs/cron-auth";

describe("cron authorization", () => {
  it("rejects missing and invalid bearer secrets", () => {
    expect(authorizeCronRequest(null, "correct-secret")).toBe(false);
    expect(authorizeCronRequest("Bearer wrong-secret", "correct-secret")).toBe(false);
  });

  it("accepts exactly the configured bearer secret", () => {
    expect(authorizeCronRequest("Bearer correct-secret", "correct-secret")).toBe(true);
  });
});
