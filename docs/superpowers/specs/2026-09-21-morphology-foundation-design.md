# Rootline 2.0 Morphology Foundation Design

## Intent and success criteria

Phase 1A-2 makes trusted morphology data durable and reviewable so a later Root-first learning experience can consume it safely. It is an infrastructure phase: it must not change Today, Daily 30, SRS, mastery, Reading/RSS, user learning history, `production-catalog.json`, legacy `wordFamilyId`, or existing curated source files.

The result is successful when Rootline can persist a versioned Gold Dataset, materialize only the 123 exact-Gold projections as `derived`, record review decisions without losing history, and report verified/derived/none/rejected coverage separately.

## Scope and non-goals

In scope:

- Additive Supabase schema, RLS, and migration tests for morphology data.
- Versioned import representation for the existing 20 roots and 150 curated morphology words.
- A server-only service/CLI review workflow.
- Idempotent materialization of exact-lemma candidates.
- Coverage v2 and a non-mutating root-expansion readiness report.
- Regression tests for evidence strength and review-history invariants.

Out of scope:

- Daily 30, Today, carryover, root-first UI, reviewer UI, reader/RSS work, mass root assignment, destructive data migrations, and remote deployment.

## Evidence model

`verified`, `derived`, and `none` are a new contract, independent of the legacy `high | medium | low | none` field.

| Confidence | Meaning | How it is created in this phase |
| --- | --- | --- |
| `verified` | A reviewer accepted or edited a relation in the new versioned model. | Imported Gold rows after explicit import-review acceptance; approved or edited candidate rows. |
| `derived` | A deterministic rule proposed a relation and retained its exact source/version. | Exact normalized lemma match against a Gold Dataset version only. |
| `none` | Rootline has no approved morphology assertion for this word/version. | A reviewer rejects a candidate, retaining its rejected review status and history. |

The old confidence value is never transformed into `verified`. A Gold import is eligible for `verified` because the import itself is an explicit, versioned reviewer decision with a named provenance record—not because a legacy field happened to say `high`.

## Persistent model

The existing `public.words` table uses UUID primary keys while the runtime catalog uses stable text IDs/lemmas and is not guaranteed to be fully mirrored into Supabase. The new layer therefore uses `catalog_word_id text` as its required `word_id` contract. A nullable `legacy_word_uuid` can be populated later when a catalog word has a corresponding `public.words` row. This permits all 123 candidates to be materialized without importing or altering the 9,000-word catalog.

```text
Morphology dataset (immutable version)
  └── Morphology root (versioned instructional content)
        └── Morphology family (teachable group under one primary root)
              └── Word morphology record (catalog word + current assertion)
                    ├── Ordered morphology segments (prefix/root/suffix)
                    └── Append-only review events
```

### `morphology_datasets`

Represents an immutable source version, for example `gold-v1`.

- `id uuid` primary key; `version text` unique; `kind text` constrained to `gold` or `candidate-source`; `status text` constrained to `draft`, `published`, or `archived`.
- `source text`, `provenance jsonb`, `created_at`, and `published_at`.
- A published dataset is never updated in place; corrections create a new version.

### `morphology_roots`

Stores the 20 Gold roots as versioned instructional records without overwriting `public.roots` or `data/roots.ts`.

- `id uuid`; `dataset_id`; `root_key text`; `meaning_en jsonb`; `meaning_zh jsonb`; `educational_content jsonb`; `provenance jsonb`; timestamps.
- Unique `(dataset_id, root_key)` and index `(dataset_id, root_key)`.

### `morphology_families`

Represents a reviewed teaching family, not a legacy lexical family.

- `id uuid`; `dataset_id`; `primary_root_id` references `morphology_roots`; `family_key text`; `display_name text`; `formation_explanation text`; `source text`; `provenance jsonb`; timestamps.
- Unique `(dataset_id, family_key)` and index `(dataset_id, primary_root_id)`.
- `family_key` is never inferred from `words.word_family`; the latter may appear only inside provenance as lexical metadata.

### `word_morphology_records`

Holds the current assertion for one catalog word in one dataset version.

- `id uuid`; `dataset_id`; `catalog_word_id text`; `lemma text`; `legacy_word_uuid uuid nullable` references `public.words`; nullable `family_id`; nullable `primary_root_id`; `confidence` constrained to `verified | derived | none`; `morphology_score numeric` constrained to 0–100; `source text`; `provenance jsonb`; `formation_explanation text`; `review_status` constrained to `pending | approved | rejected`; `revision integer`; `created_at`, `updated_at`, `reviewed_at`, `reviewed_by`.
- Unique `(dataset_id, catalog_word_id)` and indexes for `(dataset_id, primary_root_id)`, `(dataset_id, family_id)`, and `(dataset_id, confidence, review_status)`.
- `root_ids`, prefixes, and suffixes are read from segments rather than duplicated in an opaque column. The API/result DTO exposes all requested fields: `word_id`, lemma, family ID, primary root, all root IDs, prefixes, suffixes, explanation, confidence, score, source, provenance, dataset version, and review metadata.

