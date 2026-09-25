# Phase 2C Reading → Vocabulary Reinforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, durable, summary-grounded Reading vocabulary practice without changing Daily 30 completion.

**Architecture:** The verified server owns frozen questions, evidence, grading, and accepted word-state updates. A private one-session-per-user/article row and a transactional answer RPC provide deduplication; existing `review_events` and `word_learning_states` remain the sole evidence and SRS stores. The old whole-state sync path is revision-guarded, including its direct-table-write bypass, before Reading answers are enabled.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest/Testing Library, Supabase Postgres/RLS/pgTAP, ts-fsrs, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-25-phase-2c-reading-vocabulary-reinforcement-design.md`

## Global Constraints

- Read this plan and the linked spec completely, and read the relevant installed `node_modules/next/dist/docs/` guides before changing app code; this project's Next version has breaking conventions.
- New sessions start only for a verified user's **current frozen Daily-3 article** after its `completed_at` is saved; an owned existing session can resume across learning dates by session ID.
- Exactly one session per `(user_id, article_id)`; zero to five distinct summary-grounded targets, normally three to five, with no padding, generated prose, publisher-body fetch, or generic Quiz redirect.
- Expose only frozen public question fields before submission. Never send an unsubmitted key, accepted forms, or future answer in HTML, RSC payload, or API JSON.
- Exposure/detail are one weak event per article/word and never schedule FSRS; correct Context Recognition is recognition-only; correct Reading Cloze uses `hard`; correct Short Recall uses `good`; wrong active answer uses `again`.
- Today plan, items, sessions, target progress, final review, Today Complete, and streak completion never change because of Reading. Do not add Reading metrics to Today counters.
- An accepted answer atomically advances its session cursor, inserts one deterministic event, and updates one existing word state. Duplicate/replayed requests return the persisted outcome; a conflict leaves no partial credit.
- Prevent an older generic word-state upload or direct authenticated table write from overwriting accepted Reading state. Preserve conflicting local work; no silent queue drop or invented automatic merge.
- Session snapshots/keys are service-role-only behind verified-viewer routes, RLS enabled, no `anon`/`authenticated` table grants. Reserve the `reading-*` event namespace against direct authenticated writes and generic client event sync.
- No production migration, deployment, Progress 2.0, new reading achievements, or unrelated feature work in this phase.
- `supabase db reset` is allowed only after verifying the target is the disposable local test stack with no user data to retain; otherwise use a new disposable local instance and do not reset the existing one.

## Review Focus

1. A summary token that merely lemmatizes to a matched word but has a different inflected surface: Cloze accepts only the frozen displayed surface, not the lemma (Task 2 test).
2. Two devices submit the same question while a third has a stale queued whole-word snapshot: one credit survives and the stale snapshot is retained as a visible conflict (Tasks 1 and 5 tests).
3. A logged-in client calls PostgREST directly with a forged `reading-*` event or tries a direct word-state update: both are denied while legitimate legacy migration still works (Task 1 pgTAP and Task 5 migration test).
4. A learner crosses local midnight after beginning a session: the exact owned session resumes while a fresh old-article start is denied (Task 4 service test).
5. A summary has no unambiguous questions, or an answer request times out after the DB commits: no fake CTA; retry returns persisted result without a second score/SRS step (Tasks 2, 4, and 6 tests).

---

## File map and execution order

1. Persistence boundary: new migration under `supabase/migrations/`, `supabase/tests/reading_reinforcement.test.sql`, `types/database.ts`, and `lib/repositories/supabase/reading-reinforcement-repository.ts`.
2. Pure domain: `lib/reading/reinforcement/{types,questions,progress}.ts` and corresponding `tests/reading-reinforcement-*.test.ts`; shared types land with persistence first.
3. Authenticated services/HTTP: `lib/reading/reinforcement/{service,http,server}.ts` and four route files under `app/api/reading/`.
4. Legacy sync bridge: `lib/sync/{learning-sync,offline-queue,supabase-migration}.ts`, `app/api/sync/operations/route.ts`, `types/{progress,sync}.ts`, `lib/storage.ts`, `lib/mastery-engine.ts`, and focused existing tests.
5. UI: `components/reading/{daily-reading-article,reading-reinforcement}.tsx`, `app/reading/{page,daily/[id]/page,reinforcement/[sessionId]/page}.tsx`, page loader, UI tests, and `tests/e2e/reading-reinforcement.spec.ts`.

Apply the schema task before service tests that need local Postgres. Each task ends with a focused red/green cycle and exact-file commit. Keep the two pre-existing untracked plan files and `supabase/.temp/` untouched. Do not stage the whole directory.

### Task 1: Private session and atomic persistence boundary

**Files:**
- Create: `supabase/migrations/20260925000100_reading_reinforcement.sql` (generate with Supabase CLI, then rename before first apply)
- Create: `supabase/tests/reading_reinforcement.test.sql`
- Modify: `types/database.ts`
- Create: `lib/reading/reinforcement/types.ts`
- Create: `lib/repositories/supabase/reading-reinforcement-repository.ts`
- Test: `tests/reading-reinforcement-repository.test.ts`

**Interfaces:**
- Produce `ReadingSessionRow` with `id`, `user_id`, `article_id`, `learning_date`, `status`, `revision`, `questions`, `outcomes`, `cursor`, `created_at`, `updated_at`, `completed_at`.
- Define `FrozenQuestion` and `ReadingOutcome` in `lib/reading/reinforcement/types.ts` before compiling the repository; `ReadingSessionRow.questions` is `FrozenQuestion[]`, and `outcomes` is `ReadingOutcome[]`.
- Produce `ReadingReinforcementRepository.getByArticle(userId, articleId)`, `.getById(userId, sessionId)`, `.createOnce(userId, articleId, learningDate, frozenQuestions)`, `.listActive(userId, limit)`, `.appendWeakEvidence(userId, event)`, and `.commitAnswer(input): Promise<{kind:"accepted"|"duplicate"|"conflict"; row:ReadingSessionRow; wordState?:WordProgress}>`.
- `commitAnswer` input includes server-derived `userId`, `sessionId`, `questionId`, `expectedSessionRevision`, `wordId`, `expectedReadingRevision`, deterministic `eventId`, submitted answer, server-computed `correct`/`eventType`/metadata, and server-computed `nextWordState`; it does **not** take client-supplied correctness or rating.

```sql
public.apply_reading_answer(
  p_user_id uuid, p_session_id uuid, p_question_id text,
  p_expected_session_revision integer, p_word_id text,
  p_expected_reading_revision integer, p_event_id text,
  p_submitted_answer text, p_correct boolean, p_event_type text,
  p_event_payload jsonb, p_next_state jsonb
) returns jsonb
```

```ts
export type ReadingOutcome = {
  questionId: string;
  wordId: string;
  submittedAnswer: string;
  correct: boolean;
  correctDisplay: string;
  answeredAt: string;
};
```

- [ ] **Step 1: Write failing pgTAP and repository tests.** Pin unique `(user_id,article_id)`, private snapshot grants, owner/non-owner/anon denial, duplicate event identity, transaction rollback if word revision differs, and concurrent same-question claims. In the TS test, two `commitAnswer` calls with one revision must yield one `accepted`, one `duplicate` or `conflict`, and exactly one event/word increment.

```sql
select has_table('public', 'reading_reinforcement_sessions');
select is((select count(*) from information_schema.role_table_grants
  where table_name = 'reading_reinforcement_sessions'
  and grantee in ('anon','authenticated')), 0::bigint);
