# Rootline 2.0 Phase 3 Progress 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local-only Progress page with an account-scoped vocabulary-growth dashboard whose completion, stable vocabulary, 10K, root, and observed-growth figures have defensible definitions.

**Architecture:** Pure functions under `lib/progress/` implement metric rules and consume narrow rows from a server-only Supabase repository. A single small snapshot table records the current stable count on verified Progress visits; a service-role-only SQL helper returns distinct passive-evidence word IDs without shipping lifetime events. `/progress` renders an aggregate DTO, not the entire learner snapshot.

**Tech Stack:** Next.js 16.3.5 App Router, React 19, TypeScript 6, Supabase/Postgres/RLS/pgTAP, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-phase-3-progress-2-0-design.md`

## Global Constraints

- Start at committed branch `codex/phase-3-progress-2-0`, based on finished Phase 2C. Its baseline is 109 files / 437 passing unit tests. Do not merge into `main`, deploy, or migrate production as part of local acceptance.
- Read the full spec and relevant installed `node_modules/next/dist/docs/01-app/` guides before changing app code. This repo's Next.js 16 behavior differs from older conventions.
- Read the Supabase and Supabase Postgres best-practices skills before SQL work. Check current Supabase docs/changelog, discover CLI commands with `--help`, and use the imperative migration workflow; create migration through the CLI before naming its final file.
- Do not reset the existing `rootline-local` Supabase stack: it held user data in earlier phases. Use a newly identified disposable local database for clean replay, or state explicitly that the clean-DB gate could not be completed. All pgTAP fixtures must roll back and clean up browser accounts.
- Never treat Reading, passive exposure, root-page viewing, `dailyStats`, or the old browser-local Progress count as a completed Today day or stable vocabulary.
- Use the learner's `profiles.timezone`, `learningDateForTimeZone`, and stored `today_plans.learning_date`; do not regroup Today completions by UTC timestamp.
- Stable vocabulary uses `calculateWordMastery(...).stable` unchanged. Catalog IDs gate all vocabulary totals; global denominator stays 10,000, not current 9,750 catalog size.
- No historical stable count is backfilled. Snapshot only observed Phase 3 days, with gaps and possible decreases shown honestly. Defer estimated vocabulary.
- Any new public-schema table has RLS. Authenticated clients may read only their own snapshots and cannot write snapshots or call the passive-ID function. Never expose service keys or raw answer keys to the browser.
- Keep Progress first-level alongside Today, Roots, Reading, and Me; do not expose Rapid, Quiz, Course, or Recovery as competing first-level modes.

## Review Focus

1. A fresh learner with only today's plan must see `1` eligible day, not `7` or `30`; a learner with no plan sees unavailable rates. Pin in Task 1 tests.
2. At a timezone midnight or DST boundary, the stored Today learning date must not move when `completed_at` is UTC. Pin in Task 1 and Task 4 tests.
3. Passive `reading_encounter`/detail evidence and recognition alone must never inflate stable/10K; the same word cannot occupy two headline states. Pin in Task 2 and Task 3 tests.
4. A verified Support Word with two root segments counts once per root; derived/pending morphology and root-page visits count zero. Pin in Task 2 and Task 4 tests.
5. A second account, a failed snapshot upsert, and a PostgREST page boundary beyond 1,000 states must not leak data, manufacture zeros, or truncate totals. Pin in Task 3, Task 4, and Task 6 tests.

---

## File map and ordering

1. `lib/progress/{types,completion}.ts`, `tests/progress-completion.test.ts`: date windows, frozen completion, Today summary, streak.
2. `lib/progress/{vocabulary,roots,growth}.ts`, `tests/progress-{vocabulary,roots,growth}.test.ts`: shared-mastery classification, trusted-root aggregation, observed history.
3. A CLI-created migration finalized as `supabase/migrations/20260925000400_progress_vocabulary_snapshots.sql`, `supabase/tests/progress_vocabulary_snapshots.test.sql`, `types/database.ts`: minimal persistence and privilege boundary.
4. `lib/repositories/supabase/progress-repository.ts`, `lib/progress/{service,server}.ts`, `tests/progress-{repository,service}.test.ts`: account-scoped batched reads, snapshot write, DTO assembly.
5. `app/progress/page.tsx`, `components/progress-dashboard.tsx`, `tests/progress-dashboard.test.tsx`, `tests/progress-navigation.test.tsx`: learner-facing UI and navigation regression; the existing header already has the required first-level routes.
6. `tests/e2e/progress-2-0.spec.ts`, `scripts/run-phase3-local-e2e.sh`, `docs/progress-2-0-metrics.md`: authenticated browser and release gates.

The spec is one coherent subsystem: each task has its own test boundary, but the shared DTO and repository interfaces are sequential dependencies. Use exact-file commits, not `git add .`.

### Task 1: Frozen Today completion and consistency math

**Files:**
- Create: `lib/progress/types.ts`
- Create: `lib/progress/completion.ts`
- Create: `tests/progress-completion.test.ts`

**Interfaces:**
- Produce `ProgressPlanDay = {id:string; learningDate:string; generationVersion:number; status:TodayPlanStatus; completedAt:string|null; requiredTargetIds:string[]; degradationReason:string|null}`.
- Produce `ProgressSessionDay = {planId:string; status:TodayPlanStatus; completedTargetIds:string[]}`.
- Produce `ProgressDay = {date:string; state:"complete"|"active"|"not-started"|"missing"; completed:number; required:number}` and `CompletionWindow = {completed:number; eligible:number; percent:number|null; days:ProgressDay[]}`. Also export `ProgressWordState = "touched"|"learning"|"stable"` for Task 2.
- Produce `calculateCompletion(plans:readonly ProgressPlanDay[], sessions:readonly ProgressSessionDay[], firstPlanDate:string|null, todayDate:string): {today:ProgressDay; last7:CompletionWindow; last30:CompletionWindow; streak:number}`. Inputs are already scoped to one verified user.

- [ ] **Step 1: Write a failing test for frozen completion, versions, and a one-day denominator.**

```ts
const result = calculateCompletion([
  {id:"older", learningDate:"2026-09-25", generationVersion:1, status:"complete", completedAt:"2026-09-25T00:01:00Z", requiredTargetIds:["a"], degradationReason:null},
  {id:"latest", learningDate:"2026-09-25", generationVersion:2, status:"active", completedAt:null, requiredTargetIds:["a","b"], degradationReason:null}
], [{planId:"older", status:"complete", completedTargetIds:["a"]},
  {planId:"latest", status:"active", completedTargetIds:["a"]}], "2026-09-25", "2026-09-25");
