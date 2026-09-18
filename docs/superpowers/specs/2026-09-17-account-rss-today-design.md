# Account, RSS Reading, and Today Integration Design

**Date:** 2026-09-17  
**Status:** Approved in chat; awaiting written-spec review  
**Product:** Rootline English vocabulary learning website

## 1. Objective

Introduce an account and login system, move private learning state to a secure server-side data model, and make RSS-powered Reading a formal stage of the Today Engine.

The product must preserve two principles:

1. The 8,000–10,000-word catalog is infrastructure, not a daily burden. The learner sees only the 20–50 most useful word candidates and one well-matched article.
2. Vocabulary-catalog acceptance is measured by `accepted lemma count`, calculated from deployable production shards, not by the number of JSON records.

The target daily experience is approximately:

> Review 15 words → scan 30 words → learn 7 focus words → read one six-minute article → answer five context questions

## 2. Confirmed Product Decisions

- Use Supabase Auth and Supabase PostgreSQL.
- Allow open registration, but require email verification before cloud learning data can be saved.
- Use email and password for the first release. Social login is out of scope.
- Guests may browse vocabulary and try Reading analysis.
- Saving progress, generating a personal Today plan, subscribing to feeds, and syncing reading state require login.
- Existing browser-local learning data is migrated once after the first verified login.
- RSS is a learning-content pipeline, not a general-purpose reader. The interface shows one to three best candidates and Today selects exactly one when an eligible article exists.
- The architecture must isolate Supabase behind authentication and repository interfaces so the provider can be replaced without rewriting learning engines.

## 3. Scope

### 3.1 Included

- Registration, email verification, login, logout, password reset, session refresh, and account settings.
- Server-side authorization and row-level database isolation.
- Cloud persistence for vocabulary progress, reviews, Today plans, reading state, feed subscriptions, and preferences.
- Idempotent migration from the current local storage model.
- RSS/Atom subscription, feed discovery, article URL import, and OPML import/export.
- Secure server-side fetching, parsing, deduplication, two-stage analysis, and personalized ranking.
- Integration of one selected article into the Today learning flow.
- Offline write queue and graceful read-only degradation.
- Unit, integration, database-policy, build, and browser-flow verification.

### 3.2 Excluded from the first release

- Google, Apple, or other social login.
- Team, classroom, organization, role-management, or administrator interfaces.
- Billing and subscriptions.
- Push notifications.
- A full offline-first database or arbitrary multi-device conflict editor.
- Paywall bypass, authenticated-site scraping, or storing copyrighted article archives beyond what is needed for the learning experience.

## 4. Architecture

The system has four explicit layers.

### 4.1 Identity layer

Supabase Auth owns credentials, email verification, password reset, access tokens, and refresh tokens. Next.js reads the session from cookies on the server. Authenticated routes must not use static regeneration or shared caching.

Supabase email confirmation is required in every deployed environment. Registration does not produce a cloud-write-capable application session until confirmation succeeds, and every private server write revalidates the current user rather than trusting client state.

The application never stores passwords. Auth callback errors are converted to safe, user-facing messages that do not reveal whether an email address is registered.

### 4.2 Application data layer

UI components do not call Supabase tables directly. They call narrow repositories and services:

- `AuthService`
- `LearnerRepository`
- `TodayRepository`
- `ReadingRepository`
- `FeedRepository`
- `MigrationService`

Server components, server actions, route handlers, background tasks, and tests share these contracts. Provider-specific clients remain in an infrastructure directory and never leak into learning-engine types.

### 4.3 Ownership layer

Data is divided into three ownership classes:

- **Global content:** production vocabulary, roots, word families, exam tags, public feed metadata, and normalized public article metadata.
- **Private user data:** preferences, vocabulary state, review history, Today plans, feed subscriptions, reading progress, saved sentences, and user-imported documents.
- **Recomputable data:** recommendation scores, coverage snapshots, candidate lists, and derived summaries. These may be cached but are not the only source of truth.

The 9,000-word production catalog remains versioned static content. It is not copied into every user's database rows.

### 4.4 Background-task layer

Feed fetching, full-text extraction, article analysis, and recommendation refresh run through protected task endpoints. Local development can trigger tasks manually. A deployed scheduler may invoke the same endpoints using a secret. Scheduler selection is separate from business logic.

