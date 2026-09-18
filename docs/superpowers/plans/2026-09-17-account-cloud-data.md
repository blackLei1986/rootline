# Account and Cloud Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified-email accounts and make Supabase the authoritative store for private learning data without breaking the existing guest experience.

**Architecture:** Supabase Auth supplies cookie-backed sessions. A server-only DAL and narrow repositories enforce authorization and return DTOs; browser-local stores remain the guest source and become a one-time migration source plus an offline write queue after login.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.3, TypeScript 6, Supabase Auth/PostgreSQL/RLS, Zod 4, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-17-account-rss-today-design.md`

## Global Constraints

- Open registration requires email confirmation before a cloud-write-capable session exists.
- Guests can browse and run non-persistent Reading analysis; persistent learning actions require login.
- UI modules never query Supabase tables directly.
- Every server action and route handler authenticates, validates input, and returns a minimal DTO.
- Every exposed private table enables RLS and isolates rows with `auth.uid() = user_id`.
- Service-role credentials are server-only; only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` may reach the browser.
- Authenticated responses are dynamic and must not use shared caching or ISR.
- Local migration is idempotent and never blindly adds counters.
- The current workspace has no `.git` directory. Run the listed commit command only after the user initializes or connects a repository; until then, each green verification command is the task checkpoint.

---

## File Map

- `lib/config/env.ts`: validated public/server configuration.
- `lib/supabase/browser.ts`, `server.ts`, `admin.ts`: provider-specific clients.
- `lib/auth/session.ts`, `errors.ts`, `schemas.ts`: session/DAL and safe auth results.
- `lib/repositories/contracts.ts`: provider-neutral repository interfaces and DTOs.
- `lib/repositories/supabase/*.ts`: Supabase repository implementations.
- `lib/sync/local-snapshot.ts`, `merge.ts`, `migration-client.ts`, `offline-queue.ts`: legacy migration and retryable writes.
- `supabase/migrations/202609170001_account_learning.sql`: schema, grants, triggers, and RLS.
- `supabase/tests/account_learning_rls.test.sql`: allow/deny database tests.
- `app/(auth)/*`, `app/settings/account/*`, `app/auth/callback/route.ts`: account UI and callback.
- `app/api/migrations/local/route.ts`, `app/api/sync/operations/route.ts`: authenticated migration/sync endpoints.
- `components/auth/*`, `components/account-menu.tsx`, `components/local-data-migration.tsx`: client-facing account experience.
- `proxy.ts`: optimistic cookie refresh only; secure authorization remains in the DAL.

### Task 1: Dependency and environment contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `.env.example`
- Create: `lib/config/env.ts`
- Test: `tests/env-config.test.ts`

**Interfaces:**
- Produces: `getPublicEnv(): PublicEnv`, `getServerEnv(): ServerEnv`, `isCloudConfigured(): boolean`.

- [x] **Step 1: Write the failing environment tests**

```ts
import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/config/env";

describe("Supabase environment", () => {
  it("accepts a complete public configuration", () => {
    expect(parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key"
    }).NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
  });

  it("never accepts an empty server secret", () => {
    expect(() => parseServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: ""
    })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
```

- [x] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run: `pnpm vitest run tests/env-config.test.ts`

- [x] **Step 3: Install the auth packages and implement strict parsers**

Run: `pnpm add @supabase/supabase-js @supabase/ssr`

```ts
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1)
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  CLOUD_LEARNING_ENABLED: z.enum(["true", "false"]).default("false")
});
```

`.env.example` must name all variables, use non-secret sample values, and document that Confirm Email must be enabled in Supabase Auth.

- [x] **Step 4: Run `pnpm vitest run tests/env-config.test.ts` and `pnpm exec tsc --noEmit`**

Expected: both commands pass.

- [x] **Step 5: Checkpoint the dependency boundary**