expect(result.today).toMatchObject({state:"active", completed:1, required:2});
expect(result.last7).toMatchObject({completed:0, eligible:1, percent:0});
```

- [ ] **Step 2: Add failing cases for no plan, omitted dates after first plan, 30-day clipping, incomplete session despite complete plan, streak grace day, leap day, a 45-day streak, and timezone boundary.** Use the exact local-date helper and assert a plan stored for `2026-09-25` remains on the 25th even if its `completedAt` falls on the 26th UTC.

```ts
expect(calculateCompletion([], [], null, "2026-09-25").last7.percent).toBeNull();
expect(learningDateForTimeZone(new Date("2026-09-25T16:30:00Z"), "Asia/Shanghai"))
  .toBe("2026-09-26");
const dates = Array.from({length:45}, (_, offset) => shiftLearningDate("2026-09-25", -offset));
const plans = dates.map((date, index) => ({id:`p${index}`,learningDate:date,generationVersion:1,
  status:"complete" as const,completedAt:`${date}T12:00:00Z`,requiredTargetIds:["a"],degradationReason:null}));
const sessions = plans.map((plan) => ({planId:plan.id,status:"complete" as const,completedTargetIds:["a"]}));
expect(calculateCompletion(plans, sessions, "2026-08-12", "2026-09-25").streak).toBe(45);
```
- [ ] **Step 3: Run** `node node_modules/vitest/vitest.mjs run tests/progress-completion.test.ts` **and confirm red.**
- [ ] **Step 4: Implement** latest-version selection by `(learningDate,generationVersion)`, require plan+session `complete` and nonnull `completedAt`, clip windows using `shiftLearningDate`, compute `null` only for zero eligible days, and start streak at today if complete or yesterday otherwise. The input plan/session arrays include older rows sufficient to find the first missed streak day, not just 30 days. Do not consult Reading or local `dailyStats`.

```ts
const complete = plan?.status === "complete" && plan.completedAt !== null
  && session?.status === "complete";
