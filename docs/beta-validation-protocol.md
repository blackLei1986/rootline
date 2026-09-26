# Rootline Phase 5 — real-use Beta protocol

Status: instrumentation is implemented; real-use evidence has not yet been collected. Automated tests and browser fixtures are engineering checks, never Beta learning days. No product verdict can be issued until the participant completes and reviews seven actual learning dates.

## Participant steps

1. Use the normal verified Beta account and the same browser/device for all seven dates. In Me, join “7 天 Beta 验证” before opening Today on the first observation date. This is voluntary; data remains in this browser and is not uploaded.
2. On each of seven actual learning dates, use the regular flow: Today → Daily 30 → Blocks A/B/C and Mini Reviews → Final Review → Complete. Reading and Progress remain optional. Do not use fixtures, test accounts, dev shortcuts, or manually enter telemetry.
3. After Today completion, optionally answer the five Beta Journal questions. Skipping does not affect completion.
4. Keep browser site storage intact during the run. At the end, export the JSON from Me and preserve it for review. Delete is available there and removes only this account's Beta keys from this browser.

Local-only storage means clearing browser data, changing browser/profile/device, or losing this device can lose the log. There is no server backup or cross-device merge. The account ID exists only in the local-storage key namespace and is not included in the log/export. Journal text is capped at 500 characters and strips URL, email, and obvious tagged identifiers before storage.

## Operational definitions

- **Observed date:** a date with an opted-in Today plan loaded. A date with no observed plan is unobserved, not an incomplete learning day.
- **Completed date:** an observed date with a server-confirmed Today completion transition. An observed date without that transition is incomplete, including a plan opened but never started.
- **Completion rate:** completed observed dates ÷ observed dates. Report the numerator/denominator and dates; do not substitute streak length or a fabricated pass threshold. Five to seven completed dates is an encouraging initial signal, not a decision rule by itself.
- **Plan created:** transient server response marker on the first creation response; only the browser holding an active opt-in records it. Reopened plans are not counted again. Opting in after creation cannot reconstruct a missed creation event.
- **Active duration:** visible foreground time while in a learning block/review. It is accumulated on view changes and paused on hidden tab, pagehide, and unmount. It excludes setup, network wait, hidden time, and idle time outside Today. Wall-clock start/completion timestamps remain separate. Compare active time and elapsed session span, not one as a substitute for the other.
- **Block/review burden:** `activityMilliseconds` separates `block-a/b/c`, `mini-review-a/b/c`, and `final-review`. Outcome keys use `mini|final:carryover|weak|root-core|support`; each gives correct/total. These are descriptive outcomes, not causal estimates.
- **Source counts:** carryover and weak targets are counted in their own categories; `originSource` also attributes them to Root Core or Support. `newWordCount` counts only targets whose current source is Root Core or Support, so it excludes carryover/weak. Mini/Final outcome keys retain both the current source and the original Root Core/Support cohort where known.
- **Retention limit:** this release does not store word IDs or link a specific word across dates. Carryover/weak source outcomes can provide exploratory recurrence signals, but cannot establish exact next-day or delayed retention for a word. Same-session recognition accuracy is not a memory-retention result. Cloze/weak recurrence claims need to remain qualitative unless an existing privacy-safe aggregate supports them.
- **Reading/Progress:** allowlisted route open counts only; nested Reading pages collapse to one `reading-article` category. Reading reinforcement increments only on a confirmed transition to complete. A route timing sample measures client-side route-effect-to-next-frame time, not server load, LCP, p95, or production performance.
- **Errors/reliability:** count recoverable Today save/reload failures and 409 conflict recovery. Also record refresh, browser restart, network interruption, multi-tab behavior, session expiry, and rollover observations in the issue log; not every condition has a dedicated automated counter.
- **Date source:** Today plan events use the persisted learning date. Reading and Progress route events use the browser's local calendar date. If the account learning timezone differs from the browser timezone near midnight, annotate the discrepancy; do not silently combine those dates. The controlled-clock cross-service midnight/DST scenario remains deferred.

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
