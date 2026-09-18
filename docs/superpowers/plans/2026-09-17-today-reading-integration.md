# Today Reading Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one suitable article in each eligible Today plan and complete the daily loop with article reading, five context questions, and cross-article vocabulary evidence.

**Architecture:** A server-side Today service combines vocabulary candidates with the ranked article pool, stores a stable plan version, and returns a minimal DTO. The client flow adds a Reading phase between focus learning and context questions; all outcomes use idempotent sync operations and source-aware encounter facts.

**Tech Stack:** Next.js 16.3.5, React 19.3, TypeScript 6, Supabase repositories/RLS, Vitest, Playwright, production Master Vocabulary.

**Spec:** `docs/superpowers/specs/2026-09-17-account-rss-today-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-17-account-cloud-data.md`, `docs/superpowers/plans/2026-09-17-rss-reading-pipeline.md`

## Global Constraints

- A generated Today plan persists at most one selected article.
- The normal 20-minute preference produces an approximately 22-minute plan with 15 reviews, 30 scan candidates, 7 focus words, one approximately six-minute article, and five article-context questions when enough material exists.
- Refreshing or reopening a started plan does not reshuffle its article or questions.
- Repeated uses of one word inside one article count as one cross-article encounter and one source encounter.
- Reading-derived words influence later Today/SRS selection but remain capped by the existing content mix.
- If no article passes the minimum threshold, Today remains usable and explains why Reading was omitted.
- Final acceptance recalculates `accepted lemma count` from deployed shards.
- The current workspace has no `.git` directory. Commit commands are conditional on a repository being initialized.

---

## File Map

- `types/today.ts`: persisted Today article, stage, and context-question DTOs.
- `lib/today/article-selection.ts`: eligible article choice and stable plan input.
- `lib/today/context-questions.ts`: deterministic five-question generation.
- `lib/today/service.ts`: load-or-create plan orchestration.
- `lib/repositories/supabase/today-repository.ts`: plan persistence and completion.
- `components/today-learning-flow.tsx`: seven-stage client experience.
- `components/today/article-reading-stage.tsx`, `article-context-quiz.tsx`: article-specific UI.
- `lib/reading/encounters.ts`: document/source-diversity facts.
- `app/api/today/route.ts`, `app/api/today/events/route.ts`: authenticated DTO and event endpoints.
- `tests/e2e/*`: account, migration, source, Today, and isolation journeys.

### Task 1: Extend Today contracts without breaking legacy plans

**Files:**
- Modify: `types/today.ts`
- Create: `types/context-question.ts`
- Test: `tests/today-contracts.test.ts`

**Interfaces:**
- Produces:

```ts
interface TodayArticleSelection {
  articleId: string;
  title: string;
  sourceTitle: string;
  canonicalUrl: string;
  estimatedMinutes: number;
  contentWordCoverage: number;
  targetWordIds: string[];
  selectionReasons: string[];
}

interface ContextQuestion {
  id: string;
  articleId: string;
  sentence: string;
  targetWordId: string;
  prompt: string;
  choices: string[];
  correctChoice: string;
}
```

`TodayPlan` gains `version`, `status`, `article: TodayArticleSelection | null`, `contextQuestions`, and an ordered `stages` array while retaining current word fields during migration.

`TodayPlanDTO` is the client-safe projection of `TodayPlan`: it contains vocabulary display fields, the selected article metadata and authorized sanitized text, questions without database metadata, stage status, and no user ID, provider token, repository row, or internal ranking features. `TodaySessionDTO` is `{ planId: string; status: "not-started" | "active" | "complete"; currentStage: string; completedQuestionIds: string[] }`.

- [x] **Step 1: Write serialization/backward-compatibility tests**

Verify a legacy plan receives `article: null`, an empty question list, and the legacy stages; a new plan round-trips one article and five questions without exposing full article text.

- [x] **Step 2: Run `pnpm vitest run tests/today-contracts.test.ts` and confirm failure**

- [x] **Step 3: Implement types and `normalizeTodayPlan(value)`**

Reject two article selections and duplicate question IDs. Freeze the stage order as `warmup → scan → learn → reading → context-quiz → summary`, omitting `reading` and `context-quiz` together when no article exists.

- [x] **Step 4: Run the focused test and type check**