const eligible = firstPlanDate === null || firstPlanDate > todayDate ? 0
  : dates.filter((date) => date >= firstPlanDate).length;
const percent = eligible === 0 ? null : Math.round(completed / eligible * 100);
```
- [ ] **Step 5: Run the focused test and commit** `lib/progress/types.ts lib/progress/completion.ts tests/progress-completion.test.ts` with `feat: calculate frozen Today consistency metrics`.

### Task 2: Conservative vocabulary, trusted roots, and observed growth

**Files:**
- Create: `lib/progress/vocabulary.ts`
- Create: `lib/progress/roots.ts`
- Create: `lib/progress/growth.ts`
- Create: `tests/progress-vocabulary.test.ts`
- Create: `tests/progress-roots.test.ts`
- Create: `tests/progress-growth.test.ts`

**Interfaces:**
- Produce `classifyProgressVocabulary(catalogIds:ReadonlySet<string>, states:ReadonlyMap<string,WordProgress>, passiveWordIds:ReadonlySet<string>, now:Date): {touched:number; learning:number; stable:number; stablePercent:number; byWordId:Map<string,"touched"|"learning"|"stable">}`. Use `calculateWordMastery(id,state,[],now).stable`; its stable predicate does not depend on events. `stablePercent = min(100, round(stable / 10000 * 1000) / 10)`.
- Produce `TrustedRootLink = {rootId:string; rootKey:string; wordId:string}` and `aggregateRootMastery(links:readonly TrustedRootLink[], states:ReadonlyMap<string,WordProgress>, categories:ReadonlyMap<string,ProgressWordState>, now:Date): RootMasteryRow[]`, where `RootMasteryRow = {rootId:string;rootKey:string;usable:number;learned:number;stable:number;percent:number|null;weakWordIds:string[]}`. `ProgressWordState` comes from Task 1.
- Produce `buildObservedGrowth(snapshots:readonly {learningDate:string; stableCount:number}[], todayDate:string): {points:Array<{date:string;stable:number}>; hasTrend:boolean; firstObservedDate:string|null}`. Never generate missing points.

- [ ] **Step 1: Write failing vocabulary tests.** Include an accepted Support Word, a pure `reading_encounter` ID, a recognition-only state, a genuinely delayed stable state, an unknown legacy ID, and repeated passive evidence. Assert exactly one category per word and `stable=1` means `stablePercent=0.0` at one decimal; assert `1_284` stable words yield `12.8`.

```ts
expect(classifyProgressVocabulary(new Set(["adapt"]), new Map(), new Set(["adapt"]), now))
  .toMatchObject({touched:1, learning:0, stable:0, stablePercent:0});
```

- [ ] **Step 2: Write failing root tests** with one Support Word linked twice to `spect`, another linked to `spect` and `tract`, one untrusted link omitted by the repository fixture, and a `lastRating:"again"` weak word. Construct `states` and `categories` maps plus a fixed `now` in the test fixture. Assert usable/learned/stable counts, `round(100 * stable / usable)`, per-root deduplication, and no global double-counting.

```ts
expect(aggregateRootMastery([
  {rootId:"spect-id",rootKey:"spect",wordId:"inspect"},
  {rootId:"spect-id",rootKey:"spect",wordId:"inspect"}
], states, categories, now)[0].usable).toBe(1);
```

- [ ] **Step 3: Write failing growth tests** with no snapshots, one point, two nonconsecutive points, duplicate same-day observations, and a later lower stable count. Assert no inferred pre-Phase-3 dates or interpolation.

```ts
expect(buildObservedGrowth([{learningDate:"2026-09-25",stableCount:4}], "2026-09-25"))
  .toMatchObject({hasTrend:false, points:[{date:"2026-09-25",stable:4}]});