If Git is available: `git add package.json pnpm-lock.yaml .env.example lib/config/env.ts tests/env-config.test.ts && git commit -m "feat: add Supabase environment contract"`

### Task 2: Supabase clients and authenticated DAL

**Files:**
- Create: `types/auth.ts`
- Create: `lib/supabase/browser.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/admin.ts`
- Create: `lib/auth/session.ts`
- Create: `lib/auth/errors.ts`
- Create: `proxy.ts`
- Test: `tests/auth-session.test.ts`

**Interfaces:**
- Produces: `getOptionalViewer(): Promise<ViewerDTO | null>`, `requireViewer(): Promise<ViewerDTO>`, `requireVerifiedViewer(): Promise<ViewerDTO>`, `toAuthMessage(error): string`.
- `ViewerDTO` is exactly `{ userId: string; email: string; emailVerified: boolean }`.

- [x] **Step 1: Write tests for safe auth error mapping and verified-session enforcement**

```ts
it("does not disclose whether an email exists", () => {
  expect(toAuthMessage({ code: "invalid_credentials" })).toBe("邮箱或密码不正确。");
  expect(toAuthMessage({ code: "user_not_found" })).toBe("邮箱或密码不正确。");
});

it("rejects an unverified viewer", async () => {
  await expect(assertVerifiedViewer({ userId: "u1", email: "a@b.com", emailVerified: false }))
    .rejects.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
});
```

- [x] **Step 2: Run `pnpm vitest run tests/auth-session.test.ts` and confirm failure**

- [x] **Step 3: Implement clients and the DAL**

`server.ts` uses `createServerClient` and async `cookies()`. `browser.ts` exposes a singleton `createBrowserClient`. `admin.ts` imports `server-only`, disables session persistence, and is the only module that reads the service-role key.

`session.ts` calls `supabase.auth.getUser()` for secure checks, never trusts `getSession()` alone, and uses React `cache()` only for one render pass. `proxy.ts` refreshes Supabase cookies and performs only optimistic redirects for `/settings`, never database authorization.

- [x] **Step 4: Run the focused test, type check, and lint the new modules**

Run: `pnpm vitest run tests/auth-session.test.ts && pnpm exec tsc --noEmit && pnpm eslint lib/auth lib/supabase proxy.ts`

- [x] **Step 5: Checkpoint the auth boundary**

If Git is available: `git add types/auth.ts lib/auth lib/supabase proxy.ts tests/auth-session.test.ts && git commit -m "feat: add Supabase auth data access layer"`

### Task 3: Learning schema, grants, and RLS

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202609170001_account_learning.sql`
- Create: `supabase/tests/account_learning_rls.test.sql`
- Create: `types/database.ts`

**Interfaces:**
- Produces tables: `profiles`, `user_preferences`, `word_learning_states`, `review_events`, `vocabulary_encounters`, `personal_sentences`, `learner_auxiliary_state`, `today_plans`, `today_plan_items`, `today_sessions`, `reading_documents`, `reading_progress`, `migration_batches`, `migration_items`.

- [x] **Step 1: Write pgTAP policy assertions before the schema**

The SQL test creates two Auth users, sets `request.jwt.claim.sub`, and asserts:

```sql
select lives_ok($$ insert into public.word_learning_states
  (user_id, word_id, state) values ('00000000-0000-0000-0000-000000000001', 'inspect', '{}'::jsonb) $$,
  'owner can insert');

select results_eq($$ select count(*) from public.word_learning_states $$, array[1::bigint],
  'owner sees one row');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select results_eq($$ select count(*) from public.word_learning_states $$, array[0::bigint],
  'other user sees no rows');
