import { describe, expect, it } from "vitest";
import { runAccountCloudAudit } from "@/scripts/account-cloud-audit";

describe("account cloud audit", () => {
  it("finds every required account, policy, repository, migration, and sync boundary", () => {
    const result = runAccountCloudAudit(process.cwd());
    expect(result.missing, result.missing.join("\n")).toEqual([]);
    expect(result.checks).toBeGreaterThanOrEqual(20);
  });
});