```
- [ ] **Step 4: Run** `node node_modules/vitest/vitest.mjs run tests/progress-vocabulary.test.ts tests/progress-roots.test.ts tests/progress-growth.test.ts` **and confirm red.**
- [ ] **Step 5: Implement** the pure functions. In `roots.ts`, dedupe `(rootId,wordId)` and sort weak words by overdue/recent `again`, capping the returned display list at three IDs per root. In `growth.ts`, sort observed dates and keep the latest supplied observation for duplicate dates.

```ts
const mastery = calculateWordMastery(wordId, progress, [], now);
const category = mastery.stable ? "stable" : hasActiveLearning(progress) ? "learning" : "touched";
const percent = Math.min(100, Math.round(stable / 10_000 * 1_000) / 10);
```
- [ ] **Step 6: Run focused tests and commit** the six files with `feat: classify vocabulary growth and trusted root mastery`.

### Task 3: Snapshot and passive-evidence persistence boundary

**Files:**
- Create: `supabase/migrations/20260925000400_progress_vocabulary_snapshots.sql` (first run `supabase migration new progress_vocabulary_snapshots --help` and create via the installed CLI, then rename the generated file before first apply)
- Create: `supabase/tests/progress_vocabulary_snapshots.test.sql`
- Modify: `types/database.ts`

**Interfaces:**
- Add `public.progress_vocabulary_snapshots(user_id uuid, learning_date date, stable_count integer, catalog_version text, captured_at timestamptz)` with primary key `(user_id,learning_date)`, `stable_count >= 0`, `user_id` cascade FK, RLS, authenticated owner-only `SELECT`, and no authenticated write grants.
- Add service-role-only `public.progress_passive_word_ids(p_user_id uuid) returns table(word_id text)` as `SECURITY INVOKER`; it returns distinct nonnull word IDs from passive `review_events` types (`word_seen`, recognition, `reading_encounter`, `reading_lookup`) for that user. Add index `(user_id,event_type,word_id)` or verify an equivalent plan with `EXPLAIN` before adding redundant indexes.
- Add corresponding `Database` table/function types. `catalog_version` comes from `data/vocabulary/production-manifest.json` (`version` currently `2026.09.production-v2`), not a UI constant.

- [ ] **Step 1: Write failing pgTAP** with two auth users. Assert new table exists and has RLS, owner `SELECT` sees only own snapshot, authenticated `INSERT/UPDATE` fails, anon cannot read, a second user's passive ID is absent, duplicate daily upsert produces one row, and querying snapshots does not touch `today_plans`/`today_sessions`.

```sql
select has_table('public','progress_vocabulary_snapshots');
select ok((select relrowsecurity from pg_class where oid='public.progress_vocabulary_snapshots'::regclass));
select ok(not has_function_privilege('authenticated','public.progress_passive_word_ids(uuid)','execute'));
```

- [ ] **Step 2: Confirm pgTAP is red** on a disposable local test database and inspect exact migration history. Do not run `db reset` on `rootline-local`; if no clean disposable target exists, use rollback-only tests on the existing local stack and report the clean-replay gate separately.
- [ ] **Step 3: Author minimal SQL.** Use `create table` with a composite primary key, explicit grants/revokes, `create policy ... to authenticated using ((select auth.uid()) = user_id)`, and a service-only invoker function with explicit `current_user`/user filter. Inspect `review_events` indexes and `EXPLAIN` for the evidence query; add `(user_id,event_type,word_id)` when no existing index supports the filtered distinct scan. Avoid `SECURITY DEFINER` and broad `PUBLIC EXECUTE`.

```sql
create table public.progress_vocabulary_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  stable_count integer not null check (stable_count >= 0),
  catalog_version text not null,
  captured_at timestamptz not null default now(),
  primary key (user_id, learning_date)
);
alter table public.progress_vocabulary_snapshots enable row level security;
revoke all on public.progress_vocabulary_snapshots from public, anon, authenticated;
grant select on public.progress_vocabulary_snapshots to authenticated;
grant select, insert, update on public.progress_vocabulary_snapshots to service_role;
create policy progress_snapshots_owner_read on public.progress_vocabulary_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create or replace function public.progress_passive_word_ids(p_user_id uuid)
returns table(word_id text)
language sql security invoker set search_path = ''
as $$
  select distinct e.word_id from public.review_events e
  where current_user = 'service_role' and e.user_id = p_user_id
    and e.word_id is not null
    and e.event_type in ('word_seen','recognition_known','recognition_fuzzy',
      'recognition_unknown','reading_encounter','reading_lookup')