```

- [x] **Step 2: Run `supabase test db` and confirm the missing schema fails**

If the Supabase CLI or Docker is unavailable, record that external prerequisite and continue with `pnpm exec tsc --noEmit`; the pgTAP file remains a required release gate.

- [x] **Step 3: Implement the schema and policies**

Use JSONB only for versioned engine snapshots; keep lookup, ownership, dates, idempotency keys, and status fields as typed columns. Add unique constraints for `(user_id, word_id)`, `(user_id, client_event_id)`, `(user_id, source_installation_id, schema_version)`, and migration item identity. Revoke all default grants, grant only required operations to `authenticated`, and create separate select/insert/update/delete policies.

- [ ] **Step 4: Run `supabase db reset`, `supabase test db`, and `pnpm exec tsc --noEmit`**

External gate recorded on 2026-09-17: this machine currently has no Supabase CLI, Docker, or PostgreSQL runtime. Type checking passes; database reset and pgTAP execution remain required before release.

Expected: migrations apply, all policy tests pass, and generated/handwritten database types compile.

- [ ] **Step 5: Checkpoint the protected schema**

If Git is available: `git add supabase types/database.ts && git commit -m "feat: add protected learning schema"`

### Task 4: Registration, login, reset, and callback flow

**Files:**
- Create: `lib/auth/schemas.ts`
- Create: `app/(auth)/actions.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/register/page.tsx`
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/reset-password/page.tsx`
- Create: `app/auth/callback/route.ts`
- Create: `components/auth/auth-card.tsx`
- Create: `components/auth/login-form.tsx`
- Create: `components/auth/register-form.tsx`
- Create: `components/auth/reset-form.tsx`
- Test: `tests/auth-schemas.test.ts`

**Interfaces:**
- Produces server actions with `AuthActionState = { status: "idle" | "success" | "error"; message?: string; fieldErrors?: Record<string, string[]> }`.

- [x] **Step 1: Write validation tests**

```ts
expect(loginSchema.safeParse({ email: "bad", password: "123" }).success).toBe(false);
expect(registerSchema.safeParse({
  email: "reader@example.com", password: "StrongPass1!", confirmPassword: "StrongPass1!"
}).success).toBe(true);
```

- [x] **Step 2: Run `pnpm vitest run tests/auth-schemas.test.ts` and confirm failure**

- [x] **Step 3: Implement Zod schemas, thin server actions, pages, and callback**

Actions call the DAL/provider, revalidate the caller, return only `AuthActionState`, and validate `next` as a same-origin relative path. Registration redirects to a “check your email” state. The callback exchanges the code, verifies the resulting user, and redirects to the validated return path. Password reset never reveals whether the email exists.

- [x] **Step 4: Run schema tests, type checking, and lint**

Run: `pnpm vitest run tests/auth-schemas.test.ts && pnpm exec tsc --noEmit && pnpm eslint 'app/(auth)' app/auth components/auth lib/auth`

- [x] **Step 5: Checkpoint the complete email/password flow**

If Git is available: `git add 'app/(auth)' app/auth components/auth lib/auth tests/auth-schemas.test.ts && git commit -m "feat: add verified email account flow"`

### Task 5: Header account state and account settings

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/site-header.tsx`
- Create: `components/site-header-shell.tsx`
- Create: `components/account-menu.tsx`
- Create: `app/settings/account/page.tsx`
- Create: `app/settings/account/actions.ts`
- Test: `tests/account-dto.test.ts`

**Interfaces:**
- Consumes: `getOptionalViewer`, `requireVerifiedViewer`.
- Produces: `AccountDTO = { email: string; displayName: string | null }`.

- [x] **Step 1: Add a DTO test proving tokens and provider metadata are dropped**

```ts
expect(toAccountDTO({ email: "a@b.com", user_metadata: { display_name: "A", secret: "x" } }))
  .toEqual({ email: "a@b.com", displayName: "A" });
