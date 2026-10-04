# Rootline Phase 5 — real-use Beta protocol

Status: Web Beta server evidence is implemented and locally verified; deployed authenticated acceptance and real-use evidence have not yet been collected. Automated tests and browser fixtures are engineering checks, never Beta learning days. No product verdict can be issued until the participant completes and reviews seven actual learning dates.

The isolated Supabase Beta project `herfdyzgvhiawbiplkzo` has the full migration chain, including the append-only evidence table, and the approved Gold v5 import (`0a35c37808d7cd6609bb9bd24a24d8ae99664384c7100f3ada88ac1314250967`): 48 roots, 593 verified Gold words, and 422 exact-lemma projections marked derived/pending review. The import is content provisioning, not a completed authenticated Daily 30 check. The separate `rootline-phase5-beta` Vercel project does not touch the existing `rootline` production project. Vercel automatically placed that isolated project's first probing deployment in its own Production slot despite omitting `--prod`; it has no Supabase credentials and is not a usable Beta site. The platform requires owner-interactive confirmation to pause that slot. Subsequent Beta deployments must explicitly target Preview. Neither project establishes Day 1 evidence until the deployed, authenticated browser smoke passes.

## Participant steps

1. Use the normal verified Beta account in one browser tab for all seven dates. In Me, join “7 天 Beta 验证” before opening Today on the first observation date. This is voluntary; in the isolated Web Beta, events and optional Journal answers are uploaded to the dedicated Beta database after opt-in. The browser keeps a retry queue and local summary; it is not the authoritative seven-day export. If the same account is used in overlapping tabs, mark that date's local Beta aggregates unreliable and record the multi-tab observation separately in the issue log. The P1 remains open.
2. On each of seven actual learning dates, use the regular flow: Today → Daily 30 → Blocks A/B/C and Mini Reviews → Final Review → Complete. Reading and Progress remain optional. Do not use fixtures, test accounts, dev shortcuts, or manually enter telemetry.
3. After Today completion, optionally answer the five Beta Journal questions. Skipping does not affect completion.
4. Keep browser site storage intact so unsent events can retry. Export the authenticated server JSON from Me after each learning date and retain each date's file; the append-only Beta event table is the persisted source. “删除本地记录” removes only this account's browser Beta keys and pending queue, not already uploaded server records. Arrange server-side deletion separately if requested by the participant.

The Web Beta records each event under a separate account-scoped browser queue key and an immutable `(user_id,event_key)` server key. Server exports include the account ID and deployment commit(s), so they are sensitive Beta evidence and must be stored privately. Journal text is capped at 500 characters and strips URL, email, UUID, and obvious tagged identifiers before server insertion. The filter cannot reliably recognize an arbitrary article title, answer, name, or private detail in free text; participants must avoid entering them. A malformed local log is preserved and new measurement stops until the participant backs it up or deletes it. The server report never falls back to a local snapshot on a failed request. The legacy local-only mode remains for non-Web-Beta environments.

`todayCompletedFromEvents` is only client telemetry. Count a day as completed in Phase 5 analysis only when `todayCompletionVerified` is true: the export checks that this account has a matching completed Today plan and session in the authoritative database. A direct client POST cannot by itself prove completion. Activity times, Journal answers, and route observations remain client-supplied and need the normal learner-use protocol plus consistency review. Export must wait for an empty upload queue; an upload failure blocks a complete download instead of silently omitting events.

## Operational definitions