$$;
revoke all on function public.progress_passive_word_ids(uuid) from public, anon, authenticated;
grant execute on function public.progress_passive_word_ids(uuid) to service_role;
```
- [ ] **Step 4: Apply only to a validated disposable local target, run pgTAP in `BEGIN`/`ROLLBACK`, and verify `finish()` reports no `not ok`.** Run read-only checks for table privilege, RLS, and account rows after the test; do not claim a clean replay if it was not performed.
- [ ] **Step 5: Run** `node node_modules/typescript/bin/tsc --noEmit` **and commit** the migration, pgTAP, and `types/database.ts` with `feat: persist observed vocabulary growth privately`.

### Task 4: Account-scoped repository and server DTO

**Files:**
- Create: `lib/repositories/supabase/progress-repository.ts`
- Create: `lib/progress/service.ts`
- Create: `lib/progress/server.ts`
- Modify: `lib/progress/types.ts`
- Create: `tests/progress-repository.test.ts`
- Create: `tests/progress-service.test.ts`

**Interfaces:**
- `SupabaseProgressRepository` exposes `getProfileTimeZone(userId)`, `getFirstPlanDate(userId)`, `getRecentPlanDays(userId,fromDate,toDate)`, `getStreakPlanDays(userId,todayDate)` with backward pagination until the first missing learning date, `getMatchingSessions(userId,planIds)`, `getWordStates(userId)` with 1,000-row pagination, `getPassiveWordIds(userId)`, `getTrustedRootLinks()`, `getSnapshots(userId,fromDate,toDate)`, `upsertSnapshot(userId,date,count,catalogVersion)`, and `countCompletedReadingPractice(userId,fromDate,toDate)`.
- `ProgressDashboardDTO = {today:ProgressDay;last7:CompletionWindow;last30:CompletionWindow;streak:number;vocabulary:{touched:number;learning:number;stable:number;stablePercent:number};roots:RootMasteryRow[];growth:{available:boolean;points:Array<{date:string;stable:number}>;hasTrend:boolean;firstObservedDate:string|null};reading:{completedPracticeSessions7d:number}|null}` in `lib/progress/types.ts`. It contains no `Map`, raw word states, or events.
- `createProgressService(deps).getDashboard(userId, now):Promise<ProgressDashboardDTO>` computes the user's learning date, loads catalog/version, calls Task 1–2 pure functions, upserts today's observed stable count, and returns only aggregate/short-label data. A snapshot write failure returns `growth: {available:false,...}` while completion, vocabulary, and roots remain intact; failures in authoritative source reads surface an unavailable state, never fake zero.
- `createProductionProgressService()` uses `createAdminSupabaseClient` only in server-only code and passes verified `userId` into every user-data query. Morphology query reuses latest published Gold dataset selection and pages approved+verified records/segments. Root IDs are mapped to root keys; unknown catalog IDs are dropped.

- [ ] **Step 1: Write red repository tests** asserting `.eq("user_id", userId)` on all user-data queries, first-plan ordering, latest-version historical fetch, 45-day streak pagination, 1,001 word rows across two pages, passive-ID RPC with the verified user ID, trusted morphology filtering, owner snapshot upsert, and bounded completed Reading session query. A 1,000-row first page must cause another `.range(1000,1999)` call.

```ts
expect(firstPage).toHaveLength(1_000);
expect(fetchWordPage).toHaveBeenCalledWith(1_000, 1_999);
expect(states.size).toBe(1_001);
```
- [ ] **Step 2: Write red service tests** for timezone midnight (use `America/New_York` DST transition and `Asia/Shanghai`), no plan, one-day denominator, stable state versus passive Reading, Support Word root link, and snapshot failure. Construct an in-memory repository fixture implementing the Task 4 interface and mock `upsertSnapshot` to throw; assert other reliable metrics still return while `growth.available === false`.

```ts
repository.upsertSnapshot = async () => { throw new Error("local snapshot store unavailable"); };
const dashboard = await service.getDashboard(ownerId, new Date("2026-09-25T16:30:00Z"));
expect(dashboard.today.date).toBe("2026-09-26");
expect(dashboard.growth.available).toBe(false);
expect(dashboard.vocabulary.stable).toBe(1);
```
- [ ] **Step 3: Run** `node node_modules/vitest/vitest.mjs run tests/progress-repository.test.ts tests/progress-service.test.ts` **and confirm red.**
- [ ] **Step 4: Implement** batched repository calls and the service. Use `loadProductionVocabulary()` plus the production manifest version; never reuse the `getSnapshot()` 500-event cap or browser `useLearningProgress`. The only mutation is current-day snapshot upsert; in retry, the same user/date replaces the one row atomically. Use `reading_reinforcement_sessions.status = complete` and `learning_date` for an optional secondary count labeled “近 7 个学习日文章的已完成词汇巩固,” not “本周完成练习.”

```ts
const todayDate = learningDateForTimeZone(now, timeZone);
const categories = classifyProgressVocabulary(catalogIds, states, passiveWordIds, now);
try { await repository.upsertSnapshot(userId, todayDate, categories.stable, catalogVersion); }
catch { growth = {available:false, points:[], hasTrend:false, firstObservedDate:null}; }
```
- [ ] **Step 5: Run focused tests and TypeScript; commit** the six files with `feat: serve account-scoped Progress metrics`.

### Task 5: Learner-facing Progress UI and navigation

**Files:**
- Modify: `app/progress/page.tsx`
- Modify: `components/progress-dashboard.tsx`
- Create: `tests/progress-dashboard.test.tsx`
- Create: `tests/progress-page.test.tsx`
- Create: `tests/progress-navigation.test.tsx`

**Interfaces:**
- `ProgressDashboard({dashboard}:{dashboard:ProgressDashboardDTO})` is presentational. It does not call `useLearningProgress`, fetch history, or run mastery calculations in the browser.
- `ProgressPage` calls `getOptionalViewer`; signed-out/unverified users see a login/verification prompt. Verified users call `createProductionProgressService().getDashboard(viewer.userId,new Date())`; a source failure shows a clear retry/error state. Do not serialize raw word states or morphology records into HTML.

- [ ] **Step 1: Write red UI tests.** Assert primary first-screen order: stable+10K, Today status/link, 7-day, 30-day, root highlights, observed growth, optional Reading. Check textual numerator/denominator and unavailable-rate copy, actual frozen target denominator plus shortage reason for a plan under 30 targets, no estimate card, no horizontal overflow classes, and `<progress>`/`aria-label` values with text equivalents rather than color-only state.

```tsx
render(<ProgressDashboard dashboard={fixtureDashboard} />);
expect(screen.getByRole("heading", {name:"稳定掌握"})).toBeVisible();
expect(screen.getByRole("link", {name:/继续今日学习/})).toHaveAttribute("href", "/today");
expect(screen.queryByText("估算词汇量")).not.toBeInTheDocument();
```
- [ ] **Step 2: Write red navigation tests** for desktop/mobile first-level destinations. Assert Today/Roots/Reading/Progress/Me remain available in the intended surfaces, without Rapid/Quiz/Course/Recovery as top-level items.

Write `tests/progress-page.test.tsx` with mocked `getOptionalViewer` and Progress service: signed-out/unverified viewers get no account query, verified viewers get their own DTO, and an authoritative read error gets an explicit unavailable message. Assert the page is private/non-cacheable using the supported Next 16 route API after reading its installed guide.

```tsx
render(<SiteHeader account={null} />);
expect(screen.getAllByRole("link", {name:/Progress/}).length).toBeGreaterThan(0);
expect(screen.queryByRole("link", {name:"Rapid"})).not.toBeInTheDocument();
```
- [ ] **Step 3: Run** `node node_modules/vitest/vitest.mjs run tests/progress-dashboard.test.tsx tests/progress-page.test.tsx tests/progress-navigation.test.tsx` **and confirm red.**
- [ ] **Step 4: Implement** compact cards and one readable seven-day strip; keep 30-day as a single completion summary and growth as one chart only when at least two observed points exist. Use a native `<details>` section for deeper roots rather than dozens on the first viewport. Update metadata to describe stable vocabulary and consistency. Preserve a clear Today CTA.

```tsx
<section aria-labelledby="stable-heading">
  <h2 id="stable-heading">稳定掌握</h2>
  <p>{dashboard.vocabulary.stable.toLocaleString()} / 10,000</p>
  <progress max={10_000} value={dashboard.vocabulary.stable}
    aria-label="稳定掌握词汇的 10K 进度" />
