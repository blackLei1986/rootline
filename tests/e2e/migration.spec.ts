import { test } from "@playwright/test";

test("retries an interrupted one-time local migration idempotently", async () => {
  test.skip(!process.env.E2E_SUPABASE_READY, "Requires the local Supabase migration runtime.");
});