```

- [x] **Step 2: Run the focused test and confirm failure**

- [x] **Step 3: Split the header into a server shell and existing client navigation**

The server shell reads only `AccountDTO`, wraps the dynamic account menu in `Suspense`, and leaves pathname-based navigation in the client component. Settings supports display-name update, password-change email, and logout. Every mutation rechecks the current user.

- [x] **Step 4: Run `pnpm vitest run tests/account-dto.test.ts`, type checking, lint, and `pnpm build`**

- [x] **Step 5: Checkpoint the account UI**

If Git is available: `git add app/layout.tsx components/site-header.tsx components/site-header-shell.tsx components/account-menu.tsx app/settings tests/account-dto.test.ts && git commit -m "feat: add account navigation and settings"`

### Task 6: Provider-neutral learning repositories

**Files:**
- Create: `lib/repositories/contracts.ts`
- Create: `lib/repositories/supabase/learner-repository.ts`
- Create: `lib/repositories/supabase/reading-repository.ts`
- Create: `lib/repositories/supabase/today-repository.ts`
- Create: `lib/repositories/index.ts`
- Test: `tests/repository-contracts.test.ts`

**Interfaces:**
- Produces:

```ts
interface LearnerRepository {
  getSnapshot(userId: string): Promise<LearningStorage>;
  upsertWordState(userId: string, state: WordProgress, operationId: string): Promise<void>;
  appendEvents(userId: string, events: LearningEvent[]): Promise<number>;
  saveAuxiliaryState(userId: string, storage: LearningStorage, operationId: string): Promise<void>;
}

interface ReadingRepository {
  listDocuments(userId: string): Promise<ReadingDocument[]>;
  saveDocument(userId: string, document: ReadingDocument, operationId: string): Promise<void>;
  saveProgress(userId: string, progress: ReadingProgress, operationId: string): Promise<void>;
}
```

- [x] **Step 1: Write an in-memory contract test for ownership and idempotent operations**

The test calls each method twice with one operation ID and asserts one persisted fact, then calls as a second user and asserts no first-user rows are returned.

- [x] **Step 2: Run `pnpm vitest run tests/repository-contracts.test.ts` and confirm failure**

- [x] **Step 3: Implement focused Supabase repositories**

Each method accepts the trusted `userId` from the DAL, selects explicit columns, maps to existing domain types, and converts provider errors to stable repository errors. No component imports these modules.

- [x] **Step 4: Run repository tests, type checking, and lint**

Run: `pnpm vitest run tests/repository-contracts.test.ts && pnpm exec tsc --noEmit && pnpm eslint lib/repositories`

- [x] **Step 5: Checkpoint the cloud data boundary**

If Git is available: `git add lib/repositories tests/repository-contracts.test.ts && git commit -m "feat: add cloud learning repositories"`

### Task 7: Idempotent local-data migration

**Files:**
- Create: `lib/sync/local-snapshot.ts`
- Create: `lib/sync/merge.ts`
- Create: `lib/sync/migration-client.ts`
- Create: `app/api/migrations/local/route.ts`
- Create: `components/local-data-migration.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/local-cloud-migration.test.ts`

**Interfaces:**
- Produces: `createLocalSnapshot(): LocalMigrationSnapshot`, `mergeLearningState(server, local): LearningStorage`, `migrateLocalSnapshot(input): Promise<MigrationSummary>`.
- `MigrationSummary` is `{ batchId: string; imported: number; skipped: number; failed: number; complete: boolean }`.

- [x] **Step 1: Write conflict and retry tests**

```ts
it("keeps the newer server word state and deduplicates events", () => {
  const merged = mergeLearningState(serverFixture, localFixture);
  expect(merged.words.inspect.lastReviewedAt).toBe("2026-09-17T09:00:00.000Z");
  expect(new Set(merged.events.map((event) => event.id)).size).toBe(merged.events.length);
});
```

Add a route-level test that submits the same `sourceInstallationId` and schema version twice and expects the second response to reuse the completed batch.

- [x] **Step 2: Run `pnpm vitest run tests/local-cloud-migration.test.ts` and confirm failure**

- [x] **Step 3: Implement snapshot, chunked migration, and progress UI**

Snapshot only the documented learning and Reading keys. Validate every entity with Zod. Upload at most 100 entities per request. Preserve local source data after success and set a separate completion marker. The UI reports imported/skipped/failed counts and exposes a retry button for partial failure.

- [x] **Step 4: Run migration tests, existing storage migration tests, type checking, and lint**

Run: `pnpm vitest run tests/local-cloud-migration.test.ts tests/storage-migration.test.ts && pnpm exec tsc --noEmit && pnpm eslint lib/sync app/api/migrations components/local-data-migration.tsx`

- [x] **Step 5: Checkpoint the migration path**

If Git is available: `git add lib/sync app/api/migrations components/local-data-migration.tsx app/layout.tsx tests/local-cloud-migration.test.ts && git commit -m "feat: migrate local learning data safely"`

### Task 8: Authenticated sync bridge and offline queue

**Files:**
- Create: `types/sync.ts`
- Create: `lib/sync/offline-queue.ts`
- Create: `lib/sync/learning-sync.ts`
- Create: `app/api/sync/operations/route.ts`
- Modify: `lib/storage.ts`
- Modify: `lib/reading-storage.ts`
- Test: `tests/offline-sync.test.ts`

**Interfaces:**
- Produces: `enqueueSyncOperation(operation): void`, `flushSyncQueue(): Promise<FlushResult>`, `SyncOperation = { id: string; kind: "word-state" | "learning-event" | "reading-progress" | "personal-sentence"; entityId: string; version: number; createdAt: string; payload: unknown }`, and `FlushResult = { applied: number; remaining: number; retryAt: string | null }`.

- [x] **Step 1: Write tests for ordered replay and duplicate operation IDs**

The test queues three operations, makes the transport fail after one, verifies two remain, retries, and verifies the server sees each operation ID once.

- [x] **Step 2: Run `pnpm vitest run tests/offline-sync.test.ts` and confirm failure**

- [x] **Step 3: Implement the narrow queue and storage bridge**

Guest writes continue using current stores. Verified-user writes update the optimistic local cache and enqueue an operation. The sync route authenticates, validates, dispatches to a repository, and records the operation ID transactionally. Feed ingestion and Today generation are rejected as unsupported queue kinds.

- [x] **Step 4: Run sync tests plus existing learning and Reading tests**

Run: `pnpm vitest run tests/offline-sync.test.ts tests/storage-migration.test.ts tests/reading-analysis.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint cross-device persistence support**

