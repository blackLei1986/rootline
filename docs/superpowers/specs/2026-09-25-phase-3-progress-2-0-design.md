# Rootline 2.0 — Phase 3 Progress 2.0 Design

## Purpose and boundaries

Progress answers whether the learner is completing Today consistently, how many useful words have become stable, which trusted roots are strengthening, and how far stable vocabulary is from the approximately 10,000-word goal. It is a learner-facing account page, not a developer analytics view. Phase 3 must not expand Reading or change Daily 30 completion, SRS scheduling, Today selection, or previously accepted Phase 1B–2C behavior. The production catalog currently contains 9,750 entries; that inventory is **not** the long-term goal denominator.

The user-approved direction is server-side aggregation, conservative mastery, an explicit partial-history denominator, and observed snapshots from Phase 3 forward. Do not display estimated vocabulary without a validated estimation model.

## Existing sources of truth

- `today_plans.learning_date`, `status`, `plan_snapshot`, and `today_sessions.status/outcomes` are the frozen Daily 30 record. A Reading article or reinforcement session is not Today completion.
- `profiles.timezone` and `learningDateForTimeZone`/`shiftLearningDate` define the learner's local date. UTC timestamps are never substituted for `learning_date` when classifying a completed day.
- `word_learning_states.state` holds each word's SRS/progress state. `calculateWordMastery(...).stable` is the established stable rule: delayed review at least 24 hours after first learning, at least two correct/verification successes, memory strength at least 55, latest rating not `again`, and no review more than 14 days overdue. It requires more than passive encounters or recognition alone. Progress must call this shared rule rather than copy its thresholds into SQL.
- `review_events` stores immutable learning and Reading evidence. Use only bounded event reads for secondary statistics; do not fetch the whole event history to the browser. Current `SupabaseLearnerRepository.getSnapshot()` caps events at 500, so it is not an authoritative source for whole-history growth reconstruction.
- A published Gold morphology dataset with approved, verified word records and root segments is the only trusted root-to-word mapping. Root page views and unreviewed/derived links do not create root mastery.

## Dashboard contract

The `/progress` page is a server-rendered, account-scoped destination. It obtains a verified viewer and renders a compact DTO; the browser never calculates metrics from the entire local storage snapshot. An unverified or signed-out visitor sees an account sign-in/verification state, not another account's data. The page uses `private, no-store` semantics where applicable and does not include hidden answer keys or raw learning events in the rendered payload.

The service queries only the viewer's `user_id`, validates catalog IDs, and returns:

| Field | Meaning |
| --- | --- |
| `today` | Learning date, required target count from the frozen plan, completed target count from the matching session, and completion status. No plan is `not-started`, not a fabricated `0/30` plan. If the frozen plan contains fewer than 30 targets, display its actual denominator and a shortage explanation. |
| `last7`, `last30` | Completed days, eligible days, percentage or `null`, and per-day status for the relevant dates. |
| `streak` | Consecutive completed Today learning dates ending today if complete, otherwise yesterday; no streak is inferred from Reading or general activity counters. |
| `vocabulary` | Mutually exclusive touched, learning, and stable word counts plus stable/10K percentage. |
| `roots` | Trusted root rows: usable linked catalog words, learned count, stable count, stable/usable percentage, and a short current weak-word list. |
| `growth` | Observed daily stable-vocabulary snapshots; no points or interpolation before Phase 3 capture. |
| `reading` | At most one secondary, account-scoped recent contextual-reinforcement figure, kept separate from completion/streak. |

### Today and completion definitions

For each learning date, select the highest frozen `generation_version` for the learner. A date is complete only when the selected plan's `status = complete`, the matching Today session's `status = complete`, and the plan has its completion timestamp. The authoritative date is the stored `learning_date`; completion time is evidence of completion, not a way to recalculate its date. A partial target count never marks the day complete on its own. No Reading event is consulted.

