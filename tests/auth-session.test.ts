import { describe, expect, it } from "vitest";
import { assertVerifiedViewer } from "@/lib/auth/policy";
import { toAuthMessage } from "@/lib/auth/errors";

describe("authentication safety", () => {
  it("does not disclose whether an email exists", () => {
    expect(toAuthMessage({ code: "invalid_credentials" })).toBe("邮箱或密码不正确。");
    expect(toAuthMessage({ code: "user_not_found" })).toBe("邮箱或密码不正确。");
  });

  it("rejects an unverified viewer", async () => {
    await expect(assertVerifiedViewer({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "reader@example.com",
      emailVerified: false
    })).rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });

  it("returns only the verified viewer DTO", async () => {
    const viewer = {
      userId: "00000000-0000-0000-0000-000000000001",
      email: "reader@example.com",
      emailVerified: true
    };

    await expect(assertVerifiedViewer(viewer)).resolves.toEqual(viewer);
  });
});
