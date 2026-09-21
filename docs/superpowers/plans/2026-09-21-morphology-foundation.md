# Morphology Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a versioned morphology foundation, Gold Dataset, exact-match candidates, audit/review workflow, and reports without changing Rootline learning behavior.

**Architecture:** Keep runtime vocabulary JSON and legacy lexical-family/root structures intact. Add a versioned morphology persistence layer in Supabase, accessed only by server-side import/review/report services. Materialization projects exact Gold lemma matches into `derived` records; review operations append snapshots and enforce evidence-strength rules.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Zod, Supabase/Postgres, pgTAP, Supabase CLI, `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-09-21-morphology-foundation-design.md`

## Global Constraints

- Do not change Daily 30, Today, SRS, mastery, Reading/RSS, user learning state, or production vocabulary selection.
- Do not modify `data/vocabulary/production-catalog.json`, legacy `wordFamilyId`, or legacy `word_roots` as morphology evidence.
- All schema changes are additive, use a CLI-generated imperative migration filename, enable RLS, and create no client write policy.
- `verified`, `derived`, and `none` are new evidence levels; legacy confidence is never mapped directly to `verified`.
- Exact-Gold materialization is the only automated relation generation in this phase; no spelling or substring inference.
- No service-role value may be exposed through browser code or `NEXT_PUBLIC_*` configuration.

## Review Focus

- A retry of the exact-match materializer must not downgrade an approved `verified` record; Task 4 adds this regression test.
- A rejected candidate from the same dataset/version/source must not reappear; Task 4 adds the rejection replay test.
- A catalog ID without a UUID row in `public.words` must still persist; Task 2 adds the nullable legacy UUID migration test.
- An authenticated or anonymous client must not mutate any morphology table; Task 2 adds pgTAP denial tests.
- A root with a family sharing a legacy lexical head must still report as distinct concepts; Task 5 adds aggregation tests with intentionally different keys.

### Task 1: Define the versioned Gold Dataset and pure morphology contracts

**Files:**

- Create: `lib/morphology/types.ts`
- Create: `lib/morphology/gold-dataset.ts`
- Create: `lib/morphology/root-expansion-candidates.ts`
- Create: `tests/morphology/gold-dataset.test.ts`
- Create: `tests/morphology/root-expansion.test.ts`
- Modify: `lib/morphology/audit.ts`

**Interfaces:**

```ts
export type MorphologyConfidenceV2 = "verified" | "derived" | "none";
export type MorphologyReviewStatus = "pending" | "approved" | "rejected";

export interface GoldDatasetV1 {
  version: "gold-v1";
  source: "rootline-curated-static";
  provenance: { sourcePaths: string[]; contentHash: string; importedBy: string };
  roots: GoldRoot[];
  words: GoldWord[];
}

export interface MorphologyRecordInput {
  datasetVersion: string;
  catalogWordId: string;
  lemma: string;
  familyKey: string | null;
  primaryRootKey: string | null;
  segments: MorphologySegmentInput[];
  confidence: MorphologyConfidenceV2;
  morphologyScore: number | null;
  source: string;
  provenance: Record<string, unknown>;
  formationExplanation: string | null;
  reviewStatus: MorphologyReviewStatus;
}
```

- [ ] Write `tests/morphology/gold-dataset.test.ts` asserting that `createGoldDatasetV1()` contains exactly 20 unique root keys, 150 words, 149 root-backed words, and preserves the canonical `spect → inspect` prefix/explanation relation. Assert that the returned provenance includes `data/roots.ts`, `data/words.ts`, and a stable content hash.
- [ ] Run `pnpm exec vitest run tests/morphology/gold-dataset.test.ts`; confirm RED because the Gold Dataset module does not exist.
- [ ] Implement `createGoldDatasetV1()` by projecting the existing `roots` and `words` exports without mutating either source. Normalize the projection deterministically, hash the normalized JSON with Node `crypto`, and retain educational fields in structured records.
- [ ] Add root-expansion test data for 20–30 proposed roots only in `root-expansion-candidates.ts`; test that all proposals have a meaning, at least one lexical-form cue, and a non-empty ambiguity/risk note. Do not write them into the Gold Dataset.
- [ ] Extend audit types so a candidate carries Gold dataset version and source provenance, while preserving Phase 1A-1 exact-match behavior.
- [ ] Run both focused test files and `pnpm typecheck`; confirm GREEN. Commit `feat: define versioned morphology source contracts`.

### Task 2: Add the additive Supabase migration and RLS tests

**Files:**

- Create: migration produced by `supabase migration new morphology_foundation` under `supabase/migrations/`
- Create: `supabase/tests/morphology_foundation_rls.test.sql`
- Modify: `supabase/apply-all.sql` only if this repository's generated aggregate is maintained by the migration workflow
- Modify: `types/database.ts`