```

- [ ] **Step 2: Run red.** `supabase test db` and `npm test -- tests/reading-reinforcement-repository.test.ts`; expect missing table/repository failures.
- [ ] **Step 3: Run `supabase migration new reading_reinforcement`, rename the generated file to the declared path before first apply, and implement the additive migration.** Use UUID primary key, unique `(user_id,article_id)`, JSONB frozen questions/outcomes, bounded nonnegative cursor/revision, owner+status+updated index, RLS, no direct client grants, service-role CRUD. Create the `security invoker` `public.apply_reading_answer` RPC with the exact signature above, `search_path=''`, and `service_role` EXECUTE only. In one transaction lock the owner session and target word row (insert default row if absent), check current question and both revisions, insert deterministic `review_events.client_event_id`, update word state and session outcome/cursor, and return accepted/duplicate/conflict. The RPC must reject a mismatched `wordId`/question pairing and must not touch Today tables. Reserve `reading-*` event IDs from direct authenticated `review_events` insert with a `RESTRICTIVE` policy (a second permissive policy would not constrain the existing one) and from `apply_sync_operation`'s `learning-event` branch; service role can append them. Use the already-read Supabase/Postgres skill rules for constraints, short locks, indexes, explicit grants, and search path.

```sql
create unique index reading_reinforcement_owner_article_uq
  on public.reading_reinforcement_sessions(user_id, article_id);
