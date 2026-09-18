import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/config/env";

describe("Supabase environment", () => {
  it("accepts a complete public configuration", () => {
    const result = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key"
    });

    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
    expect(result.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("publishable-key");
  });

  it("rejects an empty service-role key", () => {
    expect(() => parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: ""
    })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("defaults cloud learning off until explicitly enabled", () => {
    const result = parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      CRON_SECRET: "cron-secret",
      FEED_FETCH_CONTACT: "admin@example.com"
    });

    expect(result.CLOUD_LEARNING_ENABLED).toBe(false);
    expect(result.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
});
