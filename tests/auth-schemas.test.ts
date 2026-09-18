import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema, safeReturnPath } from "@/lib/auth/schemas";

describe("auth form validation", () => {
  it("rejects malformed login fields", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "123" }).success).toBe(false);
  });

  it("accepts a strong matching registration", () => {
    expect(registerSchema.safeParse({
      email: "reader@example.com",
      password: "StrongPass1!",
      confirmPassword: "StrongPass1!"
    }).success).toBe(true);
  });

  it("rejects mismatched registration passwords", () => {
    expect(registerSchema.safeParse({
      email: "reader@example.com",
      password: "StrongPass1!",
      confirmPassword: "DifferentPass1!"
    }).success).toBe(false);
  });

  it("allows only same-origin relative return paths", () => {
    expect(safeReturnPath("/reading?from=today")).toBe("/reading?from=today");
    expect(safeReturnPath("https://evil.example/path")).toBe("/today");
    expect(safeReturnPath("//evil.example/path")).toBe("/today");
  });
});
