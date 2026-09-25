# Rootline 2.0 — Phase 2B Daily-3 Reading Experience

**Status:** Design approved in conversation and written-spec review
**Date:** 2026-09-24
**Base:** Phase 2A authenticated, per-user/per-learning-date Daily-3 recommendation backend

## 1. Outcome

Expose the persisted Daily-3 recommendations as an optional, focused reading experience that reinforces vocabulary already seen in Today or learned recently. Daily 30 remains the required daily commitment. Reading must not gate 30/30, Today completion, streaks, SRS, or mastery.

The primary Reading route shows at most the user's frozen one-to-three recommendations for the current learning date. The article route presents only article content already available under the current ingestion model, attribution, and a source link. It adds restrained vocabulary highlighting, accessible word details, and durable read state.

## 2. Verified Existing Contracts

- Phase 2A exposes authenticated GET /api/reading/recommendations and persists the first non-empty set by (user_id, learning_date). The response has at most three records, each including title, source attribution, published time, publisher/canonical URLs, summary, and separate Today/recent match IDs.
- The current ranking's matchedRecentWordIds uses a 30-day recent-learning window. Recommendation scores and ordering depend on that existing field.
- Existing snapshots are JSONB and may predate Phase 2B's seven-day presentation subset. They must remain frozen and readable without backfill or rewrite.
- The curated NASA ingestion path keeps extracted body text transient and stores metadata/summary only. The new experience must not fetch around this boundary, infer or generate article prose, or represent a summary as full article text.
- user_article_states already stores opened_at, completed_at, and progress. The legacy completion route also records article encounters, so Phase 2B must not reuse that completion side effect.
- Trusted Today morphology is carried in DailyTargetSnapshot; the planner intentionally emits morphology: null for Support words. The persisted published morphology dataset is the only additional morphology source.
- The application already has Reading navigation and legacy reading/import/subscription routes. Those routes can remain reachable but must not dominate the new Reading home.

## 3. Product Boundaries

### In scope

- Frozen Daily-3 list and focused article-summary page.
- A seven-day match subset added to newly generated recommendation snapshots without changing Phase 2A ranking.
- Level-A Today-word and weaker Level-B recent-word highlighting.
- Accessible inline vocabulary details, with morphology only when backed by trusted persisted records.
- Per-user opened/completed state using the existing article-state table.
- Secondary Today entry and responsive/accessibility behavior.

### Out of scope

- Mandatory reading or reading quotas.
- User-managed RSS, source subscriptions, OPML, or an infinite feed as the primary Reading experience.
- Publisher-content extraction, bypassing restrictions, AI-generated article text, or invented summaries.
- Passive reading/highlighting as SRS or strong mastery evidence.
- Progress 2.0, broad vocabulary expansion, or Phase 2C.

## 4. Routes and Data Flow

### Reading home

/reading becomes a verified-user server-rendered Daily-3 page. It calls the existing production recommendation service and renders that exact persisted set; it must not independently rerank or replace it with legacy candidates. It shows zero to three cards. A no-candidate response gets a compact empty state; an unavailable service gets a retryable message and never blocks Today.

Cards expose title, source/attribution, published date when available, Today-match count, recent-match count, and a broad estimated vocabulary-difficulty label. Difficulty uses deterministic buckets over `estimatedUnknownCoverage.percent`: below 10% is 较容易, 10% through below 25% is 适中, and 25% or above is 有挑战. These product heuristics estimate tracked-vocabulary match occurrences; they are not CEFR or objective article-level difficulty claims. Do not expose score formulas or numerical ranking scores.

Reading time is calculated only for the visible summary, using its token count and a broad 200-words-per-minute estimate, and labeled 摘要约 N 分钟. It must not be represented as full-article reading time. When summary content is missing, omit this estimate and state that only the publisher link is available.

### Seven-day vocabulary subset

Add optional matchedRecent7DayWordIds to each newly generated recommendation result/snapshot. Derive it from the same candidate lexical matches and learner snapshot at initial generation, including learning timestamps in the inclusive interval from generatedAt minus seven 24-hour periods through generatedAt; exclude IDs/lemmas already classed as Today words. Keep matchedRecentWordIds and all ranking scores/order unchanged. Persist the new field inside the existing recommendation JSONB; no table or migration is required.

For snapshots that lack matchedRecent7DayWordIds, use the existing matchedRecentWordIds without recalculation and label/highlight it as 近期词, not 近 7 日词. New snapshots can display 近 7 日词. This additive compatibility path preserves frozen sets and avoids falsely relabeling the existing 30-day cohort.

### Article route

Add a Daily-3-specific route at /reading/daily/[id]. Require a verified viewer and verify the requested ID belongs to that viewer's current frozen Daily-3 set before returning its snapshot data. Non-members receive the same not-available result as an unknown article. Article summary and source metadata come from the frozen recommendation object, not a live feed refresh.

Show title, source attribution, publication date if present, match summary, available summary text, and an external publisher link with safe new-window attributes. If summary is absent, show a transparent empty-content message with the source link. Do not route this experience through the legacy full-extraction page.

### Word context

Build highlights only for words present in frozen Today/recent match ID sets; unknown ordinary vocabulary stays plain. Use inexpensive tokenization/normalization over the displayed summary only. The Today level takes precedence if a token could match both groups. No full-catalog or article-analysis recomputation runs in a render loop.

