import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Minimal Supabase connection check.
 *
 * Verifies both halves of the connection without touching the database schema:
 *   1. Public (browser) side  -> GET {url}/auth/v1/settings  using the publishable key.
 *   2. Admin  (server) side   -> GET {url}/rest/v1/          using the service_role key.
 *
 * A 200 from each means the project URL is reachable and the key is accepted by
 * the Auth / PostgREST gateways respectively. No tables are required.
 */

function loadDotEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const content = readFileSync(path, "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    // missing file -> rely on process.env only
  }
  return out;
}

async function check(
  label: string,
  url: string,
  key: string
): Promise<boolean> {
  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  const ok = res.status === 200;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: HTTP ${res.status}`);
  return ok;
}

async function main(): Promise<void> {
  const env = { ...process.env, ...loadDotEnv(resolve(process.cwd(), ".env.local")) };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("Supabase connection verification");
  let ok = true;

  if (!url) {
    console.log("  FAIL  NEXT_PUBLIC_SUPABASE_URL is not set");
    ok = false;
  }
  if (!publishableKey) {
    console.log("  FAIL  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
    ok = false;
  }

  if (url && publishableKey) {
    ok = (await check("public  (publishable key) /auth/v1/settings", `${url}/auth/v1/settings`, publishableKey)) && ok;
  }

  if (url && serviceRoleKey) {
    ok = (await check("admin   (service_role key) /rest/v1/", `${url}/rest/v1/`, serviceRoleKey)) && ok;
  } else if (url) {
    console.log("  SKIP  admin (service_role key) /rest/v1/: SUPABASE_SERVICE_ROLE_KEY not set");
  }

  if (!ok) {
    console.error("\nResult: FAILED");
    process.exitCode = 1;
  } else {
    console.log("\nResult: OK — Supabase is reachable and both keys are accepted.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Unexpected error:", error);
    process.exitCode = 1;
  });
}