Run: `pnpm vitest run tests/today-contracts.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint the contract migration**

If Git is available: `git add types/today.ts types/context-question.ts tests/today-contracts.test.ts && git commit -m "feat: extend Today with one article"`

### Task 2: Stable article selection and context-question generation

**Files:**
- Create: `lib/today/article-selection.ts`
- Create: `lib/today/context-questions.ts`
- Test: `tests/today-article-selection.test.ts`
- Test: `tests/context-questions.test.ts`

**Interfaces:**
- Produces `selectTodayArticle(candidates, recentHistory, budget): ArticleCandidate | null` and `buildContextQuestions(article, analysis, vocabulary, count): ContextQuestion[]`.

- [x] **Step 1: Write deterministic selection and question tests**

Assert the highest eligible candidate wins, completed/hidden/recently-repeated candidates are excluded, no eligible candidate returns `null`, exactly five unique questions are generated when five target contexts exist, each choice contains one correct answer, and the same article/plan seed produces the same order.

- [x] **Step 2: Run both suites and confirm failure**

- [x] **Step 3: Implement pure deterministic functions**

Select from the ranked top three using quality threshold, six-minute budget tolerance, and source diversity. Build cloze-style questions from actual article sentences and production-vocabulary meanings; select distractors with matching broad part of speech and never invent definitions. If fewer than five valuable targets exist, use additional matched content words from the article; if still fewer than five, omit the article from Today eligibility.

- [x] **Step 4: Run focused tests and type checking**

Run: `pnpm vitest run tests/today-article-selection.test.ts tests/context-questions.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint deterministic planning inputs**

If Git is available: `git add lib/today tests/today-article-selection.test.ts tests/context-questions.test.ts && git commit -m "feat: select Today article and context questions"`

### Task 3: Server-side load-or-create Today service

**Files:**
- Create: `lib/today/service.ts`
- Modify: `lib/repositories/supabase/today-repository.ts`
- Create: `app/api/today/route.ts`
- Test: `tests/today-service.test.ts`

**Interfaces:**
- Produces `getOrCreateTodayPlan(userId, learningDate, now): Promise<TodayPlanDTO>` and `regenerateUnstartedTodayPlan(userId, learningDate): Promise<TodayPlanDTO>`.

- [x] **Step 1: Write transaction and stability tests**

Two concurrent calls for one user/date must return the same plan ID and article ID. Reopening a started plan must return the stored questions. Regeneration is allowed only before the first session event and creates the next version.

- [x] **Step 2: Run `pnpm vitest run tests/today-service.test.ts` and confirm failure**

- [x] **Step 3: Implement transactional orchestration**

Load verified user preferences and learner snapshot, request the daily production vocabulary bucket, obtain ranked Reading candidates, select one eligible article, build five questions, and insert plan/items in one transaction. For the normal 20-minute preference use 15 due reviews, 30 scans, and 7 focus targets; cap Reading-derived rapid-scan entries at 20%.

The GET route authenticates, derives the user's local date from stored timezone, returns only `TodayPlanDTO`, and uses `Cache-Control: private, no-store`.

- [x] **Step 4: Run service and existing Today tests**