## 5. Account Experience

### 5.1 Routes

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/auth/callback`
- `/settings/account`

The global navigation shows “Log in / Create account” for guests and an account menu for authenticated users.

### 5.2 Guest-to-account transition

Guests can browse and run non-persistent Reading analysis. When a guest attempts a persistent action, the interface opens a lightweight login prompt and records the intended return location. After successful login, the user returns to the same task.

Cloud writes require both an authenticated session and a verified email. An unverified user receives a resend-verification action rather than a generic failure.

### 5.3 Session and failure behavior

- On session expiry, preserve the current location and any unsent client operation, then resume after login.
- During a network interruption, enqueue supported learning writes locally and replay them in order when connectivity returns.
- When Supabase is unavailable, keep global vocabulary and guest Reading available in read-only mode.
- Never cache a response that can refresh or set a user's authentication cookie.
- The service-role credential and scheduler secret are server-only.

## 6. Data Model

All IDs are UUIDs unless a stable content ID already exists. Every mutable table includes `created_at` and `updated_at`. User-owned rows include `user_id`.

### 6.1 Account and preferences

- `profiles`: one row per Auth user; display name, avatar URL, timezone, onboarding status.
- `user_preferences`: target exams, daily time budget, preferred topics, difficulty preference, and recommendation controls.

### 6.2 Vocabulary learning

- `word_learning_states`: one row per user and `word_id`; recognition state, confidence, fluency, verification, memory strength, SRS stage, next review, and source timestamps.
- `review_events`: append-only learning/review facts with a client-generated idempotency key.
- `vocabulary_encounters`: one row per user, word, and document/article encounter; source and encounter date support cross-article and source-diversity counts.
- `personal_sentences`: private saved contextual sentences linked to a word and optional document/article.
- `learner_auxiliary_state`: one row per user for the remaining versioned learner snapshot fields: root progress, daily statistics, calibration, transfer statistics, and learning settings.

### 6.3 Today

- `today_plans`: user, local learning date, generation version, status, estimated minutes, and selected article.
- `today_plan_items`: ordered items for review, rapid scan, focus learning, reading, and context quiz.
- `today_sessions`: completion, actual duration, and stage-level outcomes.

A uniqueness constraint on `(user_id, learning_date, generation_version)` prevents accidental duplicate plans. Regeneration creates a new version rather than silently mutating a started plan.

### 6.4 Reading and feeds

- `feed_sources`: normalized public feed URL, site URL, title, discovery metadata, ETag, Last-Modified, fetch status, and last successful fetch.
- `user_feed_subscriptions`: user-to-source relation, enabled state, topic tags, and source preference.
- `articles`: source, stable external ID, canonical URL, title, author, publication date, summary, language, content fingerprint, extraction status, and analysis version.
- `article_analyses`: shared, user-independent lexical matches, vocabulary version, length, topic features, time estimate, and analysis timestamps.
- `user_article_scores`: private coverage, valuable unknown-word count, personalized score, explanation codes, and score version for one user and article.
- `user_article_states`: saved, hidden, opened, completed, progress, explicit feedback, and last interaction.
- `reading_documents`: private pasted text or user-imported content and its analysis version.

`feed_sources`, `articles`, and user-independent article analyses are shared to avoid refetching identical public content. Personalized coverage/ranking, subscriptions, interaction state, and user documents remain private.

### 6.5 Migration bookkeeping

- `migration_batches`: user, source installation ID, schema version, status, attempt count, counts by entity type, and verified completion time.
- `migration_items`: batch, entity type, legacy ID, content hash, result, and error category.

The unique key `(user_id, source_installation_id, schema_version)` makes a migration retry safe.

## 7. Authorization and Database Security

Row Level Security is enabled on every exposed table.

- Private tables require `auth.uid() = user_id` for select, insert, update, and delete.
- The authenticated role receives only the operations used by the product.
- The anonymous role receives no access to private tables.
- Shared feed/article tables are read-only to browser clients; background jobs perform writes using a server-only privileged client.
- Database views must use invoker security so they cannot bypass underlying RLS policies.
- Foreign keys, uniqueness constraints, and check constraints enforce ownership and idempotency in addition to application validation.

Database tests must explicitly assert:

- owner allowed;
- another authenticated user denied;
- unauthenticated user denied;
- privileged background task allowed only through server configuration.

## 8. Local Data Migration and Ongoing Sync

### 8.1 First-login migration

After the first verified login, the client snapshots legacy local data and starts a migration batch. Migration runs in bounded chunks and does not block access to the website.

Merge rules are deterministic:

- Learning-state snapshots use the newest valid `updated_at`; a stale local snapshot cannot overwrite newer server state.
- Append-only review events, reading history, and saved sentences are unioned by stable ID or idempotency key.
- Counters are reconstructed from facts where possible and are never blindly added.
- Missing or malformed legacy entities are skipped and reported rather than aborting the whole batch.
- A completed batch is verified by server counts and item results before being marked complete.

Legacy local data remains as a recovery backup after migration. New writes use the server repository. The compatibility reader can be removed only after the release has demonstrated stable migrations.

### 8.2 Multi-device and offline writes

The server is authoritative after migration. Client writes carry an operation ID, entity version, and client timestamp. The server rejects stale destructive updates and treats repeated operation IDs as success without applying them twice.

The offline queue is intentionally narrow: review results, reading progress, saved/hidden article state, and personal sentences. Feed ingestion and Today generation require the server and are not simulated offline.

## 9. RSS and Article Pipeline

### 9.1 Input methods

- Direct RSS or Atom URL.
- Website URL with feed auto-discovery.
- Direct article URL.
- OPML import and export.
- A small, curated starter-source list.

The system optimizes selection quality, not subscription count.

### 9.2 Secure fetch contract

Every initial request and redirect is validated server-side.

- Allow only HTTP and HTTPS.
- Resolve the hostname and reject loopback, link-local, private, multicast, reserved, and cloud-metadata address ranges.
- Re-resolve and revalidate every redirect; allow at most three redirects.
- Use explicit connect and total timeouts.
- Stream and cap decompressed feed bodies at 2 MiB and decompressed article HTML bodies at 5 MiB, aborting as soon as the limit is exceeded.
- Accept only expected XML, HTML, or plain-text content types.
- Send a descriptive Rootline user agent and respect source fetch intervals.
- Never forward browser cookies, authorization headers, or user credentials.
- Do not attempt to bypass paywalls, login walls, or publisher controls.

Failures are recorded with a safe category and retry time. Raw secrets, full internal URLs, and response bodies are not written to logs.

### 9.3 Parse, normalize, and deduplicate

Feed adapters produce one internal entry shape regardless of RSS or Atom version. Articles are deduplicated by this precedence:

1. normalized canonical URL;
2. source plus stable feed GUID;
3. normalized content fingerprint.

Tracking query parameters are removed only through a conservative allowlist. The original URL is retained for attribution.

### 9.4 Two-stage analysis

Stage one analyzes title, summary, source, recency, language, and approximate length for all new entries. Stage two extracts and analyzes full text only for the best 20–40 candidates across active users or when a user opens/imports an article.

Full analysis uses the production Master Vocabulary and records the vocabulary data version. Reanalysis is triggered when extraction changes materially or the vocabulary version changes.

## 10. Personalization and Today Integration

Article ranking combines:

- fit to the learner's known-word coverage, targeting approximately 95–98%;
- a small number of high-value unknown or uncertain words;
- TOEFL, IELTS, or other selected-path relevance;
- estimated reading time versus the user's budget;
- recency without making recency dominant;
- topic and source preference;
- source and topic diversity relative to recent recommendations.

The Reading home page shows only the top one to three candidates and explains the main reason each article was selected. It does not expose a psychologically burdensome backlog.

Today selects exactly one eligible article and persists that choice in the plan so refreshing the page does not reshuffle a started session. The reading stage appears after focus-word learning and before the five context questions.

Vocabulary encounters record document/article and source. Repeated appearances inside one article do not inflate cross-article encounter or source-diversity signals. Valuable uncertain words may enter later Today plans and SRS, subject to the existing mix limits so Reading words do not take over the entire day.

If no article meets the minimum quality threshold, Today omits the reading stage with a clear reason and offers manual import. It must not force a poor recommendation merely to fill the slot.

## 11. Error Handling and Observability

Errors use stable internal categories and plain-language user messages.

- Auth: invalid credentials, unverified email, expired link, rate limited, session expired.
- Migration: invalid legacy item, conflict, transient network failure, permanent validation failure.
- Feed: unsafe target, timeout, size limit, invalid XML, unsupported format, unavailable source.
- Article: extraction failed, unsupported language, insufficient text, duplicate content.
- Recommendation: no eligible article, stale analysis, vocabulary version mismatch.

Background jobs record start, finish, counts, duration, and categorized failures. They are idempotent and protected against concurrent processing of the same source. User-facing pages show the last useful state when a refresh fails.

## 12. Testing Strategy

### 12.1 Unit tests

- Auth input validation and safe error mapping.
- Repository contracts and DTO boundaries.
- Migration merge rules and repeated-batch idempotency.
- URL normalization, IP classification, redirect validation, response limits, and parser adapters.
- Article deduplication, two-stage selection, coverage calculation, ranking, and source diversity.
- Today selection persistence and no-eligible-article degradation.

### 12.2 Database and integration tests

- All RLS allow/deny combinations.
- Auth callback and verified-email gates.
- Cross-device read/write behavior against one user account.
- Background task authorization.
- Database constraints for duplicate plans, subscriptions, migration items, reviews, and articles.

### 12.3 Browser tests

- Register → verify → login → intended-page return.
- Login, logout, forgot password, reset password, and expired session recovery.
- Guest persistent action → login prompt.
- First-login migration, interrupted retry, and no duplicates.
- Add/discover/import a feed, receive candidates, open an article, finish Reading, and complete context questions.
- Two accounts cannot observe each other's private data.

### 12.4 Existing product gates

Before completion, run type checking, linting, the full test suite, a production build, and the production vocabulary report. The report must recalculate and display `accepted lemma count` from the deployed shards and retain the existing 9,000-lemma acceptance result unless a separately approved vocabulary change modifies it.

## 13. Delivery Sequence

1. **Identity foundation:** Supabase clients, environment contract, migrations, RLS, auth routes, account UI.
2. **Cloud learning data:** repositories, DTOs, vocabulary/review/Today/Reading persistence, local migration.
3. **RSS content pipeline:** secure fetch, discovery, parsing, extraction, deduplication, OPML, tasks.
4. **Personalized loop:** full Master Vocabulary analysis, ranking, Reading candidates, Today article stage, encounter diversity.
5. **Resilience and verification:** offline queue, degradation, observability, performance, security tests, browser tests, and final acceptance report.

Account/cloud persistence and RSS/Today integration use separate feature flags. Either may be disabled without rolling back the production vocabulary or existing local guest experience.

## 14. Acceptance Criteria

The release is complete only when all of these statements are true:

1. A guest can browse and analyze text, while persistent actions reliably request login.
2. A new account cannot save cloud learning state until its email is verified.
3. Login, logout, reset, refresh, and session-expiry recovery work without losing the user's current task.
4. Existing local learning data migrates once, can retry after interruption, and produces no duplicate events or inflated counters.
5. One account cannot read or mutate another account's private rows through either UI or direct data APIs.
6. One account sees consistent learning and reading progress on two devices.
7. Unsafe RSS targets, redirect pivots, excessive responses, and invalid formats are rejected.
8. Feed entries and articles are deduplicated; the Reading home presents only one to three suitable candidates.
9. A generated Today plan contains at most one persisted article selection and five context questions when an eligible article exists.
10. RSS or extraction failure degrades safely without blocking vocabulary review.
11. Article analysis uses the production Master Vocabulary, not the legacy small in-memory index.
12. Final validation reports `accepted lemma count`, and all tests, checks, and the production build pass.

## 15. Configuration Contract

The implementation will document and validate these deployment values without committing secrets:

- public Supabase project URL;
- public Supabase publishable key;
- server-only Supabase service-role key;
- application site URL and allowed auth redirect URLs;
- server-only scheduler secret;
- feed-fetch user-agent contact identifier;
- feature flags for cloud persistence and RSS/Today integration.

Local development must fail with a clear configuration message when a server-only feature is invoked without its required values, while guest-only pages remain usable.