### `word_morphology_segments`

Preserves ordered decomposition.

- `id uuid`; `word_morphology_record_id`; `position integer`; `kind text` constrained to `prefix | root | suffix`; `surface_form text`; nullable `root_id` references `morphology_roots`; nullable `meaning text`; nullable `explanation text`.
- Unique `(word_morphology_record_id, position)` and indexes on record and root IDs.

### `morphology_review_events`

Append-only decision history.

- `id uuid`; `record_id`; `action text` constrained to `approve | edit | reject | import`; nullable `actor_id`; `previous_snapshot jsonb`; `result_snapshot jsonb`; `reason text`; `created_at`.
- The service writes an event in the same transaction as a current-record change. It never deletes events.

## Import, materialization, and review flow

1. The importer serializes the current `data/roots.ts` and `data/words.ts` records into a `gold-v1` input artifact with source path, source hash, and importer version in provenance. Original static files remain untouched.
2. The importer creates the Gold dataset, roots, families, records, segments, and `import` events in one transaction. Each accepted Gold relationship is `verified` / `approved` only after the import-review action is recorded.
3. The materializer reads the 9,000-entry JSON catalog and a published Gold dataset. It creates a `derived` / `pending` record only for an exact normalized lemma match with a root-backed Gold word. It stores `source = gold-dataset-exact-lemma`, `morphology_score = 100`, source dataset version, catalog lemma, and legacy `wordFamilyId` as provenance metadata only.
4. The materializer is idempotent for `(dataset_version, catalog_word_id, source)`. If the current record is `verified`, it skips it. If it is rejected from the same source/version, it skips it. A later dataset version may create a new candidate and retains the earlier rejection event.
5. The reviewer service exposes three transactionally safe commands: approve unchanged candidate; edit relation then approve; reject to `confidence = none` and `review_status = rejected`. Every command increments `revision`, updates review fields, and appends a snapshot event.

The reviewer workflow is server-only: a module receives an admin Supabase client and a caller identity, and a CLI invokes it. No browser route, React UI, public service-role key, or client-side mutation is introduced.

## Security and migration safety

The migration is additive and creates no trigger on existing vocabulary tables. It does not alter, copy over, or delete `words.word_family`, `word_roots`, production JSON, or user-owned rows.

All new `public` tables enable RLS. `anon` and `authenticated` receive read-only access to rows belonging to a published dataset; no client write policy is created. The server-side review/import CLI uses the service-role client only in non-public code. The migration explicitly grants only necessary read privileges if the project Data API configuration requires grants. pgTAP tests exercise public read access and anonymous/authenticated write denial.

Local migration work first iterates against the local database, runs advisors, and is generated/recorded through the repository's imperative migration workflow. It is validated locally; no remote migration or destructive operation is part of this phase.

## Reports

### Coverage report v2

The report combines the runtime catalog with persisted morphology records and prints, without changing data:

- Gold root and word counts; persisted verified, derived, none, and rejected counts.
- Usable words and teaching families per root; roots with 5+ and 10+ usable words; top clusters.
- Provenance/source distribution.
- Explicit separation of derived from verified.

When Supabase is unavailable, the report fails with an actionable connection error rather than silently substituting static data as persisted truth.

### Root expansion readiness report

This is a planning artifact only. A reviewed configuration of 20–30 proposed roots supplies core meaning, candidate lexical forms, and ambiguity notes. The report ranks candidates using only production catalog metadata: exact lexical-form matches, frequency rank, coverage tags (IELTS/TOEFL/academic), and a documented pedagogical-clarity score. It reports high-frequency examples and risk notes. It never inserts candidate roots, words, or relations into Gold or production data.

## Error handling and invariants

- Reject invalid status, score, segment position, missing provenance, duplicate dataset version, and family/root dataset mismatch before persistence.
- Reject a reviewer action on a missing or stale `revision` record; require callers to retry after reading current state.
- Never lower `verified` to `derived`, whether during materialization or import retry.
- Never recreate a same-source/same-version rejected candidate automatically.
- Reject segment roots that do not belong to the record's dataset.
- Retain all decision snapshots, including import decisions.

## Validation strategy

Unit tests cover exact-match behavior, evidence precedence, reject/re-import behavior, deterministic coverage aggregation, and root/family separation. Integration tests validate the importer/materializer/reviewer against a local Supabase database. pgTAP tests assert the schema constraints, RLS read model, and client write denial. The complete gate is `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, the coverage report, root-expansion readiness report, local migration validation, and Supabase advisors.