Run: `pnpm vitest run tests/today-service.test.ts tests/today-engine.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint persistent Today generation**

If Git is available: `git add lib/today/service.ts lib/repositories/supabase/today-repository.ts app/api/today tests/today-service.test.ts && git commit -m "feat: persist personalized Today plans"`

### Task 4: Add article Reading to the Today flow

**Files:**
- Modify: `components/today-learning-flow.tsx`
- Create: `components/today/article-reading-stage.tsx`
- Create: `components/today/article-context-quiz.tsx`
- Create: `components/today/today-setup.tsx`
- Test: `tests/today-flow-stages.test.tsx`

**Interfaces:**
- Consumes `TodayPlanDTO` from `/api/today`.
- Produces stage events `today_started`, `stage_completed`, `article_opened`, `article_completed`, `context_answered`, `today_completed`.

- [x] **Step 1: Write the stage-order component test**

Verify the setup card displays approximately 22 minutes and metrics `15 / 30 / 7 / 1 / 5`; completing focus learning opens the article stage; article completion opens the five-question context quiz; a plan with `article: null` skips both article stages and shows the stored degradation reason.

- [x] **Step 2: Run `pnpm vitest run tests/today-flow-stages.test.tsx` and confirm failure**

- [x] **Step 3: Refactor the flow into focused stage components**

Keep each stage's mutable index local to the orchestrator, fetch a stored Today plan instead of rebuilding it in `useEffect`, save progress after every stage transition, and render only the article content already authorized for the current plan. Preserve keyboard accessibility and current visual language.

- [x] **Step 4: Run stage tests, type checking, lint, and build**

Run: `pnpm vitest run tests/today-flow-stages.test.tsx && pnpm exec tsc --noEmit && pnpm eslint components/today components/today-learning-flow.tsx && pnpm build`

- [x] **Step 5: Checkpoint the integrated Today UI**

If Git is available: `git add components/today components/today-learning-flow.tsx tests/today-flow-stages.test.tsx && git commit -m "feat: add Reading stage to Today"`

### Task 5: Idempotent Today events and resume behavior

**Files:**
- Create: `app/api/today/events/route.ts`
- Create: `lib/today/events.ts`
- Modify: `lib/repositories/supabase/today-repository.ts`
- Modify: `lib/sync/offline-queue.ts`
- Test: `tests/today-events.test.ts`

**Interfaces:**
- Produces `recordTodayEvent(userId, event): Promise<TodaySessionDTO>` where every event contains `operationId`, `planId`, `stage`, `occurredAt`, and stage-specific result fields.

- [x] **Step 1: Write resume and duplicate-event tests**

Record one event twice and assert one persisted row; stop after article open and reload to assert resume at Reading; complete all five questions and assert Today becomes complete once; reject events for another user's plan.

- [x] **Step 2: Run `pnpm vitest run tests/today-events.test.ts` and confirm failure**

- [x] **Step 3: Implement validated event transitions**

The server derives ownership from the session, reloads the plan, validates legal stage progression, and updates aggregate session status transactionally. Add `today-event` to the offline queue allowlist while keeping plan generation server-only.

- [x] **Step 4: Run Today event and offline sync tests**

Run: `pnpm vitest run tests/today-events.test.ts tests/offline-sync.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint resumable Today sessions**

If Git is available: `git add app/api/today/events lib/today/events.ts lib/repositories/supabase/today-repository.ts lib/sync/offline-queue.ts tests/today-events.test.ts && git commit -m "feat: persist resumable Today stages"`

### Task 6: Source-aware vocabulary encounters

**Files:**
- Create: `lib/reading/encounters.ts`
- Modify: `lib/reading-actions.ts`
- Modify: `lib/repositories/supabase/learner-repository.ts`
- Modify: `lib/vocabulary-scoring.ts`
- Test: `tests/reading-encounter-diversity.test.ts`

**Interfaces:**
- Produces `recordArticleEncounter(input): Promise<EncounterSummary>` and `EncounterSummary = { totalOccurrences: number; distinctArticles: number; distinctSources: number; lastEncounterAt: string }`.

- [x] **Step 1: Write diversity tests**

Record five occurrences of one word in one article and assert one distinct article/source; record the word in a second article from the same source and assert two articles/one source; record a third source and assert two sources. Replaying an operation ID changes no counts.

- [x] **Step 2: Run the focused test and confirm failure**

- [x] **Step 3: Implement encounter facts and scoring input**

Persist one row per user/word/article, with occurrence count stored only as within-document context. Feed `distinctArticles` and `distinctSources` into vocabulary priority with small capped boosts; never replace SRS evidence or allow Reading encounters to mark a word mastered.

- [x] **Step 4: Run diversity, vocabulary-scoring, and Reading tests**