Resolve lexical details from the production vocabulary catalog. For morphology:

1. Prefer the trusted morphology already frozen into today's target snapshot.
2. For recent non-Today words, use a targeted read from the currently published persisted morphology dataset, restricted to the matched IDs.
3. Expose a breakdown only when dataset/review/confidence/lemma checks satisfy the same trust contract as Today.
4. If a word is a Support word or has no qualifying persisted morphology, show ordinary vocabulary information only; never infer roots or affixes from spelling.

Tapping/clicking a highlighted word opens a semantic, keyboard-accessible detail dialog, positioned as a mobile-friendly bottom sheet on narrow viewports. Display word, pronunciation, core Chinese meaning, Today/recent status, and trusted morphology explanation when present. Non-morphology entries show word, pronunciation, core meaning, and useful local context.

Highlights must communicate their level with more than color (for example underline/decoration plus accessible labels). Ordinary prose remains selectable and readable.

## 5. Reading State and Authorization

Add a dedicated POST /api/reading/articles/[id]/state endpoint. It requires a verified viewer and validates the article against that viewer's current frozen Daily-3 set. Support only opening and completion state needed by this phase; use the existing user_article_states row's opened_at and completed_at fields and existing table/RLS model. Progress tracking is out of scope for 2B. The server derives user_id; clients cannot choose another owner.

Do not call the legacy /api/articles/[id]/state completion path, because it records article vocabulary encounters. Opening and marking this reading experience complete update only read state; scroll progress and highlight taps are not persisted. These actions do not mutate Today event/session rows, target counts, streak status, learner mastery, or SRS scheduling.

On page load, hydrate the current user's stored open/completed state so refresh and same-date sessions on another device agree. Repeated updates are idempotent. Reject IDs not in the current frozen recommendation snapshot without disclosing whether another user has access.

## 6. Today and Navigation

Keep the existing high-level navigation structure (Today, Roots, Reading, Progress, Me). Reading opens to Daily-3. Remove RSS management/import promotion from the Reading home while leaving legacy routes internally reachable.

Place 今日阅读 below the core Daily-30 card only on Today setup/complete surfaces; do not show a competing reading CTA during an active learning block. When Daily 30 is incomplete, continue-learning remains the visually dominant action. When complete, Reading may become the natural secondary action. No reading state is consulted by Daily-30 completion logic.

## 7. Failure and Content Cases

- Signed-out/unverified access follows the existing verified-viewer login flow.
- Empty Daily-3 set renders a clear no-articles state; it does not expose an unbounded RSS fallback.
- Recommendation/service failure is isolated to Reading and can be retried.
- Missing summary renders attribution and source navigation without fabricated article text.
- Missing production vocabulary metadata leaves the matched token readable and unlinked or opens a minimal word-only detail; it must not hide article prose.
- Missing morphology never triggers spelling heuristics.
- A server-side ownership/recommendation mismatch returns not-found/not-available, not metadata for the article.

## 8. Verification Plan

### Unit and integration coverage

- Existing 30-day recommendation match/ranking behavior remains unchanged.
- New recommendations freeze a distinct seven-day ID subset; Today/recent overlap is excluded.
- Existing JSON snapshots without the optional field render as 近期词 and are not rewritten.
- /reading renders zero to three stable recommendation cards and doesn't use legacy feed candidates.
- Card and article content metadata, summary-only reading-time estimate, missing-summary behavior, attribution, and source link.
- Today and recent lexical highlights differ visually and semantically; ordinary unknown vocabulary is not highlighted.
- Trusted morphology shows only for validated persisted records; Support/missing/untrusted morphology shows no decomposition.
- State endpoint enforces verified viewer and frozen-set membership, is owner-scoped/idempotent, and stores opened/completed state without invoking encounter/mastery code.
- Reading completion leaves Today 30/30 and streak/session state unchanged.

### Real browser acceptance

Against local Supabase and real browser authentication:

1. Sign in and open Today; confirm Daily 30 is primary.
2. Open Reading and verify the frozen one-to-three list, counts, source, date, difficulty label, and same-date stability after refresh.
3. Open a recommended article, verify summary-only content/attribution, Today highlighting, and recent highlighting.
4. Tap a trusted morphology word and a Support/non-morphology word; verify respective detail and honest morphology behavior.
5. Refresh/reopen and verify recommendation plus article state persistence.
6. Verify reading completion does not change Today completion.
7. Verify 390, 430, 768, and desktop layouts have no horizontal overflow and highlighted words/details remain accessible.

### Quality gates

- Full unit/integration suite, lint, typecheck, production build, local pgTAP when schema changes are needed, and real browser acceptance.
- Do not change or weaken Phase 1B acceptance contracts. Do not deploy, use production data, or begin Phase 2C as part of this phase.

## 9. Known Limitations

- The current curated ingestion contract may provide only a summary; in that case the experience is a summary reader plus publisher navigation, not a full-text reader.
- Existing same-date recommendation snapshots keep their original 30-day recent-word cohort. They will not be retroactively converted to a seven-day subset.
- Difficulty and summary reading-time labels are intentionally approximate.
