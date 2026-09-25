import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${process.env.BETA_E2E_PORT ?? "3000"}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "if [ -n \"$E2E_SUPABASE_URL\" ]; then NEXT_PUBLIC_SUPABASE_URL=\"$E2E_SUPABASE_URL\" /Users/leipan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --webpack -p ${BETA_E2E_PORT:-3000}; else /Users/leipan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/next/dist/bin/next dev --webpack -p ${BETA_E2E_PORT:-3000}; fi",
    url: `http://127.0.0.1:${process.env.BETA_E2E_PORT ?? "3000"}`,
    reuseExistingServer: !process.env.BETA_E2E_PORT,
    timeout: 120_000
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