Run: `pnpm vitest run tests/reading-encounter-diversity.test.ts tests/value-scoring.test.ts tests/reading-analysis.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint trustworthy encounter evidence**

If Git is available: `git add lib/reading/encounters.ts lib/reading-actions.ts lib/repositories/supabase/learner-repository.ts lib/vocabulary-scoring.ts tests/reading-encounter-diversity.test.ts && git commit -m "feat: track cross-article vocabulary evidence"`

### Task 7: Graceful article degradation and observability

**Files:**
- Create: `lib/today/degradation.ts`
- Modify: `lib/today/service.ts`
- Create: `components/today/reading-unavailable.tsx`
- Create: `tests/today-degradation.test.ts`

**Interfaces:**
- Produces stable reasons `NO_SUBSCRIPTIONS`, `NO_FRESH_ARTICLES`, `NO_LEVEL_MATCH`, `EXTRACTION_UNAVAILABLE`, `ANALYSIS_STALE` and user-facing copy mapping.

- [x] **Step 1: Write fallback tests for every reason**

Each condition must still return a valid vocabulary-only Today plan, never throw from page rendering, and include one safe next action such as adding a source or importing an article.

- [x] **Step 2: Run the focused test and confirm failure**

- [x] **Step 3: Implement categorized degradation**

Log internal counts and source/job IDs server-side, return only the stable reason and safe action, and prefer the latest valid analyzed article before omitting Reading. Never silently use an article outside the quality threshold.

- [x] **Step 4: Run fallback tests, type checking, and build**

Run: `pnpm vitest run tests/today-degradation.test.ts && pnpm exec tsc --noEmit && pnpm build`

- [x] **Step 5: Checkpoint resilient Today behavior**

If Git is available: `git add lib/today/degradation.ts lib/today/service.ts components/today/reading-unavailable.tsx tests/today-degradation.test.ts && git commit -m "feat: degrade Today Reading safely"`

### Task 8: Browser acceptance journeys

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `playwright.config.ts`
- Create: `tests/e2e/account.spec.ts`
- Create: `tests/e2e/migration.spec.ts`
- Create: `tests/e2e/reading-today.spec.ts`
- Create: `tests/e2e/isolation.spec.ts`

**Interfaces:**
- Produces command `pnpm run test:e2e`.

- [x] **Step 1: Install Playwright test support and add failing smoke journeys**

Run: `pnpm add -D @playwright/test && pnpm exec playwright install chromium`

Tests cover register/verify/login through a local test helper, intended-page return, logout/reset, one-time local migration with interrupted retry, feed add/refresh/candidate open, Today `15 → 30 → 7 → 1 → 5`, resume after reload, and two-user isolation.

- [x] **Step 2: Run `pnpm run test:e2e` and confirm incomplete journeys fail**

- [ ] **Step 3: Add deterministic local fixtures and complete browser assertions**

Use a local fixture HTTP server bound to public-test host mapping only in the test environment; safe-fetch tests continue to mock DNS and must never weaken production checks. Seed two verified users and one feed/article set through server-only test setup.

- [ ] **Step 4: Run all browser journeys twice**

Run: `pnpm run test:e2e && pnpm run test:e2e`

Expected: both runs pass, demonstrating idempotent migration/events and stable persisted plans.

- [ ] **Step 5: Checkpoint end-to-end coverage**

If Git is available: `git add package.json pnpm-lock.yaml playwright.config.ts tests/e2e && git commit -m "test: cover account Reading and Today journeys"`

### Task 9: Final acceptance report

**Files:**
- Create: `scripts/final-product-acceptance.ts`
- Create: `tests/final-product-acceptance.test.ts`
- Create: `docs/final-product-acceptance.md`
- Modify: `package.json`

**Interfaces:**
- Produces command `pnpm run acceptance:final` and a machine-readable JSON summary plus Markdown report.

- [x] **Step 1: Write a failing acceptance-script test**

The test requires named results for account flow, RLS, migration idempotency, RSS safety, article deduplication, candidate limit, Today article count, five questions, degradation, full test/build status, and `acceptedLemmaCount`.

- [x] **Step 2: Run the focused test and confirm failure**

- [x] **Step 3: Implement the acceptance aggregator**

Read the production vocabulary report result rather than a manifest count. Fail unless `acceptedLemmaCount === 9000`, Today plans contain zero or one article, eligible article plans contain five questions, and every prerequisite audit exits successfully.

- [x] **Step 4: Run the complete release gate**

Run: `pnpm run vocab:production-report && pnpm run audit:account-cloud && pnpm run audit:rss-reading && pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build && pnpm run test:e2e && pnpm run acceptance:final`

Expected: all commands pass and `docs/final-product-acceptance.md` reports `accepted lemma count: 9000`.

- [x] **Step 5: Checkpoint the completed optimization**

If Git is available: `git add scripts/final-product-acceptance.ts tests/final-product-acceptance.test.ts docs/final-product-acceptance.md package.json && git commit -m "test: certify account RSS and Today integration"`
