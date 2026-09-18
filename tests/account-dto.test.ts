import { describe, expect, it } from "vitest";
import { toAccountDTO } from "@/lib/auth/account-dto";

describe("account DTO", () => {
  it("drops provider metadata that the account menu does not need", () => {
    expect(toAccountDTO({
      email: "reader@example.com",
      user_metadata: { display_name: "Reader", secret: "do-not-expose" }
    })).toEqual({ email: "reader@example.com", displayName: "Reader" });
  });

  it("normalizes a missing display name to null", () => {
    expect(toAccountDTO({ email: "reader@example.com", user_metadata: {} }))
      .toEqual({ email: "reader@example.com", displayName: null });
  });
});
