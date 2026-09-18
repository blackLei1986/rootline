import { test } from "@playwright/test";

test("keeps feeds, articles, Today plans, and sessions isolated between two users", async () => {
  test.skip(!process.env.E2E_SUPABASE_READY, "Requires two verified local Supabase test users.");
});
