# Rootline 2.0 Phase 4 Beta Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one reviewable, locally accepted Rootline 2.0 Beta integration branch and PR, without touching production.

**Architecture:** Preserve the cumulative Phase 1B–3 commits, integrate the verified latest `main`, then make narrow improvements to the existing Today, Roots, Reading, Progress, and account flows. Reuse server-owned plans, revision guards, the offline queue, and Gold morphology evidence; verify the integrated journey and deployment boundaries with isolated local data.

**Tech Stack:** Next.js (installed version and its local `node_modules/next/dist/docs/` guides), React, TypeScript, Supabase/Postgres/pgTAP, Vitest, Playwright, pnpm, Vercel deployment target.

**Spec:** `docs/superpowers/specs/2026-09-25-phase-4-beta-integration-design.md`

## Global Constraints

- No automatic production migration, deployment, user-data write, direct merge to `main`, or force push.
- First-level destinations are Today, Roots, Reading, Progress, Me; preserve old engines without promoting them.
- Today uses its frozen actual target count and same-day lock; Reading stays optional and cannot change Today completion.
- Use approved/verified published Gold links for trusted Roots; never infer trust from the 20 static lesson records alone.
- Keep server-side account scoping, Today/Reading revision and CAS rules, and existing offline queue semantics.
- Preserve earlier tests and acceptance assertions; fixtures live outside production migrations and are cleaned up.
- Show learner-facing Chinese copy, honest empty/error states, and no raw SQL, RPC, backend IDs, or stack traces.
- Validate 390, 430, 768, and 1440 px; distinguish unavailable history from true zero.
- Check the installed Next guide before modifying routes, metadata, loading UI, or server actions. Follow the Supabase and Postgres skills before SQL/security edits; discover CLI flags with `--help`.

## Review Focus

1. A frozen shortfall plan (for example 23 targets) must show `X / 23`, not `X / 30`, and must not display a fabricated time estimate (Task 2 tests).
2. A POST accepted by the server whose response is lost must not let an older tab replay over newer Today state (Task 6 tests).
3. A temporarily offline queue must remain visible and durable across refresh, without being reported as server-saved (Task 6 tests).
4. A root present only in static lesson content or in an unverified Gold record must not appear as a trusted root (Task 4 tests).
5. The same instant around UTC midnight or DST must map Today, Daily-3, and Progress to the learner's configured local date (Task 8 test).

## File and interface map

- `lib/today/remaining-effort.ts`: pure approximate time function consumed by `components/today/daily-30-flow.tsx`.
- `app/page.tsx`, `components/site-header.tsx`, `app/settings/account/page.tsx`, `components/account-settings-form.tsx`, `lib/auth/account.ts`, `app/settings/account/actions.ts`: entry/navigation and minimal Me settings, using the existing `profiles.timezone` field.
- `lib/roots/trusted-directory.ts`, `lib/roots/server.ts`, `app/roots/page.tsx`, `app/roots/[root]/page.tsx`: trusted-root directory, account-scoped progress, and root-key detail; static lesson copy is enrichment only.
- `components/product-state.tsx`, `lib/reading/today-priority.ts`, primary route `loading.tsx` files, and existing Today/Reading/Progress pages: consistent loading, empty, and error affordances; Reading checks actual Today completion without generating a new plan.
- `components/sync-queue-flusher.tsx`, `components/today/daily-30-flow.tsx`: visible pending/conflict status and safe Today refresh on ambiguous POST failure.
- `scripts/beta-db-safety.ts`, `scripts/verify-beta-db.ts`, `tests/e2e/support/local-rootline.ts`, `tests/e2e/beta-journey.spec.ts`: isolated database and authenticated end-to-end harness.
- `docs/beta-integration-evidence.md`, `docs/beta-release-runbook.md`, `.env.example`: provenance, gates, environment matrix, release and rollback instructions.

### Task 1: Verify the integration base and install a clean local baseline

**Files:** Create `docs/beta-integration-evidence.md`; inspect `git` history and `package.json`/`pnpm-lock.yaml`.