</section>
```
- [ ] **Step 5: Run focused tests, lint, and TypeScript; commit** the UI files with `feat: show reliable Progress 2.0 dashboard`.

### Task 6: Authenticated browser acceptance and final audit

**Files:**
- Create: `tests/e2e/progress-2-0.spec.ts`
- Create: `scripts/run-phase3-local-e2e.sh`
- Create: `docs/progress-2-0-metrics.md`

**Interfaces:**
- Browser fixture uses a fixed local-only Supabase URL, generated verified users, and explicit cleanup; it never reads a remote service credential or accepts arbitrary commands under that credential. Follow the security model of `scripts/run-phase2c-local-e2e.sh` without echoing keys.
- Metrics doc states the exact eligible-day, stable, 10K, root, snapshot, and deferred-estimate rules plus known gaps; final report includes all 20 items requested in the Phase 3 brief.

- [ ] **Step 1: Write red E2E** that creates two disposable verified local accounts, logs in, opens Today then Progress, compares Today's frozen counts/status, checks 7/30 labels, stable/10K/root values, refresh persistence, account isolation, and no horizontal overflow at widths 390/430/768/1440. Seed only local fixture records; clean users/snapshots in `afterAll` even on assertion failure.

```ts
for (const width of [390, 430, 768, 1440]) {
  await page.setViewportSize({width, height:900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
```
- [ ] **Step 2: Add a fixed local runner** by adapting `scripts/run-phase2c-local-e2e.sh` with `apply_patch`, keeping its fixed `supabase_kong_rootline-local` check, `read_local_key` function, local URL, admin API credential validation, and no-key-output behavior. Change only the phase-specific `CRON_SECRET`/`FEED_FETCH_CONTACT` values and the Playwright target to `tests/e2e/progress-2-0.spec.ts`; do not accept a caller-supplied Supabase URL or credential. Verify the gateway is `127.0.0.1:54321`.

```bash
export E2E_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(read_local_key publishable)"
export SUPABASE_SERVICE_ROLE_KEY="$(read_local_key service)"
export E2E_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
http_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$E2E_SUPABASE_URL/auth/v1/admin/users")"
test "$http_status" = 200
"$node_bin" node_modules/@playwright/test/cli.js test tests/e2e/progress-2-0.spec.ts
```
- [ ] **Step 3: Run** `bash scripts/run-phase3-local-e2e.sh` **and fix only Phase 3 failures.** Retain the earlier authenticated Phase 2C and Today acceptance tests; skipped pre-existing fixtures are not a pass claim.
- [ ] **Step 4: Write the metric-definition document** with the formulas from the spec, snapshot start-date limitation, possible stable-count decreases, and estimated-vocabulary deferral. Run final audits and note any non-Phase-3 findings separately.

```markdown
7-day completion = completed frozen Today learning dates / eligible local dates since first plan, within the last 7 dates.
10K progress = current stable catalog words / 10,000. Historical stable points begin only with observed Phase 3 snapshots.
```
- [ ] **Step 5: Run fresh quality gates:** `node node_modules/vitest/vitest.mjs run`; pgTAP on the validated local target; `node node_modules/eslint/bin/eslint.js .`; `node node_modules/typescript/bin/tsc --noEmit`; `node node_modules/next/dist/bin/next build --webpack`; `bash scripts/run-phase3-local-e2e.sh`; `node --import tsx scripts/final-product-acceptance.ts`; and `git diff --check`. Check that any Next dev rewrite of `next-env.d.ts` is reverted with `apply_patch`, not swept into the commit.
- [ ] **Step 6: Commit** test, runner, and metrics doc with `test: verify Progress 2.0 learner dashboard`. Request a whole-branch code review under the requesting-code-review skill, address important findings, rerun affected gates, and finish with the branch/commits, schema, definitions, UI, tests, pgTAP, browser, build, audit, and limitations. Stop after Phase 3.