revoke all on public.reading_reinforcement_sessions from anon, authenticated;
grant select, insert, update on public.reading_reinforcement_sessions to service_role;
```

- [ ] **Step 4: Add shared domain/DB types and repository adapter.** Map database rows to the declared interface; do not expose raw `questions` through a client route. `appendWeakEvidence` uses `ON CONFLICT (user_id,client_event_id) DO NOTHING`; accepted answer uses the RPC, not separate Supabase calls.
- [ ] **Step 5: Run green and commit.** `supabase db reset && supabase test db && npm test -- tests/reading-reinforcement-repository.test.ts && npm run typecheck`; then stage only the generated migration, new pgTAP, DB type, repository, and its test. Commit `feat: add private reading reinforcement persistence`.

### Task 2: Deterministic, safe frozen questions

**Files:**
- Modify: `lib/reading/reinforcement/types.ts`
- Create: `lib/reading/reinforcement/questions.ts`
- Test: `tests/reading-reinforcement-questions.test.ts`

**Interfaces:**
- `buildReinforcementQuestions(input: {articleId:string; summary:string; todayWordIds:string[]; recentWordIds:string[]; openedWordIds:string[]; summaryTokens:SummaryToken[]; words:DailyReadingArticleWord[]; progressByWordId:Record<string,WordProgress>}): FrozenQuestion[]`.
- The Task 1 `FrozenQuestion` shape is `{id:string; wordId:string; type:"recognition"|"cloze"|"recall"; context:string; prompt:string; choices?:string[]; acceptedAnswers:string[]; correctDisplay:string; explanation?:string}`; public DTO omits `acceptedAnswers` and `correctDisplay` before submission.
- `gradeReinforcementAnswer(question, answer): boolean` normalizes NFKC/case/edge whitespace, not morphology.

- [ ] **Step 1: Write red tests.** Use real `buildSummaryTokens` output; assert unmatched, unhighlighted, Support-with-invented-root, missing core meaning, missing context, and ambiguous distractors yield no unsafe item; zero items yields `[]`; six valid IDs cap at five with stable order; three safe IDs include all three modes; `adapted` Cloze accepts `adapted` but rejects `adapt`.

```ts
expect(gradeReinforcementAnswer(clozeForAdapted, "ADAPTED")).toBe(true);
expect(gradeReinforcementAnswer(clozeForAdapted, "adapt")).toBe(false);
expect(buildReinforcementQuestions(noHighlightedContext)).toEqual([]);
```

- [ ] **Step 2: Run red.** `npm test -- tests/reading-reinforcement-questions.test.ts` must fail for missing functions.
- [ ] **Step 3: Implement pure selection.** Accept only IDs present both in frozen match arrays and actual `SummaryToken.wordId` tokens. Extract the original sentence/clause around the exact token, freeze its surface, rank Today then weak/due recent then opened then other recent with stable `articleId:wordId` tie-break; create at most five distinct questions. Deterministically cycle recognition/cloze/recall only when that type has safe inputs; recognition distractors must be distinct, meaningful catalogue core meanings. Do not infer polysemy, roots, or prose. Omit an ambiguous question instead of substituting generic trivia.
- [ ] **Step 4: Run green and commit.** `npm test -- tests/reading-reinforcement-questions.test.ts && npm run typecheck`; stage only three files; commit `feat: select safe summary-grounded reading questions`.

### Task 3: Weak exposure and detail-open evidence

**Files:**
- Create: `lib/reading/reinforcement/service.ts`
- Create: `lib/reading/reinforcement/http.ts`
- Create: `lib/reading/reinforcement/server.ts`
- Create: `app/api/reading/articles/[id]/evidence/route.ts`
- Test: `tests/reading-reinforcement-evidence.test.ts`
- Test: `tests/reading-reinforcement-http.test.ts`

**Interfaces:**
- `recordReadingEvidence(userId:string, articleId:string, action:"exposure"|"detail-open", wordId:string): Promise<{saved:boolean}|null>`; `null` means unavailable article/word, `saved:false` means duplicate.
- HTTP body is strictly `{action,wordId}`; it never accepts user ID, event ID, rating, or Today identifiers.

- [ ] **Step 1: Write red tests.** Auth 401; malformed 400; old/foreign article or non-highlighted word 404; two exposure requests for one visible word produce one `reading_encounter`; two details produce one `reading_lookup`; no word state, Today row, or dailyStats changes. A failed repository write must respond retryably, not `saved:true`.

```ts
expect(await service.recordReadingEvidence(owner, article, "exposure", visibleWord)).toEqual({saved:true});
expect(await service.recordReadingEvidence(owner, article, "exposure", visibleWord)).toEqual({saved:false});
```

- [ ] **Step 2: Run red.** `npm test -- tests/reading-reinforcement-evidence.test.ts tests/reading-reinforcement-http.test.ts`.
- [ ] **Step 3: Implement service and thin route.** Reuse the current frozen recommendation/article authorization and `buildSummaryTokens` verification, then write `reading-exposure:${articleId}:${wordId}` or `reading-lookup:${articleId}:${wordId}` with a server timestamp. Keep the route factory dependency-injectable like `daily-reading-article-state-http.ts`, with `cache-control: private, no-store`.
- [ ] **Step 4: Run green and commit.** Focused tests plus typecheck; stage only task files; commit `feat: record deduplicated reading evidence`.

### Task 4: Start/resume a single frozen session

**Files:**
- Modify: `lib/reading/reinforcement/service.ts`
- Modify: `lib/reading/reinforcement/http.ts`
- Modify: `lib/reading/reinforcement/server.ts`
- Create: `app/api/reading/articles/[id]/reinforcement/route.ts`
- Create: `app/api/reading/reinforcement/[sessionId]/route.ts`
- Test: `tests/reading-reinforcement-session.test.ts`

**Interfaces:**
- `startOrResume(userId:string, articleId:string):Promise<{kind:"session";session:PublicSession}|{kind:"empty";availableCount:0}|{kind:"not-found"}|{kind:"unfinished"}>` checks existing session first, then current frozen membership + finished article, and freezes questions once. HTTP maps these to 200/200/404/409 respectively.
- `getOwnedSession(userId:string, sessionId:string):Promise<PublicSession|null>` reads an existing owned session without consulting today's recommendation.
- `PublicSession` contains ID, article label, original learning date, status, cursor, public current question, accepted outcomes, total/correct/practiced counts; no pending keys/future answers.

- [ ] **Step 1: Write red tests.** Same article requested twice yields same session and fixed questions even after catalogue changes; one article recurring next date does not issue new credit; after timezone-local midnight an owned session ID resumes, a new old-article start 404; foreign session and unknown ID return identical 404; article unfinished 409; empty safe set returns explicit `available:false`/zero count and never says “3 words.”

```ts
const started = await service.startOrResume(owner, articleId);
expect(started.kind).toBe("session");
if (started.kind !== "session") throw new Error("Expected session");
expect((await service.getOwnedSession(owner, started.session.id))?.id).toBe(started.session.id);
expect(await service.getOwnedSession(otherUser, started.session.id)).toBeNull();
expect(JSON.stringify(started.session)).not.toContain("acceptedAnswers");
```
- [ ] **Step 2: Run red.** `npm test -- tests/reading-reinforcement-session.test.ts`.
- [ ] **Step 3: Implement creation/get DTOs and routes.** `createOnce` uses unique conflict then reloads existing row. Use the verified viewer and production snapshot service, no historical article list. Freeze all question details in the private row, project only public fields with a dedicated `toPublicSession` allowlist. `POST /api/reading/articles/[id]/reinforcement` starts; `GET /api/reading/reinforcement/[sessionId]` resumes. The server article-page loader calls the service directly for availability count/status, never keys.
- [ ] **Step 4: Run green and commit.** Focused tests and typecheck; stage task files; commit `feat: start and resume frozen reading practice`.

### Task 5: Conservative answer grading and atomic credit

**Files:**
- Create: `lib/reading/reinforcement/progress.ts`
- Modify: `lib/reading/reinforcement/service.ts`
- Modify: `lib/reading/reinforcement/http.ts`
- Create: `app/api/reading/reinforcement/[sessionId]/answers/route.ts`
- Modify: `lib/mastery-engine.ts`
- Modify: `types/progress.ts`
- Modify: `lib/storage.ts`
- Test: `tests/reading-reinforcement-answers.test.ts`
- Modify test: `tests/mastery-engine.test.ts`

**Interfaces:**
- `applyReadingResult(current:WordProgress, question:FrozenQuestion, correct:boolean, now:Date): {nextState:WordProgress; eventType:"quiz_correct"|"quiz_wrong"; metadata:Record<string,string|number|boolean>}`; `nextState.readingRevision=(current.readingRevision??0)+1`.
- `submitAnswer(userId:string,sessionId:string,questionId:string,answer:string):Promise<PublicSession|"conflict"|null>` validates server-frozen current item and delegates atomic commit.

- [ ] **Step 1: Write red tests.** Recognition correct changes recognition counters but not `reviewCount`/`lastReviewedAt`/FSRS; recognition wrong increases weak signal without SRS; Cloze/Recall correct use respectively `hard`/`good` through `scheduleNextReview`; wrong active uses `again`; immediate correct does not alone set stable/fluent. A replay returns same saved outcome after a simulated lost response; concurrent different answers for same item cannot both count; future/forged question ID is rejected. Compare Today tables/counters before and after all modes.

```ts
expect(applyReadingResult(fresh, cloze, true, now).nextState.lastRating).toBe("hard");
expect(applyReadingResult(fresh, recall, true, now).nextState.lastRating).toBe("good");
expect(applyReadingResult(fresh, recognition, true, now).nextState.reviewCount).toBe(fresh.reviewCount);
```

- [ ] **Step 2: Run red.** `npm test -- tests/reading-reinforcement-answers.test.ts tests/mastery-engine.test.ts`.
- [ ] **Step 3: Implement progress mapping and route.** Use existing `scheduleNextReview` only for active modes. Set `readingRevision` via normal `createWordProgress`/`migrateStorage` defaults; do not call browser `recordWordAnswer`. Store `mode:reading-recognition|reading-cloze|reading-recall` and `activeRecall` only for correct active modes. `calculateWordMastery` accepts correct `reading-cloze`/`reading-recall` as active, not passive/recognition. The POST body is strictly `{questionId,answer}`; grade against private frozen key; commit in Task 1's RPC; on CAS conflict reread/recompute once from latest state, then return 409 retryable if still conflicting. No optimistic response before commit.
- [ ] **Step 4: Run green and commit.** Focused tests, `supabase test db`, and typecheck; stage task files; commit `feat: apply atomic conservative reading answers`.

### Task 6: Guard legacy whole-state sync and migration

**Files:**
- Create: `supabase/migrations/20260925000200_reading_revision_guard.sql` (generate with Supabase CLI, then rename before first apply)
- Modify: `lib/sync/learning-sync.ts`
- Modify: `lib/sync/offline-queue.ts`
- Modify: `components/sync-queue-flusher.tsx`
- Modify: `lib/storage.ts`
- Modify: `app/api/sync/operations/route.ts`
- Create: `app/api/sync/word-states/[wordId]/route.ts`
- Modify: `lib/repositories/supabase/learner-repository.ts`
- Modify: `lib/sync/supabase-migration.ts`
- Modify: `types/sync.ts`
- Modify test: `tests/offline-sync.test.ts`
- Test: `tests/reading-reinforcement-sync.test.ts`
- Modify test: `supabase/tests/account_learning_rls.test.sql`

**Interfaces:**
- `apply_sync_operation` word-state branch compares `coalesce((current.state->>'readingRevision')::int,0)` with the incoming revision under a word-row lock, raising a distinct `READING_REVISION_CONFLICT` before inserting/retaining an operation receipt; no stale operation is marked applied.
- `/api/sync/operations` maps that condition to `409 {code:"READING_REVISION_CONFLICT"}`. `FlushResult` gains optional `conflict:{operationId:string;entityId:string}`; `flushSyncQueue` retains the exact operation and does not retry a permanent 409 every 30 seconds. `GET /api/sync/word-states/[wordId]` returns only that verified owner's authoritative word state for explicit reconciliation.

- [ ] **Step 1: Write red tests.** Sync revision 0 works before Reading; after an accepted Reading revision 1, queued revision 0 returns 409, leaves the full queued operation and server state unchanged; a direct authenticated `UPDATE word_learning_states` fails; a direct authenticated `INSERT review_events` with `reading-*` fails; generic learning-event sync with `reading-*` fails; local migration's guarded word-state import still succeeds when current revision matches. The conflict UI can export the exact pending JSON and offers either “稍后处理” or an explicit confirmed “使用云端版本” action; the latter fetches only the owner's server state, then removes only that queued word-state operation and hydrates that word locally without queuing a new word-state upload. A foreign word fetch is non-disclosing. Ensure unrelated sync kinds and account RLS tests still pass.

```ts
expect(result.conflict).toEqual({operationId:"old-snapshot",entityId:"adapt"});
expect(readSyncQueue(adapter)[0]).toEqual(oldSnapshot);
```

- [ ] **Step 2: Run red.** `npm test -- tests/offline-sync.test.ts tests/reading-reinforcement-sync.test.ts` and `supabase test db`.
- [ ] **Step 3: Run `supabase migration new reading_revision_guard`, rename before first apply, and implement guard at every write path.** Revoke authenticated `INSERT/UPDATE/DELETE` on `word_learning_states` but retain owner `SELECT`; update the old pgTAP expectation accordingly. Replace `apply_sync_operation` as a narrowly scoped `SECURITY DEFINER` function with `search_path=''`, explicit authenticated EXECUTE, strict `auth.uid()=p_user_id` check, and the word-state reading-revision equality guard; otherwise an invoker function loses its write privilege after the revoke. Route `SupabaseLearnerRepository.upsertWordState`/local migration through this guarded RPC rather than direct `.upsert`. Reserve `reading-*` event IDs from client `learning-event` sync, and deny direct authenticated insert into that namespace through RLS. Map Postgres conflict to typed 409; preserve queue entry and show a “同步冲突，原本地更改仍已保留” state in `SyncQueueFlusher` via an accessible status affordance. Implement export of the pending op before an explicitly confirmed cloud-version choice; `hydrateAuthoritativeWordState(wordId,state)` in `lib/storage.ts` changes only the local word and queues no word snapshot. Never discard or overwrite either copy automatically.
- [ ] **Step 4: Run green and commit.** `supabase db reset && supabase test db && npm test -- tests/offline-sync.test.ts tests/reading-reinforcement-sync.test.ts && npm run typecheck`; stage exact changed files; commit `fix: protect reading credit from stale word sync`.

### Task 7: Optional article, exercise, and resume UI

**Files:**
- Modify: `components/reading/daily-reading-article.tsx`
- Modify: `lib/reading/server-daily-reading-article-page.ts`
- Modify: `app/reading/daily/[id]/page.tsx`
- Create: `components/reading/reading-reinforcement.tsx`
- Create: `app/reading/reinforcement/[sessionId]/page.tsx`
- Modify: `app/reading/page.tsx`
- Test: `tests/reading-reinforcement-ui.test.tsx`
- Modify test: `tests/daily-reading-article-page.test.tsx`

**Interfaces:**
- Article props gain `{reinforcement:{availableCount:number;sessionId:string|null;status:"not-started"|"active"|"complete"}|null}`; keep existing read state independent.
- `ReadingReinforcement` accepts one public session, POSTs `{questionId,answer}`, and only advances after a confirmed response.

- [ ] **Step 1: Write red Testing Library tests.** A no-context article has no CTA; finishing a good article reveals “快速巩固 N 个词” plus skip/return, without changing “已完成阅读”; a detail click sends `detail-open` even if already read, but failed evidence save shows retry and keeps dialog open; accepted answer shows textual feedback; a failed/timeout answer preserves typed text and focus, with no score/cursor increment; resume renders persisted cursor; keyboard tab/Enter/Escape/focus return work.

```ts
expect(screen.queryByRole("link", {name:/快速巩固/})).not.toBeInTheDocument();
await user.click(screen.getByRole("button", {name:"完成阅读"}));
expect(await screen.findByRole("link", {name:/快速巩固 3 个词/})).toBeVisible();
expect(screen.getByText("已完成阅读")).toBeVisible();
```
- [ ] **Step 2: Run red.** `npm test -- tests/reading-reinforcement-ui.test.tsx tests/daily-reading-article-page.test.tsx`.
- [ ] **Step 3: Implement UI.** Send exposure only for actual highlighted summary tokens when the article summary is intentionally shown, never from recommendation cards or scroll polling; allow idempotent retry. Wire detail click to evidence without blocking the dialog. Show CTA only after server-confirmed article completion and nonzero eligible count. Before answer submit flush pending sync for that word; if conflict/offline, retain answer and offer retry. Hydrate only the server-confirmed word state on acceptance, never call `recordWordAnswer`. Render frozen context and feedback, responsive wrapping, `aria-live` status, focus management, and read-only completed view. Reading home lists at most three recent active session links separately from Daily-3.
- [ ] **Step 4: Run green and commit.** Focused tests, lint, and typecheck; stage task files; commit `feat: add optional reading reinforcement UI`.

### Task 8: End-to-end acceptance and final gates

**Files:**
- Create: `tests/e2e/reading-reinforcement.spec.ts`
- Modify: `scripts/rss-reading-audit.ts` only if an existing audit contract must recognize the new protected route; otherwise leave it unchanged.

**Interfaces:** No new runtime API. This task verifies the prior tasks as one user flow.

- [ ] **Step 1: Write the failing authenticated browser flow.** Use the existing local Supabase/browser fixture, not mocked login. Capture Today plan/session/target counts and Today Complete; open Daily-3, open Today and recent word details, finish the article, start the optional set, answer Recognition and Cloze, refresh and resume, answer Recall, revisit read-only result, then assert Today values exactly unchanged by Reading. Repeat the same `{sessionId,questionId,answer}` submission and assert one `review_events` row and one word-state revision. Capture 390/430/768/1440 viewport overflow and keyboard/focus assertions.

```ts
for (const width of [390, 430, 768, 1440]) {
  await page.setViewportSize({width, height: 900});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
expect(todayAfterReading).toEqual(todayBeforeReading);
```
- [ ] **Step 2: Run red.** `npm run test:e2e -- tests/e2e/reading-reinforcement.spec.ts`; an unimplemented route/flow must fail (not skip).
- [ ] **Step 3: Fix only defects exposed by this test, using a new failing unit/pgTAP regression first for each behavior.** Do not broaden into RSS, Today redesign, achievements, or Progress 2.0.
- [ ] **Step 4: Run all gates and preserve logs.** `supabase db reset && supabase test db`, database advisors, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run audit:rss-reading`, and `npm run test:e2e -- tests/e2e/reading-reinforcement.spec.ts tests/e2e/daily-reading.spec.ts`. Record actual pass/fail/skip counts; pre-existing skipped placeholders are not 2C evidence.
- [ ] **Step 5: Review diff, commit, and stop at Phase 2C.** `git diff --check`, exact-file stage of acceptance fixes/tests, commit `test: verify phase 2c reading reinforcement`, then use superpowers:verification-before-completion and superpowers:requesting-code-review. Report remaining limitations (summary scarcity, online submission, unresolved offline same-word conflict) instead of claiming those solved.

## Handoff checks

- Confirm the generated migration filename in Task 1 before writing imports or pgTAP assumptions; no preexisting migrations are edited after application.
- Task 6 uses its own declared migration. Do not silently rewrite Task 1's applied history.
- If the real production catalogue cannot provide three safe distinct summary contexts in an acceptance fixture, assert the actual smaller count and cover all three modes with a deterministic seeded local fixture; never fabricate a user-visible Daily-3 article.
- The standalone sync flusher must surface 409 conflict without draining the queue; if the current UI has no status affordance, add one in Task 6 and test it there.
- Avoid touching the existing unrelated untracked plan files or `supabase/.temp/`.