Eligible dates start at the learner's **first persisted Today plan date**, not account creation or a guessed registration date. Each calendar learning date from that first plan through the current local date is eligible, including dates without a generated plan after learning began. The 7- and 30-day windows are inclusive of the current local date and clipped at the first plan date. `percentage = round(100 × completed / eligible)` when eligible > 0; otherwise the percentage is unavailable and UI says there is not yet a learning history. If a timezone change makes the first stored plan date fall after the current local date, the eligible count is zero until the current date catches up. A new learner with one plan therefore has denominator 1, not 7 or 30. This denominator measures consistency and does not reward opening Today only on successful days. The current unfinished day is shown explicitly as in progress; its inclusion in the rate is disclosed in the UI text.

The seven-day strip uses date labels plus completed/incomplete/not-yet-started text or accessible names. Streak allows today's unfinished plan as a grace day, then counts backward from yesterday. It stops on the first missed eligible date and does not use legacy `dailyStats` or generic study activity.

### Vocabulary states and 10K

Count distinct production-catalog word IDs; do not extrapolate from current catalog size, count duplicate events, or count unknown legacy IDs toward 10K. `stable` is the shared mastery predicate above. `learning` means a non-stable word with active learning/review evidence (`firstLearnedAt`, review/correct/verification evidence, or a non-new SRS state). `touched` means a non-stable, non-learning word with a passive encounter, detail-open, recognition, or other exposure record. The server obtains a **distinct set of word IDs**, not full payload history, for lifetime passive evidence in `review_events`; this includes Reading exposure that did not create a word-state row. A word occupies exactly one headline state, in `stable > learning > touched` priority. A word with no learner evidence is not counted. Reading exposure may increase touched, but cannot by itself increase learning or stable. Support Words are eligible if they are accepted catalog words with real learner evidence; no artificial root-core-only filter applies to vocabulary totals.

The primary progress numerator is the current stable count and denominator is **10,000**, even while the catalog has 9,750 entries. Display the integer stable count and a conservative one-decimal percentage, capped at 100%. Estimated vocabulary is deferred: the current catalog and per-word learning evidence do not supply a calibrated population estimate or confidence interval for unseen words, so a number such as “约 2,100” would be invented precision.

### Root mastery

Resolve the latest published Gold morphology dataset and include only `approved` plus `verified` word morphology records and their linked root segments. Keep only word IDs present in the production catalog. Deduplicate a word within each root, including when a word has multiple segments for that root. A Support Word with a trusted morphology link and genuine progress counts just like a root-core target. A word may contribute to multiple roots when it has multiple trusted roots; root counts are **not** added to produce the global vocabulary total.

For a root, `usable` is the number of trusted linked catalog words; `learned` is the number in learning or stable states; `stable` is the number meeting the shared stable predicate; `mastery % = round(100 × stable / usable)` when usable > 0. Recently weak words are linked words with current `again`/lapse or overdue-review evidence, sorted by recency/urgency and capped for display. They do not increase mastery. The first screen shows a few top mastered and currently strengthening roots; an accessible deeper list may show the rest without overwhelming the first viewport. Roots with no trusted usable words have no percentage and cannot appear as mastered.

### Growth history and secondary Reading

Stable vocabulary cannot be reconstructed faithfully from old immutable events alone: historical memory strength, latest rating, and overdue status were not snapshotted. Add a minimal `progress_vocabulary_snapshots` table keyed by `(user_id, learning_date)` with nonnegative `stable_count`, catalog version, and capture timestamp. On a verified Progress request, compute the current stable count and atomically upsert **that learner's current local date**. Repeated requests with the same state leave the same daily count; if the state changes within the day, the latest observed count replaces it. Old days are never backfilled or interpolated. The chart labels its first observed date and uses only recorded points; with fewer than two points, show a text explanation rather than a fake line. Snapshots are observations on visits, not proof that no growth occurred between visits.

