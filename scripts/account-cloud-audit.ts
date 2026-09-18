import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

type AuditResult = { checks: number; missing: string[] };
type AuditCheck = { file: string; pattern?: RegExp; label: string };

const checks: AuditCheck[] = [
  { file: ".env.example", pattern: /NEXT_PUBLIC_SUPABASE_URL/, label: "public Supabase URL example" },
  { file: ".env.example", pattern: /SUPABASE_SERVICE_ROLE_KEY/, label: "server-only Supabase secret example" },
  { file: "proxy.ts", pattern: /createServerClient/, label: "session refresh proxy" },
  { file: "app/(auth)/login/page.tsx", label: "login page" },
  { file: "app/(auth)/register/page.tsx", label: "registration page" },
  { file: "app/(auth)/forgot-password/page.tsx", label: "forgot-password page" },
  { file: "app/(auth)/reset-password/page.tsx", label: "reset-password page" },
  { file: "app/auth/callback/route.ts", pattern: /exchangeCodeForSession/, label: "auth callback" },
  { file: "app/settings/account/page.tsx", label: "account settings page" },
  { file: "lib/auth/session.ts", pattern: /getUser\(\)/, label: "secure server auth check" },
  { file: "lib/repositories/contracts.ts", pattern: /LearnerRepository/, label: "learner repository contract" },
  { file: "lib/repositories/supabase/learner-repository.ts", label: "Supabase learner repository" },
  { file: "lib/repositories/supabase/reading-repository.ts", label: "Supabase reading repository" },
  { file: "lib/repositories/supabase/today-repository.ts", label: "Supabase Today repository" },
  { file: "lib/sync/local-snapshot.ts", pattern: /createLocalSnapshot/, label: "local migration snapshot" },
  { file: "app/api/migrations/local/route.ts", pattern: /requireVerifiedViewer/, label: "authenticated migration route" },
  { file: "lib/sync/offline-queue.ts", pattern: /flushSyncQueue/, label: "offline queue" },
  { file: "app/api/sync/operations/route.ts", pattern: /validateSyncOperation/, label: "validated sync route" },
  { file: "supabase/migrations/202609170001_account_learning.sql", pattern: /create table public\.profiles/, label: "profiles table" },
  { file: "supabase/migrations/202609170001_account_learning.sql", pattern: /create table public\.word_learning_states/, label: "learning-state table" },
  { file: "supabase/migrations/202609170001_account_learning.sql", pattern: /create table public\.learner_auxiliary_state/, label: "learner auxiliary table" },
  { file: "supabase/migrations/202609170001_account_learning.sql", pattern: /enable row level security/, label: "RLS enablement" },
  { file: "supabase/migrations/202609170001_account_learning.sql", pattern: /apply_sync_operation/, label: "transactional sync function" },
  { file: "supabase/tests/account_learning_rls.test.sql", pattern: /owner can insert/, label: "owner allow policy test" },
  { file: "supabase/tests/account_learning_rls.test.sql", pattern: /another user cannot/, label: "cross-user deny policy test" },
  { file: "supabase/tests/account_learning_rls.test.sql", pattern: /anonymous users cannot/, label: "anonymous deny policy test" },
  { file: "docs/account-cloud-setup.md", pattern: /Confirm Email/, label: "deployment and verification guide" }
];

export function runAccountCloudAudit(root: string): AuditResult {
  const missing: string[] = [];
  for (const check of checks) {
    const path = resolve(root, check.file);
    if (!existsSync(path)) {
      missing.push(`${check.label}: missing ${check.file}`);
      continue;
    }
    if (check.pattern && !check.pattern.test(readFileSync(path, "utf8"))) {
      missing.push(`${check.label}: expected content not found in ${check.file}`);
    }
  }
  return { checks: checks.length, missing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runAccountCloudAudit(process.cwd());
  if (result.missing.length > 0) {
    console.error(`Account/cloud audit failed (${result.missing.length}/${result.checks}):`);
    result.missing.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
  } else {
    console.log(`Account/cloud audit passed: ${result.checks} checks.`);
  }
}