If Git is available: `git add types/sync.ts lib/sync app/api/sync lib/storage.ts lib/reading-storage.ts tests/offline-sync.test.ts && git commit -m "feat: sync authenticated learning operations"`

### Task 9: Account-phase acceptance

**Files:**
- Create: `docs/account-cloud-setup.md`
- Create: `scripts/account-cloud-audit.ts`
- Modify: `package.json`
- Test: `tests/account-cloud-audit.test.ts`

**Interfaces:**
- Produces command: `pnpm run audit:account-cloud`.

- [x] **Step 1: Write the audit test**

The audit must fail when an expected table migration, RLS enable statement, policy test, auth route, environment example, or repository implementation is missing.

- [x] **Step 2: Run the audit test and confirm failure**

Run: `pnpm vitest run tests/account-cloud-audit.test.ts`

- [x] **Step 3: Implement the audit and deployment guide**

The guide includes Supabase project creation, Confirm Email, redirect URLs, environment variables, migration application, RLS tests, and a two-user isolation checklist. It contains no real credential values.

- [x] **Step 4: Run the complete account gate**

Run: `pnpm run audit:account-cloud && pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build`

When local Supabase is available, also run: `supabase db reset && supabase test db`.

- [x] **Step 5: Record the phase result and continue to the RSS plan**

If Git is available: `git add docs/account-cloud-setup.md scripts/account-cloud-audit.ts package.json tests/account-cloud-audit.test.ts && git commit -m "test: verify account and cloud data phase"`
