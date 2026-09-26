# Rootline 2.0 Phase 5 — Real-use Beta Validation Design

## Purpose

Prepare a minimal, privacy-preserving way to observe seven real learning days and collect optional end-of-day feedback. Phase 5 evaluates sustainability, delayed retrieval, root-first usefulness, Review burden, Reading use, and Progress motivation. It is not a feature expansion phase.

## Decisions

- Participation is opt-in for a verified account. The participant ID is used only as a browser-storage namespace and is omitted from exports.
- Validation data stays in that browser's local storage. No Supabase table, analytics provider, telemetry API, article URL, article text, answer text, word IDs, or raw route IDs are added.
- Store daily aggregates only: plan target-source and new-word counts, active session/block/review durations, review outcomes by Mini/Final, current target source, and original root-core/support source when available, carryover/weak counts, Reading and Progress open/completion counts, recoverable-error and 409-recovery counts, and route timing samples for Today, Reading list/article, and Progress.
- Today API responses include transient `planCreated` metadata that is not stored in the frozen plan; opted-in clients distinguish plan creation from observation/reopen. Mini and Final Review outcome aggregates remain separate by source category.
- Use the plan's learning date for daily grouping. Measure foreground active time and pause it on hidden tabs, page leave, and browser close; retain separate wall-clock start/completion timestamps to describe elapsed time honestly.
- Provide an optional post-completion Beta Journal with the five requested questions. Skipping it never changes Today status. Limit free text to 500 characters and store it only locally.
- Provide explicit export and delete controls in Me. Export only the aggregated validation records and feedback, without participant ID or vocabulary/article identifiers.
- Incomplete days mean dates on which a plan was observed but not completed. Dates with no observed plan are reported as unobserved, not silently classified as failures.
- Seven days of learning must come from the participant's normal use. Tests and fixtures validate instrumentation only; they never count as Beta days. Do not issue a Phase 5 verdict until seven real learning dates are recorded and reviewed.
- Fourteen days are optional and require a human decision after the seven-day review.

## Architecture

`lib/beta/validation-store.ts` owns the versioned local schema, opt-in, account-scoped storage, aggregation updates, export, and deletion. It validates and bounds imported or stored values and exposes typed operations rather than allowing UI code to mutate JSON directly.

`lib/beta/validation-timer.ts` owns foreground timing and pause/resume behavior. Today emits semantic transitions to the timer/store for start, block, Mini Review, Final Review, completion, recoverable failures, and conflict recovery. It derives counts from the frozen Today plan and records category aggregates only.

`BetaRouteTracker` is mounted from the existing authenticated site shell. It records only allowlisted route categories and page timing samples when the current verified account has opted in. Reading article paths collapse to a single `reading-article` category; no article identifier or browsing content is retained. Reading reinforcement completion is recorded from its existing completion state.

`BetaJournal` appears on the completed Today screen for opted-in participants. It saves the requested ratings and optional bounded free text locally; a separate control exports or deletes the validation record from Me.

## Failure and privacy behavior

- Storage unavailable or malformed: disable collection and show a plain recoverable message; learning continues normally.
- Opt-out/delete: remove only this account's Phase 5 local validation keys. Do not touch learning progress, Today plans, or server state.
- Export failure: keep the local record and show a retry message.
- No article content, URL, title, word ID, answer text, email, or user ID is stored in the Phase 5 record/export.
- No migrations, service-role writes, network analytics calls, or external publication are part of this design.

## Evaluation limits

Source comparisons and retention observations are exploratory. Report actual denominators and dates; do not claim causality or significance. Without word-level cross-day linkage, next-day/delayed retention cannot be asserted from aggregate reviews; carryover/source groups remain exploratory only. A date with no observed plan is not evidence of non-completion. Performance values are browser-side route-effect-to-next-frame samples, not backend latency, LCP, or production p95. Reading/Progress route dates use browser-local time, while Today uses the account learning date; annotate timezone discrepancies near rollover.

## Acceptance

- Opt-in state and data are isolated by verified account in one browser.
- No data is recorded before opt-in; opt-out and delete remove only validation data.
- Today, block, Mini Review, Final Review timing survives refresh and excludes hidden-tab time.
- Source, carryover, weak-word, and review outcome counts match the frozen plan/session.
- Reading and Progress usage are counted without storing article or route identifiers.
- Journal can be skipped, edited before saving, bounded, and exported; it never blocks Today completion.
- Export contains no participant ID, raw word/article identifiers, article content, or email.
- Unit/component tests, full existing suite, lint, TypeScript, and production build pass.
- Final report distinguishes actual seven-day evidence from instrumentation tests and states all eight product answers with limits.
