# Phase 2A — Daily Reading Backend Design

**Date:** 2026-09-23
**Status:** Proposed after conversational design approval; awaiting written-spec review
**Product:** Rootline 2.0

## 1. Intent and Success

Reading is auxiliary practice that reinforces vocabulary already being learned. A user who completes the 30-word Today target has completed the required learning for that date, regardless of whether they read an article. Phase 2A supplies a backend foundation that returns at most three current English articles matched to the learner's Today 30 targets and recent learning history.

Success means that a server-generated recommendation set is relevant, explainable, deduplicated, stable for its learning date once frozen, and available through a small authenticated API. It does not mean a polished reading experience exists.

## 2. Scope and Non-Goals

Included:

- A code-managed, system-curated public source registry based on the existing starter-feed inventory, with stable source keys, name, feed URL, category, language, enabled flag, and editorial-quality metadata.
- Reuse of the existing safe RSS fetch, parser, article identity, and vocabulary-analysis infrastructure where its access boundary fits curated sources.
- Article records with source, title, canonical URL, publication time, RSS summary, language, and an ingestion timestamp; exact vocabulary-match IDs remain available for recommendation analysis.
- User-specific ranking against the frozen Today plan, recently learned words, learner difficulty, freshness, and source quality.
- A persisted per-user, per-learning-date snapshot containing zero to three ranked recommendations, scores, explanation codes, and exact matched Today/recent word IDs.
- A small authenticated backend endpoint and developer diagnostics only where needed to inspect recommendations.
- Unit and database tests for parsing, de-duplication, matching, ranking, cap, freeze, and date rollover.

Explicitly excluded:

- New user-created RSS subscriptions, feed management, OPML, or unlimited browsing features.
- Destructive removal of existing feed or reading infrastructure.
- A polished article reader or full Reading UI.
- Any change to Today 30 target generation, progress, or completion rules.
- Merging Phase 1B or deploying/mutating production Supabase for acceptance.

Existing custom-feed routes and data may remain for compatibility, but the new public recommendation path must select only sources present in the system-curated registry.

## 3. Existing Architecture to Reuse

The repository already has:

- A starter-feed inventory in `data/starter-feeds.ts` (BBC World, NASA, The Conversation, Smithsonian Smart News, ScienceDaily, NPR Science).
- Safe remote fetching and redirect/address/size limits in `lib/feeds/safe-fetch.ts`.
- RSS/Atom parsing, URL canonicalization, and duplicate identity support.
- Shared `feed_sources`, `articles`, `article_analyses`, and `feed_fetch_runs` data structures.
- A production vocabulary reading index with exact word IDs and lemma-level article matches.
- Per-user `word_learning_states`, user preferences, profiles with time zone, and a frozen Phase 1B Today plan whose `dailyTargets` include word IDs and lemmas.

The source registry is code-managed; runtime fetch status and last successful fetch come from the existing source/fetch-run rows. The new recommender must join article source rows back to the registry whitelist and must never infer that every row in `feed_sources` is public-curated.

## 4. Proposed Data Flow

1. A protected system job reconciles enabled registry entries to the existing feed-source records and refreshes only those curated sources for the new recommendation pipeline. Existing user-feed jobs are not expanded or repurposed as a recommendation source.
2. RSS metadata is parsed and canonicalized. The shared article record keeps title, canonical/original URL, publication time, summary, language, source association, and first-ingestion time. Duplicate feed entries and cross-source duplicate stories are collapsed deterministically.
3. Article HTML may be fetched transiently by the safe extractor to derive lexical matches. Persist match IDs, counts, analysis version, and recommendation features; do not introduce a full-text publishing/archive experience in this phase. Retain full article text only if a selected source's terms and the product need for analysis justify it. The default for Phase 2A is not to persist extracted full text.
4. On an authenticated recommendation request, load the user's local learning date from the existing Today plan/profile-time-zone flow, its frozen `dailyTargets`, recent word states, and difficulty preference. Join eligible, analyzed articles only from enabled curated sources.
5. Rank candidates, choose and diversify up to three, and persist a snapshot keyed by `(user_id, learning_date)` under a transaction-safe first-writer lock. A later read returns the saved snapshot, not a newly ranked set.
6. If there are no eligible candidates, return an empty result without creating a frozen row. The first non-empty set is frozen; it may contain fewer than three articles when the eligible corpus is sparse. This follows the explicit “at most 3” requirement and avoids permanently freezing an empty set before ingestion completes.
7. A new learning date naturally has a separate key and may receive a new set. Today completion never reads or depends on this table or endpoint.

## 5. Scoring and Quality

Use deterministic normalized component scores with this initial weighting, adjustable only through tests and recorded rationale:

