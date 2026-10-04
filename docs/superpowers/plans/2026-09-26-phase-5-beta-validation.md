# Rootline 2.0 Phase 5 Beta Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Execute inline as previously requested.

**Goal:** Add opt-in local Beta measurement and feedback tools, then support a seven-day real-use review without fabricating learner evidence.

**Architecture:** Keep all Phase 5 telemetry in account-scoped browser storage behind explicit opt-in. Instrument existing Today and route flows, aggregate only counts and durations, add a skippable completion journal, and export/delete controls in Me. No telemetry API, external analytics service, schema migration, or new major product feature.

**Tech Stack:** Existing Next.js 16.3.5 App Router, React, TypeScript, localStorage, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-phase-5-beta-validation-design.md`; user requirements: Phase 5 attachment dated 2026-09-26.

## Global Constraints

- Store no Phase 5 telemetry before account opt-in.
- Keep telemetry local to one browser and namespace it by the verified account ID; omit that ID from export.
- Do not collect article identifiers/content/URLs, vocabulary identifiers, answers, email, or raw user identifiers in automatic telemetry. The participant-authored optional journal note is local free text and cannot be guaranteed free of arbitrary sensitive prose.
- Preserve optional Reading, the frozen 30-word capacity, SRS behavior, account isolation, and Today completion semantics.
- Never count automated tests, fixtures, or developer shortcuts as real-use Beta days.
- Report unobserved dates distinctly from incomplete observed plans.
- Do not make a seven-day product verdict or start a fourteen-day extension without actual seven-day evidence.
- Do not deploy, write production telemetry, or alter production learner data.

## Review Focus

1. Account switching or logout must never expose another participant's local journal or validation log.
2. Refresh, hidden tabs, browser close, and leaving Today must not inflate active learning duration or lose accumulated duration.
3. A learner who skips the journal must still retain the same completed Today state.
4. Automatic fields in export must exclude email, account ID, article/word IDs, URLs, titles, content, and answer strings. The optional participant-authored note is exported as feedback after bounded pattern redaction; the UI warns that arbitrary titles, answers, and personal details cannot be recognized reliably.
5. Plan dates with no observed session must not be counted as incomplete learning days.

## File and interface map

- `lib/beta/validation-store.ts`: versioned local schema, participant opt-in, day aggregation, export, and deletion.
- `lib/beta/validation-timer.ts`: visible active-time state and lifecycle pause/resume.
- `components/beta/beta-route-tracker.tsx`: allowlisted route usage and client timing observations.
- `components/beta/beta-participant-controls.tsx`: opt-in, export, and delete in Me.
- `components/today/beta-journal.tsx`: optional post-completion ratings and bounded text.
- `components/today/daily-30-flow.tsx`, `components/today-learning-flow.tsx`: event and timing instrumentation at existing transitions.
- `components/site-header-shell.tsx`, `app/today/page.tsx`, `app/settings/account/page.tsx`, `app/reading/page.tsx`, `app/progress/page.tsx`, `components/reading/reading-reinforcement.tsx`: verified account context and allowlisted use events.
- `tests/beta-validation-store.test.ts`, `tests/beta-validation-timer.test.ts`, `tests/beta-route-tracker.test.tsx`, `tests/beta-journal.test.tsx`, `tests/today-service.test.ts`, `tests/today-flow-stages.test.tsx`, `tests/reading-reinforcement-ui.test.tsx`, `tests/me-page.test.tsx`: isolation, privacy, timing, plan metadata, Reading completion, and skip behavior.
- `docs/beta-integration-evidence.md`: append implementation and actual-use evidence without pre-filling future outcomes.
- `docs/beta-validation-protocol.md`: participant instructions, daily checklist, data definitions, and 7-day/14-day review template.

### Task 1: Build the opt-in local validation store — complete

**Interfaces:** `getBetaParticipation(userId): boolean`; `setBetaParticipation(userId, enabled): void`; `recordBetaEvent(userId, learningDate, event): void`; `readBetaLog(userId): BetaValidationLog`; `exportBetaLog(userId): Blob`; `deleteBetaLog(userId): void`.

- [x] Write failing tests for account-scoped keys, no collection before opt-in, schema validation, bounded free text, export redaction, and delete isolation.
- [x] Run `pnpm exec vitest run tests/beta-validation-store.test.ts`; expected: the new module/exported symbols are missing.
- [x] Implement a versioned daily aggregate schema. Do not persist raw event history or identity/content identifiers.
- [x] Re-run the focused tests; expected: all account, redaction, and deletion assertions pass.
- [x] Commit `feat(beta): add private local validation store`.

### Task 2: Add foreground Today timing and source/review aggregates — complete

**Interfaces:** `startBetaActivity`, `switchBetaActivity`, `pauseBetaActivity`, `resumeBetaActivity`, and `recordTodayBetaTransition` accept account key, plan learning date, semantic section, block, and aggregate outcome fields; they never accept article or word identifiers.

- [x] Write failing tests for start/completion, A/B/C durations, Mini/Final Review timing/outcomes, source counts, carryover/weak counts, pause/resume, hidden-tab exclusion, refresh persistence, and duplicate transition handling.
- [x] Run focused tests; expected: timing/transition APIs are absent and count assertions fail.
- [x] Implement a persisted active timer and emit events only after the corresponding Today operation is confirmed.
- [x] Instrument Today plan observation, start, completion, block/review transitions, recoverable errors, and 409 recovery.
- [x] Run Today unit/component tests plus the focused new suite; expected: the exact frozen-plan aggregates match and existing Today behavior is unchanged.
- [x] Commit `feat(beta): measure Today workload and review outcomes`.

### Task 3: Add allowlisted Reading/Progress usage and route timing — complete

- [x] Write failing tests that only `/today`, `/reading`, `/reading/article`, and `/progress` categories are counted; dynamic IDs and article metadata never enter storage/export; Reading completion increments only after the real completed state; route timing records are bounded.
- [x] Run focused tracker and Reading reinforcement tests; expected: tracking is absent.
- [x] Mount the tracker from the authenticated site shell and wire existing Reading/Progress views to aggregate category counts only.
- [x] Re-run focused tests and existing Reading/Progress suites; expected: categories aggregate and unrelated routes are ignored.
- [x] Commit `feat(beta): record private Reading and Progress use`.

### Task 4: Add optional Beta Journal and Me controls — complete

- [x] Write failing component tests for opt-in consent copy, four 1–5 ratings, continue-tomorrow yes/no, 500-character text limit, skip behavior, export, delete, and account isolation.
- [x] Run focused tests; expected: controls and journal are absent.
- [x] Add local-only opt-in/export/delete in Me and the post-completion journal. Skipping cannot call Today APIs or alter completion.
- [x] Run focused tests, account settings tests, Today completion tests, and privacy export tests; expected: all pass without changing Today status.
- [x] Commit `feat(beta): add optional local Beta Journal`.

### Task 5: Document real-use protocol and verify integration — engineering complete; authenticated local E2E unavailable

- [x] Add `docs/beta-validation-protocol.md` with operational definitions, daily process, retention limits, P0/P1/P2 log, and empty 7-day review template.
- [x] Update `docs/beta-integration-evidence.md` only with implemented gates; mark all real-use fields as pending until observed.
- [x] Run `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`. The authenticated local browser journey could not run: required `BETA_SUPABASE_CLI`/`BETA_SUPABASE_WORKDIR` are unset and Docker access is denied in this environment. This is a limitation, not a pass.
- [x] Audit browser bundle/storage/export for secrets and forbidden identifiers; verify opt-out, deletion, and test fixture cleanup. (Local authenticated fixture cleanup is not applicable because that journey did not run.)
- [x] Commit `docs(beta): define real-use validation protocol`.

### Real-use gate after implementation

- [ ] Participant opts in using the normal verified account and browser.
- [ ] Observe seven actual learning dates. Do not simulate days or write results on the participant's behalf.
- [ ] Export and review actual records; calculate completion rate, median/range and any supported high percentile, source-group later retrieval, review burden, carryover, Reading/Progress usage, and ratings.
- [ ] Classify issues P0/P1/P2 and implement only evidence-backed small fixes with regressions and post-fix verification.
- [ ] Report all 26 Phase 5 final-report items and eight product questions. Select `BETA_VALIDATED`, `BETA_VALIDATED_WITH_ADJUSTMENTS`, or `BETA_REQUIRES_REDESIGN` from observed evidence. Ask before any 14-day extension; do not begin another phase.