**Schema details:**

- `morphology_datasets`, `morphology_roots`, `morphology_families`, `word_morphology_records`, `word_morphology_segments`, and `morphology_review_events` exactly as defined in the approved spec.
- Use `check` constraints for dataset kind/status, record confidence/review status, score range, segment kind, review action, and nonnegative segment position/revision.
- Add `updated_at` triggers only to mutable tables (`word_morphology_records`); dataset and review-event rows remain append-oriented.
- Make `catalog_word_id text` the required catalog identifier and `legacy_word_uuid uuid null references public.words(id)` optional.
- Use explicit indexes from the design: dataset/root, dataset/family, dataset/confidence/review status, record/position, and review event/record.

- [ ] Run `supabase --help`, `supabase migration --help`, and `supabase test --help`; record the local commands supported by the installed CLI before changing schema.
- [ ] Write `supabase/tests/morphology_foundation_rls.test.sql` first. It must set anon and authenticated JWT contexts, prove published dataset rows are readable, and prove both roles cannot insert/update/delete every new morphology table. Add `throws_ok` tests for invalid confidence/score/segment constraints and a nullable `legacy_word_uuid` insert for a catalog-only ID.
- [ ] Run the specific local pgTAP test; confirm RED because the tables/policies do not exist.
- [ ] Iterate schema against the local database using `supabase db query` or MCP `execute_sql`, never remote deployment. Once correct, create the migration through `supabase migration new morphology_foundation`, put the reviewed additive SQL in that generated file, and update `types/database.ts` to include every new table/row/insert/update type.
- [ ] Enable RLS and add only read policies scoped to a published dataset. Do not grant normal client write privileges. Keep service-role usage out of RLS policies.
- [ ] Run local migration reset/apply, the pgTAP test, `supabase db advisors`, and `supabase migration list --local`; inspect outputs. Commit `feat: add morphology foundation schema`.

### Task 3: Implement repository and transaction-safe reviewer service

**Files:**

- Create: `lib/repositories/supabase/morphology-repository.ts`
- Create: `lib/morphology/review-service.ts`
- Create: `lib/morphology/review-schemas.ts`
- Create: `tests/morphology/review-service.test.ts`
- Modify: `lib/repositories/supabase/shared.ts` only to reuse existing typed JSON/error helpers

**Interfaces:**

```ts
export interface MorphologyReviewer {
  approve(input: { recordId: string; revision: number; actorId: string; reason?: string }): Promise<MorphologyRecord>;
  editAndApprove(input: EditMorphologyRecordInput & { recordId: string; revision: number; actorId: string }): Promise<MorphologyRecord>;
  reject(input: { recordId: string; revision: number; actorId: string; reason: string }): Promise<MorphologyRecord>;
}
```

- [ ] Write `tests/morphology/review-service.test.ts` with an in-memory repository fake that stores record revisions and append-only event snapshots. Cover approve → `verified/approved`; edit → new segments plus `verified/approved`; reject → `none/rejected`; stale revision → conflict; and every action emitting exactly one immutable before/after event.
- [ ] Run the focused test; confirm RED because review service is missing.
- [ ] Implement Zod input validation and a service that applies explicit transition rules. It must reject attempts to weaken `verified`, require a reason for rejection, increment revision, and append full snapshots atomically through a repository transaction boundary.
- [ ] Implement `SupabaseMorphologyRepository` with RPC/transactional database access or a single database-side mutation function created by the migration. If a function is used, keep it `security invoker`, set an empty or safe `search_path`, revoke `PUBLIC` execution, and expose it only to the service role. Do not use a client-exposed `SECURITY DEFINER` function.
- [ ] Run focused tests, then `pnpm lint` and `pnpm typecheck`; confirm GREEN. Commit `feat: add morphology reviewer service`.

### Task 4: Add Gold import and exact-match materialization commands

**Files:**

- Create: `lib/morphology/import-service.ts`
- Create: `lib/morphology/materialize-service.ts`
- Create: `scripts/morphology-cli.ts`
- Create: `tests/morphology/materialize-service.test.ts`
- Modify: `package.json`

**Command contract:**

```text
pnpm morphology:import-gold -- --version=gold-v1
pnpm morphology:materialize-exact -- --dataset=gold-v1
pnpm morphology:review approve -- --record=<uuid> --revision=<n> --actor=<id>
pnpm morphology:review edit -- --record=<uuid> --revision=<n> --actor=<id> --input=<json-file>
pnpm morphology:review reject -- --record=<uuid> --revision=<n> --actor=<id> --reason="..."
```