- **Observed date:** a date with an opted-in Today plan loaded. A date with no observed plan is unobserved, not an incomplete learning day.
- **Completed date:** an observed date with a server-confirmed Today completion status, including a status confirmed after a lost response or 409 conflict. An observed date without confirmation is incomplete, including a plan opened but never started. On recovery, `completedAt` is the time the client first observed confirmation, not necessarily the exact server completion time.
- **Completion rate:** completed observed dates ÷ observed dates. Report the numerator/denominator and dates; do not substitute streak length or a fabricated pass threshold. Five to seven completed dates is an encouraging initial signal, not a decision rule by itself.
- **Plan created:** transient server response marker on the first creation response; only the browser holding an active opt-in records it. Reopened plans are not counted again. Opting in after creation cannot reconstruct a missed creation event.
- **Active duration:** visible foreground time while in a learning block/review. It is accumulated on view changes and paused on hidden tab, pagehide, unmount, and pending saves. A timer marker from a previous browser document is discarded on reload. It excludes setup, network wait, hidden time, and idle time outside Today. Wall-clock start/completion timestamps may represent observation rather than exact server event time after recovery. Compare active time and elapsed session span with that limitation.
- **Block/review burden:** `activityMilliseconds` separates `block-a/b/c`, `mini-review-a/b/c`, and `final-review`. Outcome keys retain review kind, current source, and original source where known; each gives correct/total. Numeric event revisions are retained locally only for deduplication, including out-of-order confirmations. Confirmed pending review answers are recovered after reload when the server snapshot contains the matching answer. An older answer that cannot be linked to the pending operation is not reconstructed. These are descriptive outcomes, not causal estimates.
- **Source counts:** carryover and weak targets are counted in their own categories; `originSource` also attributes them to Root Core or Support. `newWordCount` counts only targets whose current source is Root Core or Support, so it excludes carryover/weak. Mini/Final outcome keys retain both the current source and the original Root Core/Support cohort where known.
- **Retention limit:** this release does not store word IDs or link a specific word across dates. Carryover/weak source outcomes can provide exploratory recurrence signals, but cannot establish exact next-day or delayed retention for a word. Same-session recognition accuracy is not a memory-retention result. Cloze/weak recurrence claims need to remain qualitative unless an existing privacy-safe aggregate supports them.
- **Reading/Progress:** allowlisted route open counts only; nested Reading pages collapse to one `reading-article` category. Reading reinforcement increments after a server-confirmed complete state, including a completed session reopened after a lost response, only if that session was previously observed active while the account was opted in. Opting in after completion or rejoining after deletion never backfills an old completion. Local noncryptographic hashes of the Reading session ID provide consent-bound observation and completion deduplication; these tokens are excluded from JSON export. The count is attributed to the browser-local date of the latest confirmed answer. A route timing sample measures client-side route-effect-to-next-frame time, not server load, LCP, p95, or production performance.
- **Errors/reliability:** count recoverable Today save/reload failures and 409 conflict recovery. Also record refresh, browser restart, network interruption, multi-tab behavior, session expiry, and rollover observations in the issue log; not every condition has a dedicated automated counter. Per-document timer keys avoid direct timer overwrites, but whole-log browser storage updates are not atomic across tabs. Same-account overlapping tabs can still lose Beta counts; exclude affected dates from quantitative comparisons until this is fixed.
- **Date source:** Today plan and session events use the persisted learning date. Today, Reading, and Progress route-open/timing events use the browser's local calendar date. If the account learning timezone differs from the browser timezone near midnight, annotate the discrepancy; do not silently combine those dates. The controlled-clock cross-service midnight/DST scenario remains deferred.

## Daily checklist (leave empty until actually observed)

| Learning date | Today observed | Started | Completed | Active minutes | Block A/B/C | Mini A/B/C | Final Review | Carryover / weak | Reading opened/completed | Progress opened | Errors / 409 | Journal |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| Day 1 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 2 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 3 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 4 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 5 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 6 |  |  |  |  |  |  |  |  |  |  |  |  |
| Day 7 |  |  |  |  |  |  |  |  |  |  |  |  |

## Issue log

| Date | Priority (P0/P1/P2) | Observed issue | Evidence | Minimal fix proposal | Affected tests | Post-fix validation |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

Engineering review findings before the real-use run (these are not learner observations):