The snapshot table has RLS and a `(user_id, learning_date)` primary/unique key; `anon` and `authenticated` have no direct write grant. Server writes use the verified user ID. Reads are account-scoped. Add only the index/query structure needed for user/date range lookup. No background analytics infrastructure or scheduled job is introduced.

Reading may show a single secondary seven-day contextual-reinforcement count derived from distinct saved `reading_encounter` word evidence or completed reinforcement sessions. It uses the learner's timezone-bounded window and must not alter Today, streak, stable status, or root totals except through the already accepted word-state/SRS effects of active Reading answers. If a reliable bounded query is not available, omit the optional Reading card rather than infer it from article views or minutes.

## Data flow and implementation boundaries

Keep metric formulas in pure `lib/progress/` functions with explicit `now`, timezone/local learning date, bounded plan rows, word states, trusted root links, and observed snapshots as inputs. A server-only Progress repository fetches latest-version plans for the 30-day window plus the first-plan date, matching sessions, paginated word states (not the 500-event learner snapshot), a database-aggregated distinct set of passive-evidence word IDs, trusted morphology links, bounded recent Reading evidence, and daily snapshots. The passive-evidence query must return only word IDs, scoped to the user, and use an appropriate user/event index; it never sends full lifetime event rows to Next or the browser. A server service validates ownership and builds a narrow DTO. The UI receives only aggregate DTO fields and short root labels/weak-word summaries. Avoid an N+1 query per root or word; fetch in batches and aggregate once.

The Progress read is the only Phase 3 snapshot capture point. It may write the current day's snapshot but never modifies Today plans, Today sessions, word states, SRS state, or Reading evidence. Failure to capture a snapshot must be surfaced as a degraded growth view without inventing historical data; other reliable metrics should still render. Database errors must not silently turn into zero counts.

The existing first-level navigation already has Today, Roots, Reading, Progress, and mobile Me; Phase 3 preserves that structure and makes Progress a reliable destination. Do not reintroduce Rapid, Quiz, Course, or Recovery as first-level choices. The first viewport orders stable/10K, Today, 7-day, 30-day, root highlights, growth, then optional Reading. At 390, 430, 768, and 1440 pixels there is no horizontal overflow; charts have text equivalents and every percentage is accompanied by numerator/denominator or an unavailable-state explanation.

## Validation and release gates

- Pure tests: frozen-plan completion, duplicate plan versions, partial target progress, 7/30 inclusive windows, account-newness clipping, no-plan null rate, timezone midnight/DST boundaries, streak grace day, state exclusivity, passive Reading not stable, 10K denominator, Support Words, verified morphology-only roots, multi-root deduplication, weak-word ordering, growth no-backfill, and Reading independence.
- Repository/API tests: verified-viewer requirement, user scoping, pagination beyond 1,000 word states, account isolation, snapshot idempotency, and degraded growth behavior.
- pgTAP for any new table/function: RLS, no direct client writes, owner isolation, unique daily snapshot, and no Today mutation. Test on a clean disposable local Supabase database; never reset an existing local stack containing user data without separately verifying disposability.
- Authenticated real-browser acceptance: login, compare Progress Today's status to Today, 7/30 rates, stable/10K/root content, refresh stability, second-account isolation, and responsive checks at 390/430/768/1440. Do not weaken Phase 1B–2C coverage.
- Full unit suite, lint, TypeScript, production build, final acceptance/audit, and a written metric-definition review. Production migration and deployment are separate release actions, not silently performed by local acceptance.

## Known limitations to communicate

Before the first persisted Today plan there is no eligible completion history. Earlier stable-vocabulary counts cannot be backfilled honestly; the growth series starts with observed Phase 3 snapshots and can have gaps on days the learner does not open Progress. Current mastery may decrease when a word becomes badly overdue or is answered incorrectly, so both the current stable count and subsequent observed snapshots can decrease. The estimated total vocabulary size remains unavailable until a defensible calibration model exists.