- [ ] Write the materialization tests first. Use the existing audit fixture pattern to prove: exact lemma produces `derived`, score 100, source `gold-dataset-exact-lemma`, dataset version, and legacy `wordFamilyId` only inside provenance; a spelling lookalike produces nothing; verified records are skipped; same-source/version rejection is skipped; a later dataset version can create a new candidate.
- [ ] Run the focused test; confirm RED because import/materialization services are missing.
- [ ] Implement Gold import as one idempotent transaction from `createGoldDatasetV1()`. It creates immutable dataset/root/family/record/segment rows and import events, with an explicit importer identity and input content hash.
- [ ] Implement materialization by reusing the Phase 1A-1 exact normalized lemma rule; do not add substring, root spelling, or lexical-family inference. It must return counts for created/skipped-verified/skipped-rejected/unchanged.
- [ ] Implement the CLI in server-only code using `createAdminSupabaseClient()`. Validate command parameters with Zod, reject absent service credentials, and print a concise JSON summary. No Next route is added.
- [ ] Add package scripts for each non-review command and a general `morphology:review` entry point. Run focused tests, then import/materialization against the local database only. Confirm the expected 123 derived candidates and no production JSON diff. Commit `feat: materialize versioned morphology candidates`.

### Task 5: Upgrade coverage v2 and generate root-expansion readiness output

**Files:**

- Modify: `lib/morphology/audit.ts`
- Modify: `scripts/morphology-coverage-report.ts`
- Create: `lib/morphology/coverage-service.ts`
- Create: `lib/morphology/root-expansion-report.ts`
- Create: `scripts/root-expansion-readiness-report.ts`
- Create: `tests/morphology/coverage-service.test.ts`
- Create: `tests/morphology/root-expansion-report.test.ts`
- Modify: `package.json`

- [ ] Write coverage tests first with persisted-record fixtures. Assert separate counts for Gold roots/words and persisted verified/derived/none/rejected records; root word/family counts; 5+/10+ clusters; source/provenance distribution; and a case where a lexical `wordFamilyId` differs from a morphology family key.
- [ ] Run coverage tests; confirm RED because the persistence-aware service does not exist.
- [ ] Implement a persistence-aware coverage service. The report must fail with a clear connection error when persistence is requested but unavailable; it must not claim static source counts are persisted counts.
- [ ] Preserve the existing Phase 1A-1 dry-run report as an explicit `--mode=dry-run` path. Add `--mode=persisted --dataset=gold-v1` for the v2 report.
- [ ] Write root-expansion report tests first. Assert it ranks only proposal configuration entries, reports frequency/tag metadata and examples from the production catalog, includes risk notes, and writes no database or Gold source data.
- [ ] Implement the report using exact lexical-form cues from `root-expansion-candidates.ts`, with documented scoring from coverage, frequency rank, coverage tags, and pedagogical clarity. Emit JSON and a concise Markdown table.
- [ ] Run all focused morphology tests and both report commands against local data. Commit `feat: add persisted morphology reports`.

### Task 6: Run regression, migration, and application quality gates

**Files:**

- Modify: `docs/phase-1a-1-morphology-audit.md` only if adding a dated link to the v2 successor is useful; do not alter its historical metrics.
- Create: `docs/phase-1a-2-morphology-foundation-report.md`

- [ ] Write the final report with the dataset version, local migration validation evidence, persisted `verified/derived/none/rejected` counts, root/family cluster counts, provenance distribution, root-expansion recommendations, and an explicit list of untouched product flows.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm morphology:coverage -- --mode=dry-run`, `pnpm morphology:coverage -- --mode=persisted --dataset=gold-v1`, and the root-expansion readiness command. Record exact successful outputs.
- [ ] Run `supabase db advisors`, local migration list, and every pgTAP RLS test. Record any unavailable local Supabase dependency as a blocker rather than treating it as a pass.
- [ ] Inspect `git diff --check`, confirm no changes to `production-catalog.json`, Today/Daily/SRS/Reading paths, or user-learning migrations, then request code review. Commit `docs: record morphology foundation validation`.

## Plan self-review

- Spec coverage: Tasks 1–6 cover the persistent model, versioned Gold source, exact candidates, service review actions/history, RLS/migration safety, coverage v2, expansion planning, and every required quality gate. No Daily 30/Today/reading work is planned.
- Placeholders: no task contains TODO/TBD or generic test instructions; every code task names its files, expected interface, RED command, and GREEN verification.
- Type consistency: `catalog_word_id`, `datasetVersion`, `MorphologyConfidenceV2`, `MorphologyReviewStatus`, and the `verified/derived/none` model are used consistently across the data, schema, service, CLI, and reports.
- Review-focus coverage: the five listed failure modes map respectively to Tasks 4, 4, 2, 2, and 5.