| Date | Priority | Observed issue | Evidence | Minimal fix | Regression | Post-fix validation |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | P0 | Switching accounts kept the first account's journal draft in component state | Account-switch component test failed before the remount fix | Key the form by account and learning date | `beta-journal.test.tsx` | Focused and full suites passed |
| 2026-10-04 | P0 | Deleting a Beta log left a running timer; malformed logs could be overwritten | Store regressions failed before fixes | Remove account timer on delete; preserve malformed raw record and stop new writes | `beta-validation-store.test.ts`, `beta-journal.test.tsx` | Focused and full suites passed |
| 2026-10-04 | P0 | Confirmed Today completion/review could be absent from Beta aggregates after response loss or 409 | Recovery regressions failed before fix | Record only confirmed recovered transitions and a confirmed complete snapshot | `today-conflict-recovery.test.tsx` | Focused and full suites passed |
| 2026-10-04 | P1 | A stale browser-document timer and pending saves inflated active time | Reload regression measured 61 seconds where 1 second was expected | Reject a previous document's timer marker; pause during save | `beta-validation-timer.test.ts`, `today-conflict-recovery.test.tsx` | Focused and full suites passed |
| 2026-10-04 | P1 | UUIDs in optional free text survived the original sanitizer | Store export regression failed before fix | Strip UUID patterns; explicitly warn about unrecognized free text | `beta-validation-store.test.ts` | Focused and full suites passed |
| 2026-10-04 | P1, unresolved | Concurrent same-account tabs can overwrite aggregate Beta log writes | Read/modify/write of one local log has no cross-tab transaction; reviewer traced competing writes | Restrict the seven-day quantitative run to one tab; evaluate a transaction-safe storage design only if multi-tab use becomes necessary | No deterministic browser race test yet | Not passed; affected multi-tab dates must be marked unreliable |
| 2026-10-04 | P0 | Reopening an old Reading completion after joining or rejoining could backfill pre-consent/deleted data | Two component regressions failed before the consent-boundary fix | Require a same-session active observation recorded under opt-in before accepting a completed snapshot | `reading-reinforcement-ui.test.tsx` | Focused and full suites passed |
| 2026-10-04 | P1 | Browser-only validation data could be lost on browser/device change and a single anonymous export could overwrite prior-day evidence | Existing local-only store and export path; no server table or date-keyed record | Append-only, account-scoped server event ledger with retry queue, authenticated daily report, and explicit consent copy | `beta_evidence_rls.test.sql`, `beta-evidence-*.test.ts`, `beta-journal.test.tsx` | Disposable 21-migration replay and 176 pgTAP assertions; deployed acceptance pending |
| 2026-10-04 | P1 | Review found a reopened completion could inflate duration and a failed/in-flight upload could yield an incomplete export | Regressions failed before the fix; browser completion events are not authoritative Today state | Stable completion revision and first completion timestamp; await in-flight queue and refuse incomplete export; corroborate completed date with Today plan/session | `today-conflict-recovery.test.tsx`, `beta-evidence-*.test.ts`, `beta-validation-store.test.ts` | Focused and full 589-test suite, lint, typecheck, and build passed; deployed acceptance pending |

P0 means data integrity/security/critical function; P1 means material learning/product friction; P2 means polish. During this Beta, implement only small changes supported by observed evidence. Preserve Daily 30 until several real dates support a workload decision. Never auto-expand this into feature work.

## Seven-day review template

- Observed dates: pending real use
- Completed dates / completion rate: pending real use
- Active time: median, range, and high percentile only if sample size supports it (at least 20 observations for p90); report N and any incomplete sessions.
- Block A/B/C and Mini/Final Review: median/range, correct/total, missing observations.
- Carryover: dates and counts; whether it felt punitive.
- Root Core vs Support: actual denominators and exploratory outcome comparisons; no significance or causal claim.
- Next-day/delayed retention: state the linkage limitation above; report only what actual aggregate evidence can support.
- Reading use and reinforcement: opened/completed counts and learner relevance notes.
- Progress use and motivation: open counts and learner comments.
- Journal: N per question, rating distribution, continue-tomorrow answers, sanitized comments.
- Reliability/performance: observed refresh/restart/network/multi-tab/session/date-rollover behavior; route timing N/range only.
- P0/P1/P2 issues, evidence-backed adjustments, unresolved issues, and the deferred midnight/DST integration test.
- Explicit answers to the eight product questions and one verdict: `BETA_VALIDATED`, `BETA_VALIDATED_WITH_ADJUSTMENTS`, or `BETA_REQUIRES_REDESIGN`.
- After this seven-day review, decide whether to stop, make a supported small fix, or request the optional 14-day extension. No extension is automatic.

## Final Phase 5 report — 26 required items

1. Beta duration; 2. completed learning days; 3. Daily completion rate; 4. actual learning-time distribution; 5. Block duration; 6. Mini Review burden; 7. Final Review burden; 8. carryover behavior; 9. Root Core vs Support observations; 10. next-day retention; 11. delayed retention; 12. Reading usage; 13. Reading reinforcement observations; 14. Progress usage; 15. Beta Journal results; 16. reliability issues; 17. performance observations; 18. P0 issues; 19. P1 issues; 20. P2 issues; 21. fixes made; 22. unresolved issues; 23. deferred midnight/DST test status; 24. answers to the eight product questions; 25. Phase verdict; 26. recommendation for Release Candidate.

Public production release is separately gated and is not authorized by an internal Beta verdict. Stop after the Phase 5 verdict; do not start another feature phase automatically.