**Interfaces:** Produces the exact latest-main SHA, Phase 1B–3 commit ancestry, merge/conflict ledger, and baseline gate results for all later tasks.

- [ ] **Step 1: Inspect branch ancestry and remote.** Run `git status --short`, `git merge-base origin/main HEAD`, `git log --oneline --ancestry-path origin/main..HEAD`, then `git fetch origin main` and inspect `git log --oneline HEAD..origin/main`. Do not treat the previous local `origin/main` as current if fetch fails.
- [ ] **Step 2: Integrate without rewriting validated commits.** If fetched `origin/main` is not an ancestor, run `git merge --no-ff --no-commit origin/main`, inspect every conflict with `git diff --check` and the relevant tests, then commit the resolution. If fetch is blocked, record `remote not verified` and continue local hardening, but do not mark integration/PR or Beta readiness complete.
- [ ] **Step 3: Install and run baseline.** Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`. Record commands, counts, and failures in the evidence file. A failing baseline is investigated before attributing it to Phase 4.
- [ ] **Step 4: Commit the evidence file.** Record real SHAs and outcomes, not projected results. Commit only `docs/beta-integration-evidence.md` and any resolved merge changes; keep unrelated worktree files untouched.

### Task 2: Make Today the default, with honest progress and a locked completion state

**Files:** Create `lib/today/remaining-effort.ts`, `tests/today-remaining-effort.test.ts`; modify `app/page.tsx`, `components/today/daily-30-flow.tsx`, `components/today-learning-flow.tsx`, `tests/today-flow-stages.test.tsx`; create `tests/today-home.test.tsx`.

**Interfaces:** `estimateRemainingMinutes(estimatedMinutes: number, completed: number, required: number): number | null`. Daily30 consumes the existing `TodayPlanDTO` and `TodaySessionDTO` without changing their persisted shapes.

- [ ] **Step 1: Write failing tests.** Pin `estimateRemainingMinutes(30, 15, 30) === 15`, `(30, 0, 0) === null`, `(0, 5, 23) === null`, and a 23-target plan showing `5 / 23`. Mock `next/navigation.redirect` and assert `/` redirects to `/today`. Test that an active session first shows `继续今日学习`, completed session shows the same frozen denominator and optional Reading/Progress links, and setup has no new-batch action.
  ```ts
  expect(estimateRemainingMinutes(30, 15, 30)).toBe(15);
  expect(estimateRemainingMinutes(30, 0, 0)).toBeNull();
  expect(screen.getByText("5 / 23")).toBeVisible();
  expect(screen.queryByRole("button", {name: /再来 30|重新生成|换一批/})).not.toBeInTheDocument();
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/today-remaining-effort.test.ts tests/today-home.test.tsx tests/today-flow-stages.test.tsx`; expect the new cases to fail for missing function, old `/`, or old setup copy.
- [ ] **Step 3: Implement the pure estimate and UI.** Use the real frozen target length, intersect completed IDs with target IDs, and show `约 N 分钟` only when the estimate is available. Keep an active session on the setup summary until Continue is chosen; Continue does not emit another `today_started`. Keep completed state immutable, show actual roots/mix/review outcome and optional links. Replace hard-coded `9000 词` loading/setup copy with learner wording.
  ```ts
  export function estimateRemainingMinutes(estimatedMinutes: number, completed: number, required: number): number | null {
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0 || required <= 0) return null;
    const remaining = Math.max(0, required - Math.min(required, Math.max(0, completed)));
    return Math.ceil(estimatedMinutes * remaining / required);
  }
  ```
- [ ] **Step 4: Confirm GREEN and regressions.** Run the focused test command, then `pnpm exec vitest run tests/today-service.test.ts tests/today-events.test.ts tests/progress-completion.test.ts`. Commit the Today files.

### Task 3: Converge navigation and minimal Me/timezone settings

**Files:** Modify `components/site-header.tsx`, `tests/progress-navigation.test.tsx`, `lib/auth/account.ts`, `app/settings/account/actions.ts`, `app/settings/account/page.tsx`, `lib/auth/account-settings-state.ts`, `components/account-settings-form.tsx`; create `tests/account-timezone.test.ts` and `tests/me-page.test.tsx`.

**Interfaces:** `getCurrentAccount(): Promise<AccountDTO & {timeZone: string; dailyTimeBudget: number}>`; it reads the already persisted `user_preferences.daily_time_budget` as read-only context. `updateCurrentTimeZone(timeZone: string): Promise<void>` validates an IANA zone and updates only the current viewer's `profiles` row. Server action `updateTimeZoneAction` accepts `FormData` and returns `AccountSettingsState`.

- [ ] **Step 1: Write failing tests.** Make the `usePathname` mock in `tests/progress-navigation.test.tsx` read a mutable path, set it to `/settings/account` for the active-state assertion, then restore `/progress`. Assert identical five hrefs in desktop/mobile nav: `/today`, `/roots`, `/reading`, `/progress`, `/settings/account`; no primary legacy modes; current mobile item carries `aria-current="page"`. Validate malformed zones are rejected without a database write, a valid `America/New_York` update is scoped by verified viewer ID, and Me displays current timezone, the persisted daily-time preference as read-only context, and logout.
  ```ts
  expect(within(desktop).getAllByRole("link").map((link) => link.getAttribute("href")))
    .toEqual(["/today", "/roots", "/reading", "/progress", "/settings/account"]);
  expect(within(mobile).getByRole("link", {name: "Me"})).toHaveAttribute("aria-current", "page");
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/progress-navigation.test.tsx tests/account-timezone.test.ts tests/me-page.test.tsx`.
- [ ] **Step 3: Implement.** Use one nav definition for both layouts, accessible active state, existing safe-area spacing, and content bottom clearance. Read `display_name,timezone` from `profiles` and `daily_time_budget` from `user_preferences` in `getCurrentAccount`. Validate timezone with `Intl.DateTimeFormat("en", {timeZone})` inside a try/catch plus a 64-character cap; reject invalid input with a natural message. Use an account-scoped profile UPDATE and a compact timezone form with suggestions but allow any valid IANA value. Do not add a planner tuning panel or fabricate legal links.
  ```ts
  export async function updateCurrentTimeZone(timeZone: string): Promise<void> {
    if (timeZone.length > 64) throw new Error("请选择有效的学习时区。");
    try { new Intl.DateTimeFormat("en", {timeZone}); }
    catch { throw new Error("请选择有效的学习时区。"); }
    const viewer = await requireVerifiedViewer();
    const client = await createServerSupabaseClient();
    const {error} = await client.from("profiles").update({timezone: timeZone}).eq("user_id", viewer.userId);
    if (error) throw error;
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run focused tests plus `tests/account-dto.test.ts`, `tests/today-local-date.test.ts`, and `tests/progress-service.test.ts`. Commit the navigation/Me files.

### Task 4: Make Roots a trusted directory, not a second curriculum

**Files:** Create `lib/roots/trusted-directory.ts`, `lib/roots/server.ts`, `tests/trusted-root-directory.test.ts`, `tests/roots-page.test.tsx`; modify `app/roots/page.tsx`, `app/roots/[root]/page.tsx`.

**Interfaces:** `buildTrustedRootDirectory(links: readonly TrustedRootLink[], categories: ReadonlyMap<string, ProgressWordState>): TrustedRootRow[]` returns `{rootKey, wordIds, usable, learned, stable}` rows. `loadTrustedRootDirectory(userId: string | null)` obtains `getTrustedRootLinks()` from the existing service-role repository, account state only for a verified viewer, and production catalog data. Detail routes use a root-key slug and only rows present in the trusted directory.

- [ ] **Step 1: Write failing tests.** Feed one verified link for `spect` and no link for static `port`; assert only `spect` renders. Mock an unverified record in `tests/progress-repository.test.ts` and assert `getTrustedRootLinks()` excludes it. Assert unique word IDs per root, two-user learned/stable counts differ, an anonymous visitor sees trusted family content but no personal counts, no published Gold dataset yields an honest empty state, and an unknown detail slug is 404.
  ```ts
  const rows = buildTrustedRootDirectory(
    [{rootId: "gold-spect", rootKey: "spect", wordId: "inspect"}],
    new Map([["inspect", "stable"]])
  );
  expect(rows).toEqual([{rootKey: "spect", wordIds: ["inspect"], usable: 1, learned: 1, stable: 1}]);
  expect(rows.some((row) => row.rootKey === "port")).toBe(false);
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/trusted-root-directory.test.ts tests/roots-page.test.tsx tests/progress-repository.test.ts`.
- [ ] **Step 3: Implement.** Reuse `SupabaseProgressRepository.getTrustedRootLinks`, `getWordStates`, and `classifyProgressVocabulary`; filter links to the production catalog. Group/dedupe by root key + word ID and sort deterministically. Static `data/roots.ts` copy may enrich matching root keys only. Render a short first screen and root-key detail with linked family words; do not keep static-only cards or the old Root Challenge as a competing curriculum. Use `notFound()` for untrusted/unknown keys.
  ```ts
  const trusted = new Map<string, Set<string>>();
  for (const {rootKey, wordId} of links) {
    const words = trusted.get(rootKey) ?? new Set<string>();
    words.add(wordId);
    trusted.set(rootKey, words);
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run focused tests plus `tests/progress-roots.test.ts` and `tests/progress-repository.test.ts`. Commit Roots changes.

### Task 5: Audit loading, empty, error, copy, and responsive structure

**Files:** Create `components/product-state.tsx`, `lib/reading/today-priority.ts`, `tests/product-state.test.tsx`, `tests/reading-today-priority.test.ts`, `app/today/loading.tsx`, `app/roots/loading.tsx`, `app/reading/loading.tsx`, `app/progress/loading.tsx`, `app/settings/account/loading.tsx`, `app/reading/articles/[id]/not-found.tsx`; modify `components/today-learning-flow.tsx`, `components/today/daily-30-flow.tsx`, `components/reading/daily-reading-list.tsx`, `app/reading/page.tsx`, `app/progress/page.tsx`, `app/settings/account/page.tsx`, `tests/daily-reading-page.test.tsx`, `app/globals.css` only where focused layout fixes require it.

**Interfaces:** `ProductState({title, description, actionHref?, actionLabel?, variant}: ProductStateProps)` is semantic and reusable; it never accepts raw backend errors. `shouldEmphasizeToday(userId: string, now: Date): Promise<boolean>` reads the latest same-date Today plan and session via the existing repository/completion logic, without creating a plan. Existing page services remain authoritative.

- [ ] **Step 1: Write failing component/route tests.** Cover a loading shell with stable card dimensions, a retry link on Today load failure, article-unavailable return to `/reading`, no recommendations without fake zero, no learned root or weak words without fake mastery, and Progress with insufficient history. For Reading, an incomplete/missing plan shows a prominent Today action; a genuinely complete plan does not. Assert technical strings such as `candidate`, `RPC`, `planner version`, and SQL error text are absent.
  ```tsx
  render(<ProductState title="今日计划暂时无法加载" description="请检查网络后重试。"
    actionHref="/today" actionLabel="重试" variant="error" />);
  expect(screen.getByRole("alert")).toHaveTextContent("请检查网络后重试。");
  expect(screen.getByRole("link", {name: "重试"})).toHaveAttribute("href", "/today");
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/product-state.test.tsx tests/reading-today-priority.test.ts tests/today-flow-stages.test.tsx tests/daily-reading-page.test.tsx tests/progress-page.test.tsx`.
- [ ] **Step 3: Implement minimal shared presentation.** Add route-specific loading shells and `ProductState`; sanitize user copy in the touched routes. Use `SupabaseProgressRepository.getProfileTimeZone`, `getRecentPlanDays`, `getMatchingSessions`, and `calculateCompletion(plans, sessions, plans[0]?.learningDate ?? null, todayDate)` in `shouldEmphasizeToday`; do not call `getOrCreateTodayPlan` just to render Reading. Mock this helper in the existing Reading page test. Keep Reading optional and Today CTA visually stronger while unfinished; do not introduce new charts or routes. Use `aria-label`/text for progress and focus rings. Avoid a full CSS redesign.
  ```tsx
  import Link from "next/link";
  interface ProductStateProps {title: string; description: string; actionHref?: string;
    actionLabel?: string; variant: "loading" | "empty" | "error"}
  export function ProductState({title, description, actionHref, actionLabel, variant}: ProductStateProps) {
    return <section role={variant === "error" ? "alert" : "status"} className="rounded-3xl border bg-white p-6">
      <h2 className="text-xl font-bold">{title}</h2><p className="mt-2">{description}</p>
      {actionHref && actionLabel && <Link href={actionHref}>{actionLabel}</Link>}
    </section>;
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run focused tests and existing Reading/Progress page tests. Commit the state/copy changes.

### Task 6: Verify and harden offline and concurrency recovery

**Files:** Modify `components/today/daily-30-flow.tsx`, `components/sync-queue-flusher.tsx`; modify `tests/offline-sync.test.ts`, `tests/sync-queue-flusher.test.tsx`; create `tests/today-conflict-recovery.test.tsx`.

**Interfaces:** Today continues to send `expectedRevision` and `operationId` to the current API. `refreshTodaySession(planId: string): Promise<TodaySessionDTO>` retrieves the authoritative session after an ambiguous POST result. The queue's `FlushResult` and CAS behavior are not changed.

- [ ] **Step 1: Write failing tests.** Simulate a POST whose server write succeeds but response rejects, then GET returns the newer revision: the UI must refresh before offering another action and must not replay a new operation over it. Simulate 409 from a second tab: show synchronized latest state. Simulate offline queue with `remaining: 1`: show pending, retain it across a remount, and never label it saved. Existing `READING_REVISION_CONFLICT` continues to retain/export local data until explicit choice.
  ```ts
  expect(screen.getByRole("status")).toHaveTextContent("等待同步");
  expect(readSyncQueue(memoryStorageAdapter)).toHaveLength(1);
  expect(screen.queryByText("已保存到云端")).not.toBeInTheDocument();
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/today-conflict-recovery.test.tsx tests/offline-sync.test.ts tests/sync-queue-flusher.test.tsx`.
- [ ] **Step 3: Implement safe recovery.** Treat POST 409 separately from timeout/network/5xx. On ambiguous response, stop advance, attempt GET, apply returned revision/session, and use a plain-language message; if GET also fails, keep controls blocked until explicit reload and say the save status is unknown. Expose pending queue count/retry in a compact `role="status"` banner and clear it only after success. Preserve existing conflict export and no-silent-overwrite rules.
  ```ts
  async function refreshTodaySession(planId: string): Promise<TodaySessionDTO> {
    const response = await fetch(`/api/today/events?planId=${encodeURIComponent(planId)}`, {cache: "no-store"});
    if (!response.ok) throw new Error("TODAY_REFRESH_UNAVAILABLE");
    return response.json() as Promise<TodaySessionDTO>;
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run focused tests, `tests/reading-reinforcement-sync.test.ts`, and `tests/reading-word-state-http.test.ts`. Commit recovery changes.

### Task 7: Reproduce the whole database chain without touching existing data

**Files:** Create `scripts/beta-db-safety.ts`, `scripts/verify-beta-db.ts`; modify `package.json` to add `verify:beta-db` (`tsx scripts/verify-beta-db.ts`); create `tests/beta-db-runner.test.ts`; update `docs/beta-integration-evidence.md` with observed output. Do not modify old migrations to make a clean run pass; add an explicitly named additive repair migration only if a real defect is found.

**Interfaces:** `validateDisposableDbUrl(input: string): string` in `scripts/beta-db-safety.ts` returns a marker-free URL only for a disposable loopback Postgres port. `pnpm verify:beta-db` also verifies `BETA_DISPOSABLE_CONTAINER` is a running `supabase_db_rootline-phase4-beta-*` Docker container bound to that port, then resets that database from all migrations and runs all `supabase/tests/*.test.sql` via the installed CLI.

- [ ] **Step 1: Write a failing guard test.** Import `validateDisposableDbUrl` from `scripts/beta-db-safety.ts`. Assert it refuses a missing URL, a non-loopback host, port 54322 (the existing `rootline-local` database), and any URL lacking an explicit disposable marker. Assert it strips the marker from an accepted URL before CLI use; audit the runner's argument arrays for no `--linked` or production hostname.
  ```ts
  expect(validateDisposableDbUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres"))
    .toThrow(/disposable/i);
  expect(validateDisposableDbUrl("postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable&beta_disposable=1"))
    .toBe("postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable");
  ```
- [ ] **Step 2: Confirm RED.** Run `pnpm exec vitest run tests/beta-db-runner.test.ts`.
- [ ] **Step 3: Implement the runner and clean run.** Validate exact loopback host, Postgres database/user, port 56000–56999, and the explicit marker before any destructive reset. Strip the marker before passing the URL to Postgres. Use `docker inspect` on the exact named Phase 4 container and verify its bound port matches the URL. Invoke the installed CLI with `['db', 'reset', '--db-url', dbUrl, '--no-seed', '--workdir', repoRoot]` and `['test', 'db', '--db-url', dbUrl, '--workdir', repoRoot]` as argument arrays; both flags were verified against installed CLI help. Record migration versions and total pgTAP assertions. Document how to start the separately named local Supabase stack with unique ports. Do not reset `rootline-local` or remote state.
  ```ts
  export function validateDisposableDbUrl(input: string): string {
    const url = new URL(input);
    const port = Number(url.port);
    if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.username !== "postgres"
      || url.pathname !== "/postgres" || port < 56000 || port > 56999
      || url.searchParams.get("beta_disposable") !== "1") throw new Error("A marked disposable local database is required.");
    url.searchParams.delete("beta_disposable");
    return url.toString();
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run the guard test and `pnpm verify:beta-db` against the separately created/identified disposable stack. Check RLS and permissions with pgTAP and `git diff --check`. Commit runner, tests, and real evidence.

### Task 8: Run one integrated authenticated journey and responsive acceptance

**Files:** Create `tests/e2e/support/local-rootline.ts`, `tests/e2e/beta-journey.spec.ts`, `scripts/run-beta-local-e2e.sh`; modify `playwright.config.ts` only if isolated port configuration is needed; update `docs/beta-integration-evidence.md`.

**Interfaces:** `type BetaUser = {id: string; email: string; password: string}`; `createBetaUsers(admin: SupabaseClient<Database>): Promise<[BetaUser, BetaUser]>`; `cleanupBetaUsers(admin: SupabaseClient<Database>, users: readonly BetaUser[]): Promise<void>`; `readTodayPlan(page: Page): Promise<TodayPlanDTO>`; `completeDaily30(page: Page, plan: TodayPlanDTO): Promise<void>`. Use local Supabase Auth and runtime article fixtures, not `ROOTLINE_E2E_FIXTURES=1` or production migrations.

- [ ] **Step 1: Write the failing browser journey.** Test verified login, frozen 30, partial work, refresh and Continue, all three Mini Reviews, Final Review, same-day lock, frozen Daily-3, article/reinforcement, unchanged Today completion, Progress, Roots, Me, two-user isolation, and 390/430/768/1440 viewport widths. At each width inspect navigation, Today cards/exercises with a long answer, root detail, Reading article/word sheet/exercises, Progress, and Me for accessible headings, horizontal overflow, clipped controls, and bottom-nav overlap. Assert account B cannot read account A's Today plan/answers, Reading recommendation/state, Progress, or learning events through authenticated requests. Include a two-tab stale Today action, a Reading answer conflict, and one non-UTC rollover case where Today, Daily-3, and Progress agree on the same local learning date.
  ```ts
  await page.goto("/");
  await expect(page).toHaveURL(/\/today/);
  const plan = await readTodayPlan(page);
  expect(plan.dailyTargets).toHaveLength(30);
  await page.setViewportSize({width: 390, height: 900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  ```
- [ ] **Step 2: Confirm RED.** Run only `tests/e2e/beta-journey.spec.ts` against the disposable local Auth/DB stack; record the first unmet learner-facing assertion rather than switching to mocked API routes.
- [ ] **Step 3: Implement fixture helpers and fix only evidenced defects.** Create two verified local users, seed one curated local article through application-supported local tables, drive UI actions for 30 targets/reviews, and clean users/article in `afterAll` even on assertion failure. Add deterministic waits on persisted state instead of arbitrary sleeps. Test the conflict/replay cases in their focused suites and use this journey to catch cross-feature composition issues.
  ```ts
  import {randomUUID} from "node:crypto";
  export type BetaUser = {id: string; email: string; password: string};
  export async function readTodayPlan(page: Page): Promise<TodayPlanDTO> {
    return page.evaluate(async () => {
      const response = await fetch("/api/today", {cache: "no-store"});
      if (!response.ok) throw new Error(`Local Today request failed: ${response.status}`);
      return response.json();
    });
  }
  export async function createBetaUsers(admin: SupabaseClient<Database>): Promise<[BetaUser, BetaUser]> {
    const users: BetaUser[] = [];
    try {
      for (let index = 0; index < 2; index++) {
        const email = `beta-${randomUUID()}@example.test`;
        const password = `Beta-${randomUUID()}-aA1!`;
        const {data, error} = await admin.auth.admin.createUser({email, password, email_confirm: true});
        if (error || !data.user) throw error ?? new Error("Local user creation failed");
        users.push({id: data.user.id, email, password});
      }
      return users as [BetaUser, BetaUser];
    } catch (error) {
      await cleanupBetaUsers(admin, users);
      throw error;
    }
  }
  ```
- [ ] **Step 4: Confirm GREEN.** Run the integrated journey and the prior Phase 2C/3 authenticated browser specs. Confirm local fixture counts return to their pre-test values, then commit tests/scripts/fixes and update evidence.

### Task 9: Performance, release artifacts, final gates, and PR

**Files:** Create `docs/beta-release-runbook.md`; modify `.env.example` only for missing variable descriptions; update `docs/beta-integration-evidence.md`; change code only for a measured performance/security regression with a new focused test.

**Interfaces:** Runbook includes required/optional/public/server-only configuration, Vercel/Supabase migration-first order, safe smoke checks, observation, app rollback versus retained additive schema, and release notes. Evidence file contains actual branch/SHAs, conflict resolution, all gates, and Beta verdict.

- [ ] **Step 1: Audit real environment reads and data access.** Use `rg` on `process.env`, `NEXT_PUBLIC_`, `lib/config/env.ts`, and bundle output; verify `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are server-only. Benchmark Today initial/resume, Reading list/article, and Progress aggregation with a near-10K-state local fixture; record measured timings/response size before altering caching.
- [ ] **Step 2: Write the runbook.** List env variables without secret values; require backup/current-state confirmation, additive migrations, RLS/grant health, application deploy, authorized production-safe smoke, and error observation. State that rolling back a Vercel build does not remove applied additive migrations; no destructive database rollback is automatic. Record whether required legal/privacy notices have been supplied for the target Beta audience; do not claim legal compliance from code tests. Include concise release notes and the exact local Beta verification commands.
- [ ] **Step 3: Run all final gates on the integrated commit.** Run full Vitest, all pgTAP on clean disposable DB, lint, `tsc --noEmit`, `next build --webpack`, final product audit, integrated browser journey, existing E2E, and `git diff --check`; inspect for accidental fixture secrets or production test accounts. A known critical data-loss/account-isolation failure is a `NOT READY` verdict even if builds pass.
- [ ] **Step 4: Review and publish only a reviewable PR.** Request a whole-branch code review, fix findings and rerun affected gates. Verify the actual latest remote `main`, push the Phase 4 branch, create one integration PR targeting it, and attach the PR to this task. If GitHub connectivity/permission is unavailable, report the blocker and keep Beta/PR status distinct from local gates. Do not merge or deploy. Commit release docs/evidence and provide the 30-item Phase 4 final report.
