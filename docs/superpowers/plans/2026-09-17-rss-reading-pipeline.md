# RSS Reading Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn RSS, Atom, OPML, and article URLs into a secure, deduplicated pool of one to three personalized Reading candidates.

**Architecture:** Server-only fetch and extraction modules normalize all sources into shared feed/article records. A cheap metadata pass narrows the pool before full extraction and production-vocabulary analysis; user-specific ranking reads learning state through the account-phase repositories.

**Tech Stack:** Next.js 16.3.5 route handlers, TypeScript 6, Supabase PostgreSQL/RLS, `fast-xml-parser`, `@mozilla/readability`, `jsdom`, Node DNS/network APIs, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-account-rss-today-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-17-account-cloud-data.md`

## Global Constraints

- RSS is a learning-content pipeline, not a general reader.
- The UI shows one to three candidates; subscription count is not a success metric.
- Every initial URL and redirect is re-resolved and checked against private, reserved, loopback, link-local, multicast, and cloud-metadata ranges.
- Feed bodies are capped at 2 MiB decompressed; article HTML is capped at 5 MiB decompressed; redirects are capped at three.
- Fetches send no browser cookie, authorization header, or user credential and do not bypass publisher controls.
- Full vocabulary analysis uses the generated production Master Vocabulary reading index, never the legacy 150-word in-memory index.
- Shared source/article tables are browser-read-only; server jobs own writes.
- The current workspace has no `.git` directory. Commit commands are used only after a repository is initialized.

---

## File Map

- `types/feeds.ts`, `types/articles.ts`: normalized source, entry, article, analysis, and ranking types.
- `lib/feeds/network-policy.ts`, `safe-fetch.ts`: SSRF and response-boundary enforcement.
- `lib/feeds/parser.ts`, `discovery.ts`, `opml.ts`: RSS/Atom/discovery/import adapters.
- `lib/articles/extract.ts`, `canonicalize.ts`, `fingerprint.ts`: article normalization and deduplication.
- `lib/reading/production-index.ts`, `analyze-production.ts`: official 9,000-lemma analysis path.
- `lib/recommendations/article-ranking.ts`: personalized and explainable ranking.
- `lib/jobs/feed-refresh.ts`, `article-analysis.ts`: idempotent orchestration.
- `app/api/feeds/*`, `app/api/articles/*`, `app/api/cron/feeds/route.ts`: protected entry points.
- `app/reading/page.tsx`, `app/reading/sources/page.tsx`, `components/reading/*`: candidates, sources, OPML, and import UI.

### Task 1: Feed and article domain contracts

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vitest.config.mts`
- Create: `vitest.setup.ts`
- Modify: `.env.example`
- Modify: `lib/config/env.ts`
- Create: `types/feeds.ts`
- Create: `types/articles.ts`
- Modify: `types/index.ts`
- Test: `tests/feed-types.test.ts`

**Interfaces:**
- Produces `NormalizedFeed`, `NormalizedFeedEntry`, `ArticleRecord`, `ArticleAnalysis`, `ArticleCandidate`, `OpmlSubscription`, `ExtractedArticle`, `ArticleIdentity`, `MetadataAnalysis`, `FeedRefreshResult`, `AnalysisRunResult`, and `FeedErrorCode`.

```ts
interface ArticleCandidate {
  articleId: string;
  title: string;
  sourceTitle: string;
  canonicalUrl: string;
  estimatedMinutes: number;
  contentWordCoverage: number;
  valuableUnknownWordIds: string[];
  score: number;
  explanationCodes: string[];
}

interface FeedRefreshResult { sourceId: string; fetched: number; inserted: number; duplicate: number; status: "updated" | "not-modified" | "failed"; }
interface AnalysisRunResult { considered: number; extracted: number; analyzed: number; rejected: number; }
```

- [x] **Step 1: Write a normalization fixture test**

```ts
const entry: NormalizedFeedEntry = {
  externalId: "post-1",
  url: "https://example.com/post-1",
  title: "How memory changes",
  summary: "A short summary",
  publishedAt: "2026-09-17T00:00:00.000Z",
  author: null
};
expect(entry.externalId).toBe("post-1");
```

- [x] **Step 2: Run `pnpm vitest run tests/feed-types.test.ts` and confirm failure**

- [x] **Step 3: Install parsing/extraction dependencies and define exact types**

Run: `pnpm add fast-xml-parser @mozilla/readability jsdom && pnpm add -D @types/jsdom @testing-library/react @testing-library/jest-dom`

Use discriminated states: feed fetch `idle | fetching | ready | failed`, article extraction `pending | extracted | rejected | failed`, and analysis `metadata | full | stale`.

Configure Vitest with `environment: "jsdom"` and load `vitest.setup.ts`, which imports `@testing-library/jest-dom/vitest`. Node-only fetch/DNS suites declare `// @vitest-environment node` at the top of their test files.

Extend the server environment schema with non-empty `CRON_SECRET`, `FEED_FETCH_CONTACT`, and boolean `RSS_READING_ENABLED`; keep all three server-only.

- [x] **Step 4: Run the focused test and type check**

Run: `pnpm vitest run tests/feed-types.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint the domain contract**

If Git is available: `git add package.json pnpm-lock.yaml vitest.config.mts vitest.setup.ts .env.example lib/config/env.ts types tests/feed-types.test.ts && git commit -m "feat: define RSS reading contracts"`

### Task 2: Feed/article database schema and policies

**Files:**
- Create: `supabase/migrations/202609170002_rss_reading.sql`
- Create: `supabase/tests/rss_reading_rls.test.sql`
- Modify: `types/database.ts`

**Interfaces:**
- Produces tables: `feed_sources`, `user_feed_subscriptions`, `articles`, `article_analyses`, `user_article_scores`, `user_article_states`, `feed_fetch_runs`.

- [x] **Step 1: Write RLS tests first**

Assert that authenticated users can manage only their own subscription and article-state rows; `anon` cannot read them; authenticated clients can select safe shared article DTO columns but cannot insert/update/delete shared source or article rows; service-role jobs can write shared rows.

- [x] **Step 2: Run `supabase test db` and confirm the migration is missing**

- [x] **Step 3: Implement tables, indexes, and grants**

Add unique indexes for normalized feed URL, `(feed_source_id, external_id)`, canonical article URL, content fingerprint where non-null, `(user_id, feed_source_id)`, and `(user_id, article_id, score_version)`. Keep extracted text server-only by excluding it from browser-facing views. Store only user-independent lexical matches in `article_analyses`; store coverage and ranking in RLS-protected `user_article_scores`. Use `security_invoker = true` for all views.

- [ ] **Step 4: Run `supabase db reset`, `supabase test db`, and type checking**

External gate recorded on 2026-09-17: type checking passes, but this machine still has no Supabase CLI, Docker, or PostgreSQL runtime. The RSS policy test remains mandatory before release.

- [ ] **Step 5: Checkpoint the RSS schema**

If Git is available: `git add supabase types/database.ts && git commit -m "feat: add RSS and article schema"`

### Task 3: SSRF-safe network boundary

**Files:**
- Create: `lib/feeds/network-policy.ts`
- Create: `lib/feeds/safe-fetch.ts`
- Test: `tests/feed-network-policy.test.ts`
- Test: `tests/safe-feed-fetch.test.ts`

**Interfaces:**
- Produces:

```ts
type FetchKind = "feed" | "article";
interface HostResolver { resolve(hostname: string): Promise<string[]>; }
interface SafeFetchDeps { resolver: HostResolver; fetchImpl: typeof fetch; now: () => Date; }
interface SafeTextResponse { finalUrl: string; status: number; contentType: string; text: string; etag: string | null; lastModified: string | null; }
function assertPublicHttpUrl(url: URL, resolver: HostResolver): Promise<void>;
function safeFetchText(url: string, kind: FetchKind, deps?: SafeFetchDeps): Promise<SafeTextResponse>;
```

- [x] **Step 1: Write blocked-address and redirect-pivot tests**

Cases include `127.0.0.1`, `::1`, `10.0.0.0/8`, `169.254.169.254`, `172.16.0.0/12`, `192.168.0.0/16`, IPv4-mapped IPv6, a public hostname resolving to a private address, an allowed public address, four redirects, an oversized decompressed stream, and a public URL redirecting to a private host.

- [x] **Step 2: Run both tests and confirm failure**

Run: `pnpm vitest run tests/feed-network-policy.test.ts tests/safe-feed-fetch.test.ts`

- [x] **Step 3: Implement validation and streaming fetch**

Use `dns/promises.lookup(hostname, { all: true, verbatim: true })`, `net.isIP`, explicit range checks for IPv4/IPv6, manual redirects, `AbortSignal.timeout`, and a streaming byte counter over the decompressed response body. Set `User-Agent: RootlineVocabularyReader/1.0 (+${FEED_FETCH_CONTACT})` and `Accept` by fetch kind. Never pass incoming request headers through.

- [x] **Step 4: Run tests, type checking, and lint**

Run: `pnpm vitest run tests/feed-network-policy.test.ts tests/safe-feed-fetch.test.ts && pnpm exec tsc --noEmit && pnpm eslint lib/feeds`

- [x] **Step 5: Checkpoint the network security boundary**

If Git is available: `git add lib/feeds tests/feed-network-policy.test.ts tests/safe-feed-fetch.test.ts && git commit -m "feat: secure remote content fetching"`

### Task 4: RSS/Atom parsing, discovery, and OPML

**Files:**
- Create: `lib/feeds/parser.ts`
- Create: `lib/feeds/discovery.ts`
- Create: `lib/feeds/opml.ts`
- Test: `tests/feed-parser.test.ts`
- Test: `tests/feed-discovery.test.ts`
- Test: `tests/opml.test.ts`
- Create: `tests/fixtures/rss2.xml`
- Create: `tests/fixtures/atom.xml`
- Create: `tests/fixtures/discovery.html`

**Interfaces:**
- Produces: `parseFeed(xml, sourceUrl): NormalizedFeed`, `discoverFeedUrls(html, pageUrl): string[]`, `parseOpml(xml): OpmlSubscription[]`, `serializeOpml(subscriptions): string`.

- [x] **Step 1: Write fixture-based parser tests**

Assert RSS 2 and Atom map to the same internal entry fields, relative links resolve against source URLs, invalid XML produces `INVALID_FEED`, discovery returns only HTTP(S) alternate feed links, and OPML round-trips titles and URLs without executable markup.

- [x] **Step 2: Run the three focused suites and confirm failure**

- [x] **Step 3: Implement strict adapters**

Configure `fast-xml-parser` to ignore dangerous entity expansion, normalize singleton/array shapes explicitly, strip markup from feed summaries, reject feeds with no usable entries, and limit OPML imports to 200 unique sources per request.

- [x] **Step 4: Run focused tests, type checking, and lint**

Run: `pnpm vitest run tests/feed-parser.test.ts tests/feed-discovery.test.ts tests/opml.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint source ingestion**

If Git is available: `git add lib/feeds tests/fixtures tests/feed-parser.test.ts tests/feed-discovery.test.ts tests/opml.test.ts && git commit -m "feat: parse and import feed sources"`

### Task 5: Article extraction, canonicalization, and deduplication

**Files:**
- Create: `lib/articles/canonicalize.ts`
- Create: `lib/articles/extract.ts`
- Create: `lib/articles/fingerprint.ts`
- Test: `tests/article-extraction.test.ts`
- Test: `tests/article-deduplication.test.ts`
- Create: `tests/fixtures/article.html`

**Interfaces:**
- Produces: `canonicalizeArticleUrl(url): string`, `extractArticle(html, url): ExtractedArticle`, `fingerprintArticle(article): string`, `chooseArticleIdentity(input): ArticleIdentity`.

- [x] **Step 1: Write extraction and identity tests**

Assert script/style/navigation text is absent, title/byline/content are extracted, tracking parameters such as `utm_source` are removed while semantic query parameters remain, canonical link is honored only when HTTP(S), and duplicate canonical URL/content fingerprint resolves to one identity.

- [x] **Step 2: Run tests and confirm failure**

- [x] **Step 3: Implement Readability-based extraction**

Create a JSDOM document with the final public URL, read a safe canonical link, run `Readability.parse()`, convert content to normalized plain text, reject fewer than 120 English words, and retain the publisher URL and attribution metadata. Do not execute scripts or load subresources.

- [x] **Step 4: Run focused tests and type checking**

Run: `pnpm vitest run tests/article-extraction.test.ts tests/article-deduplication.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint article normalization**

If Git is available: `git add lib/articles tests/fixtures/article.html tests/article-extraction.test.ts tests/article-deduplication.test.ts && git commit -m "feat: extract and deduplicate articles"`

### Task 6: Production vocabulary reading index

**Files:**
- Create: `scripts/build-reading-index.ts`
- Create: `lib/reading/production-index.ts`
- Create: `data/vocabulary/reading-index.json`
- Create: `tests/reading-production-index.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces command `pnpm run vocab:build-reading-index` and `getProductionReadingIndex(): ProductionReadingIndex` with maps by lemma and surface form.

- [x] **Step 1: Write the acceptance test**

```ts
it("indexes every accepted production lemma exactly once", async () => {
  const index = await getProductionReadingIndex();
  expect(index.acceptedLemmaCount).toBe(9000);
  expect(index.byLemma.size).toBe(9000);
  expect(index.bySurfaceForm.get("analyses")?.lemma).toBe("analysis");
});
```

- [x] **Step 2: Run the test and confirm the production index is missing**

- [x] **Step 3: Build the compact server-only index from production shards**

Deduplicate by normalized accepted lemma; retain `id`, lemma, surface forms, family ID, tier, frequency rank, learning value, and coverage tags. Fail generation if accepted lemma count is not 9,000, if critical duplicates exist, or if a referenced word ID is absent.

- [x] **Step 4: Generate and verify**

Run: `pnpm run vocab:build-reading-index && pnpm vitest run tests/reading-production-index.test.ts && pnpm run vocab:production-report`

- [x] **Step 5: Checkpoint the authoritative analysis index**

If Git is available: `git add scripts/build-reading-index.ts lib/reading/production-index.ts data/vocabulary/reading-index.json package.json tests/reading-production-index.test.ts && git commit -m "feat: build production Reading index"`

### Task 7: Two-stage analysis and personalized article ranking

**Files:**
- Create: `lib/articles/metadata-analysis.ts`
- Create: `lib/reading/analyze-production.ts`
- Create: `lib/recommendations/article-ranking.ts`
- Test: `tests/article-ranking.test.ts`
- Test: `tests/production-reading-analysis.test.ts`

**Interfaces:**
- Produces: `analyzeArticleMetadata(entry): MetadataAnalysis`, `analyzeArticleForLearner(article, learner): ArticleAnalysis`, `rankArticleCandidates(inputs): ArticleCandidate[]`.

- [x] **Step 1: Write deterministic ranking tests**

Fixtures must prove that 96% coverage with seven valuable uncertain words outranks 75% and 99.8% coverage, path/time fit matters, recent repeated sources receive a diversity penalty, hidden/completed items are excluded, and results are limited to three with stable explanation codes.

- [x] **Step 2: Run focused suites and confirm failure**

- [x] **Step 3: Implement metadata and full analysis**

Reuse tokenizer/coverage semantics but inject `ProductionReadingIndex`. Persist `vocabularyVersion`, unique lemma coverage, content-word coverage, uncertain high-value IDs, estimated minutes, and explanation codes. Select at most 40 metadata candidates for full extraction per job batch.

- [x] **Step 4: Run ranking, Reading, and vocabulary tests**

Run: `pnpm vitest run tests/article-ranking.test.ts tests/production-reading-analysis.test.ts tests/reading-analysis.test.ts tests/vocabulary-production-report.test.ts && pnpm exec tsc --noEmit`

- [x] **Step 5: Checkpoint personalized selection**

If Git is available: `git add lib/articles/metadata-analysis.ts lib/reading/analyze-production.ts lib/recommendations tests/article-ranking.test.ts tests/production-reading-analysis.test.ts && git commit -m "feat: rank articles for vocabulary learning"`

### Task 8: Feed jobs, repositories, and protected routes

**Files:**
- Create: `lib/repositories/supabase/feed-repository.ts`
- Create: `lib/jobs/feed-refresh.ts`
- Create: `lib/jobs/article-analysis.ts`
- Create: `lib/jobs/locks.ts`
- Create: `app/api/feeds/route.ts`
- Create: `app/api/feeds/discover/route.ts`
- Create: `app/api/feeds/opml/route.ts`
- Create: `app/api/articles/import/route.ts`
- Create: `app/api/cron/feeds/route.ts`
- Test: `tests/feed-refresh-job.test.ts`
- Test: `tests/cron-auth.test.ts`

**Interfaces:**
- Produces: `refreshFeed(sourceId): Promise<FeedRefreshResult>`, `analyzePendingArticles(limit): Promise<AnalysisRunResult>`.

- [x] **Step 1: Write idempotency, conditional-request, and cron-auth tests**

Verify ETag/Last-Modified are sent, `304` creates no duplicate records, concurrent refresh attempts acquire one source lock, repeated feed entries upsert once, invalid `Authorization: Bearer` returns 401, and a valid `CRON_SECRET` runs bounded work.

- [x] **Step 2: Run job/route tests and confirm failure**

- [x] **Step 3: Implement repository-backed jobs and thin routes**

Routes validate Zod inputs and call authenticated services. The cron route performs no redirects, disables caching, caps sources and articles per invocation, and returns counts only. Jobs store categorized errors and retry times without response bodies or secrets.

- [x] **Step 4: Run focused tests, type checking, and lint**

Run: `pnpm vitest run tests/feed-refresh-job.test.ts tests/cron-auth.test.ts && pnpm exec tsc --noEmit && pnpm eslint lib/jobs app/api/feeds app/api/articles app/api/cron`

- [x] **Step 5: Checkpoint the backend pipeline**

If Git is available: `git add lib/repositories/supabase/feed-repository.ts lib/jobs app/api/feeds app/api/articles app/api/cron tests/feed-refresh-job.test.ts tests/cron-auth.test.ts && git commit -m "feat: run protected RSS ingestion jobs"`

### Task 9: Reading candidates and source management UI

**Files:**
- Modify: `app/reading/page.tsx`
- Create: `app/reading/sources/page.tsx`
- Create: `app/reading/import/page.tsx`
- Create: `app/reading/articles/[id]/page.tsx`
- Create: `components/reading/for-you.tsx`
- Create: `components/reading/article-candidate-card.tsx`
- Create: `components/reading/article-reader.tsx`
- Create: `components/reading/source-manager.tsx`
- Create: `components/reading/opml-controls.tsx`
- Create: `data/starter-feeds.ts`
- Modify: `components/reading-input.tsx`
- Test: `tests/reading-candidate-view.test.tsx`
- Test: `tests/starter-feeds.test.ts`

**Interfaces:**
- Consumes `ArticleCandidate[]` and source DTOs only.
- Produces user actions: subscribe, unsubscribe, enable/disable, import URL, import/export OPML, save/hide/open candidate.

- [x] **Step 1: Write view-model tests**

Assert only three candidates render, each shows estimated minutes, coverage band, valuable-new-word count, source, and one reason; empty state offers source/import actions; guest persistent actions produce a login URL containing a validated return path. Validate that the curated starter list has unique HTTPS feed URLs, attribution labels, and no more than 12 sources.

- [x] **Step 2: Run the view test and confirm failure**

- [x] **Step 3: Implement the Reading hub**

Keep pasted-text analysis as a secondary “Import text” path. Make “For You” the authenticated default, with source management separate from the daily candidate list. Offer the small validated starter-source list when the user has no subscriptions. Candidate links open the authorized sanitized article in `/reading/articles/[id]`, record opened/progress/completed state through authenticated actions, and retain source attribution plus an external-original link. Never render a full unread backlog count.

- [x] **Step 4: Run component tests, type checking, lint, and build**

Run: `pnpm vitest run tests/reading-candidate-view.test.tsx tests/starter-feeds.test.ts && pnpm exec tsc --noEmit && pnpm lint && pnpm build`

- [x] **Step 5: Checkpoint the Reading product surface**

If Git is available: `git add app/reading components/reading components/reading-input.tsx tests/reading-candidate-view.test.tsx && git commit -m "feat: add personalized Reading hub"`

### Task 10: RSS phase acceptance and audit

**Files:**
- Create: `scripts/rss-reading-audit.ts`
- Create: `tests/rss-reading-audit.test.ts`
- Create: `docs/rss-reading-operations.md`
- Modify: `package.json`

**Interfaces:**
- Produces command `pnpm run audit:rss-reading`.

- [x] **Step 1: Write an audit test that fails on missing security and vocabulary gates**

The audit checks network-policy coverage, size/redirect constants, feed/article migrations, protected cron auth, production reading-index count, old analyzer isolation, and the one-to-three UI limit.

- [x] **Step 2: Run the audit test and confirm failure**

- [x] **Step 3: Implement the audit and operating guide**

Document manual local refresh, scheduler invocation, retry behavior, source attribution, log fields, safe-fetch limits, OPML limits, and recovery from a failed source.

- [x] **Step 4: Run the complete RSS gate**

Run: `pnpm run vocab:production-report && pnpm run audit:rss-reading && pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build`

- [x] **Step 5: Record results and continue to the Today integration plan**

If Git is available: `git add scripts/rss-reading-audit.ts tests/rss-reading-audit.test.ts docs/rss-reading-operations.md package.json && git commit -m "test: verify RSS Reading pipeline"`