| Signal | Initial weight | Rule |
|---|---:|---|
| Today 30 word matches | 45% | Dominant component; reward multiple meaningful exact word-ID/lemma matches with diminishing returns, not a single rare one-off. |
| Recently learned word matches | 20% | Recent learned words outside today's set; use a documented rolling window and exclude Today IDs from double counting. |
| Learner difficulty fit | 15% | Estimate unfamiliar share from tracked lexical-match occurrences and the learner's difficulty preference; label the estimate as approximate. |
| Freshness | 10% | Prefer recent publication time; use ingestion time only when publication time is absent. |
| Source quality | 10% | Combine a reviewed editorial-quality value in the registry with recent successful-fetch reliability. |

Exact Today and recent matched word IDs must be included in the frozen recommendation snapshot. Explainable reason codes should reflect the actual score signals. If vocabulary coverage is incomplete, do not represent the unfamiliar-word estimate as ground truth.

Select multiple meaningful Today matches over an otherwise similar article with only one rare target. After ranking, suppress exact canonical/content duplicates and near-duplicate story titles where practical; final tie-breaking must be stable (score, publication time, then article ID).

The six existing starter feeds are candidates, not assumed-live guarantees. Before enabling them in the system registry, verify their current feed endpoints, English language, source attribution, fetch safety, and terms relevant to transient analysis and retention. Exclude a source when its terms or availability make the proposed use inappropriate.

## 6. Persistence and Security

Add a separate per-user/day recommendation-set table rather than adding recommendation behavior to Today completion. A row stores the algorithm version, generation timestamp, and a JSON snapshot capped at three items; storing an empty set is intentionally avoided. The user/date uniqueness key and transaction/advisory lock make concurrent generation first-writer-wins and stable.

Every table in the exposed `public` schema must have RLS enabled. User snapshots are owner-readable only; client roles do not receive direct write access. Server-only generation uses the privileged client after authenticating the viewer and deriving `user_id` server-side. New public-schema objects receive explicit grants as required by the project's Data API configuration. Any RPC uses `SECURITY INVOKER`, a fixed search path, an explicit owner check where applicable, and execution grants limited to the required server role.

The system source registry must not become a user-writable table. The public recommendation API returns only the selected metadata and matched IDs needed by callers, and article links preserve publisher attribution.

## 7. Failure and Stability Behavior

- Feed fetch failures are recorded per source; already stored articles and frozen recommendation sets remain readable.
- Malformed feeds and unsafe redirects/hosts fail closed through the existing safe-fetch boundary.
- Duplicate feed items, canonical URL variants, repeated content fingerprints, and near-identical stories must not occupy multiple recommendation slots.
- Missing publication timestamps use a documented fallback; missing article summaries remain valid if content analysis succeeds.
- Empty or sparse corpora produce zero to three recommendations, never fabricated candidates.
- A frozen same-day set is not silently replaced after refresh, scoring changes, or later feed arrivals.
- No path from a Reading failure may downgrade Today completion.

## 8. Validation

Automated coverage must include:

- RSS/Atom parsing into normalized title, URL, summary, author, and publication time.
- URL/content deduplication and deterministic near-duplicate suppression.
- Exact Today-word ID and lemma matching, including title-only and repeated occurrences.
- Recent-word matching without double-counting Today words.
- Difficulty, freshness, and source-quality component behavior.
- Ranking where several Today matches beat a single rare match; stable tie-breaks.
- At most three recommendations and source whitelist enforcement.
- Same-date snapshot stability under repeat and concurrent requests.
- No-row behavior when there are no eligible candidates; new-date generation after date rollover.
- No dependency on user-created RSS subscriptions.
- RLS owner access and cross-user denial, server-write restriction, and RPC version/locking behavior.
- An explicit regression assertion that the Today Daily 30 completion contract is unchanged.

Run focused tests, full Vitest, ESLint, TypeScript, and production webpack build. Database migration and pgTAP require a clean local/test Supabase environment; do not use production. Browser checks remain part of Phase 1B Runtime Acceptance and are not replaced by service tests.

## 9. Constraints and Known Tradeoffs

- The feature may return fewer than three articles if few analyzed stories match the user's targets; quality takes precedence over filling slots.
- The initial source inventory is small and code-managed, so source additions or editorial metadata changes require a reviewed deployment.
- Matching depends on the deployed production vocabulary index and the compatibility of its stable word IDs with Today snapshots.
- The unfamiliar-word estimate covers known vocabulary entries, not every token in an article.
- The source's license/terms may limit how much text can be retained; full-text persistence and reading UI are deferred.
- Phase 1B runtime acceptance remains blocked until both a real compatible database/pgTAP run and a real browser end-to-end run succeed.
