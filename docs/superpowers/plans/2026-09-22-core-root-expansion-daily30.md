# Core Root Expansion and Daily 30 Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an evidence-backed `gold-v2` curriculum, persist its variants and exact production projections atomically, then measure it with persisted root reports and a read-only Daily 30 simulator.

**Architecture:** Keep the existing v1 projection untouched and introduce v2 as a full static snapshot with separately curated additions. Extend the existing import-plan/RPC boundary with structured root variants and explicit lexical families, then reuse the same persisted read model for reports and a deterministic simulator that has no write capability.

**Tech Stack:** TypeScript, Zod, Vitest, Supabase/Postgres, pgTAP, Next.js CLI scripts.

**Spec:** `docs/superpowers/specs/2026-09-22-core-root-expansion-daily30-design.md`

## Global Constraints

- Do not modify `data/vocabulary/production-catalog.json`, production `wordFamilyId`, Today, SRS, user learning state, Reading/RSS, or remote Supabase.
- Preserve `gold-v1` facts and database history. `gold-v2` is additive and has its own content hash.
- Use explicit curated word lists plus exact normalized lemma matching only. Never use substring, prefix, suffix, or spelling inference to project production records.
- Each new root/variant gets source title, URL, access date, evidence note, relation classification, and confidence; ambiguous evidence is excluded.
- Use the existing one-plan dry-run/apply flow and one `security invoker` RPC transaction. Retain service-role-only execution and append-only audit history.
- The simulator must only read persisted morphology and the fixed production catalog; it must not mutate a database or learning state.
- `READY_FOR_PHASE_1B` requires every published threshold, including 14 × 30 non-repeating words; below 420 usable words cannot satisfy that condition.

## Review Focus

- A `gold-v2` import must not alter results for `gold-v1`, even when canonical root keys are shared; Task 2 tests both versions side-by-side.
- A root variant must be explicit and linked to the canonical root in the same dataset; Task 2 pgTAP injects an invalid root link and verifies whole-transaction rollback.
- Two v2 words deliberately sharing one lexical family must produce one family count, not two; Task 3 tests this with distinct word IDs.
- A word containing a root-looking string but absent from v2's curated list must never become a production projection; Task 1 and Task 3 test this negative case.
- A simulator candidate set with enough words but excessive one-family concentration must report a shortfall/warning, not claim readiness; Task 4 tests the condition.

### Task 1: Define immutable `gold-v2` curation and versioned dataset selection

**Files:**
- Create: `data/morphology/gold-v2.ts`
- Modify: `lib/morphology/types.ts`
- Modify: `lib/morphology/gold-dataset.ts`
- Modify: `lib/morphology/import-cli.ts`
- Modify: `scripts/morphology-cli.ts`
- Modify: `tests/morphology/gold-dataset.test.ts`
- Modify: `tests/morphology/import-cli.test.ts`
- Modify: `tests/morphology/import-service.test.ts`

**Interfaces:**
- Produces `GoldDataset`, `GoldDatasetVersion`, `createGoldDataset(version)`, `createGoldDatasetV1()`, and `createGoldDatasetV2()`.
- Produces root `variants` and per-word optional `lexicalFamily` metadata consumed by Task 2.
- Consumes the unchanged v1 source projection and the fixed production catalog only for tests, never for inferred membership.

- [ ] **Step 1: Write the failing version/curation tests**

```ts
it("keeps v1 immutable while v2 adds evidence-backed canonical roots, variants, and lexical families", () => {
  const v1 = createGoldDatasetV1();
  const v2 = createGoldDatasetV2();

  expect(v1.version).toBe("gold-v1");
  expect(v1.roots).toHaveLength(20);
  expect(v1.words).toHaveLength(150);
  expect(v2.version).toBe("gold-v2");
  expect(v2.roots).toHaveLength(expect.any(Number));
  expect(v2.roots.length).toBeGreaterThanOrEqual(45);
  expect(v2.roots.length).toBeLessThanOrEqual(50);
  expect(v2.words.length).toBeGreaterThanOrEqual(400);
  expect(v2.words.length).toBeLessThanOrEqual(600);
  expect(v2.roots.find((root) => root.rootKey === "cap")?.variants)
    .toContainEqual(expect.objectContaining({ form: "cept", relation: "historical" }));
  expect(v2.words.find((word) => word.wordId === "v2:action")?.lexicalFamily?.key)
    .toBe("act:action");
});

it("does not project an uncurated root-looking production lemma", async () => {
  const plan = buildMorphologyImportPlan({
    dataset: createGoldDatasetV2(),
    vocabulary: [{ id: "noise", word: "enactmentish", lemma: "enactmentish", wordFamilyId: "noise" }],
    persisted: emptyState
  });
  expect(plan.payload.records.some((record) => record.catalogWordId === "noise")).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm test -- tests/morphology/gold-dataset.test.ts tests/morphology/import-cli.test.ts tests/morphology/import-service.test.ts`

Expected: FAIL because `gold-v2`, root variants, lexical families, and the v2 CLI version are not defined.

- [ ] **Step 3: Add the versioned domain types and curated v2 source**

Add the following exact shapes in `lib/morphology/types.ts`:

```ts
export type GoldDatasetVersion = "gold-v1" | "gold-v2";
export type EtymologyConfidence = "high" | "medium" | "cautious";
export type RootVariantRelation = "historical" | "pedagogical";

export type GoldRootVariant = {
  form: string;
  relation: RootVariantRelation;
  explanation: string;
  provenance: RootProvenance;
};

export type RootProvenance = {
  sourceTitle: string;
  sourceUrl: string;
  accessedAt: "2026-09-22";
  evidenceNote: string;
};

export interface GoldLexicalFamily {
  key: string;
  displayName: string;
  formationExplanation: string;
}
```

Extend `GoldRoot` with `variants`, root provenance, `etymologyConfidence`, `pedagogicalConfidence`, and `riskNotes`; extend `GoldWord` with optional `lexicalFamily`; replace the v1-only dataset interface with a versioned `GoldDataset` while retaining the exported `GoldDatasetV1` alias for v1 callers.

Create `data/morphology/gold-v2.ts` with full v1 records plus evidence-backed additions for these canonical roots: `act`, `ann`, `aud`, `bene`, `bio`, `centr`, `chron`, `corp`, `cosm`, `cur`, `dom`, `equ`, `gen`, `grad`, `graph`, `jur`, `liter`, `loc`, `manu`, `metr`, `nav`, `phon`, `log`, `geo`, `tele`, and `micro`. Populate only words whose exact lemma is explicitly listed for that root and whose source record has a root/word evidence note; exclude ambiguous candidate relations such as `dem`, `art`, `nom`, and `therm` unless direct evidence makes an individual relationship unambiguous. Give each curated family a stable key such as `act:action` and reuse it only for genuinely related curated words.

For every new source entry, record the public source title, exact URL, access date `2026-09-22`, evidence note, confidence, and risk note. Use historical variants for cited form relationships, including `cap` → `capt`/`cept`/`cip`, and label any teaching-only relationship `pedagogical`.

Make `createGoldDataset(version: GoldDatasetVersion)` select v1 or v2, make `createGoldDatasetV2()` return the v2 snapshot, and update the import argument schema to accept exactly both versions. Keep its default `gold-v1` for backwards compatibility.

- [ ] **Step 4: Update the plan-builder tests for v2 counts and exact projection**

Add assertions that v2 has no `errors`, projects only production entries whose normalized lemma exactly equals a curated v2 lemma, preserves `derived`/`pending` for production records, and uses the explicit lexical family key on both Gold and derived records. Add a test where an existing verified projection is skipped even when its source Gold word appears in v2.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `pnpm test -- tests/morphology/gold-dataset.test.ts tests/morphology/import-cli.test.ts tests/morphology/import-service.test.ts`

Expected: PASS with v1 behavior unchanged and v2 facts available only by explicit selection.

- [ ] **Step 6: Commit the curation/version layer**

```bash
git add data/morphology/gold-v2.ts lib/morphology/types.ts lib/morphology/gold-dataset.ts lib/morphology/import-cli.ts scripts/morphology-cli.ts tests/morphology/gold-dataset.test.ts tests/morphology/import-cli.test.ts tests/morphology/import-service.test.ts
git commit -m "feat: add evidence-backed gold v2 curriculum"
```

### Task 2: Persist root variants and explicit lexical families atomically

**Files:**
- Create: `supabase/migrations/<generated>_morphology_root_variants.sql`
- Modify: `lib/morphology/import-service.ts`
- Modify: `lib/morphology/import-runner.ts`
- Modify: `lib/repositories/supabase/morphology-import-repository.ts`
- Modify: `types/database.ts`
- Modify: `supabase/tests/morphology_foundation_rls.test.sql`
- Modify: `supabase/tests/morphology_import_transaction.test.sql`
- Modify: `tests/morphology/supabase-import-repository.test.ts`

**Interfaces:**
- Consumes `GoldDataset.roots[].variants` and `GoldWord.lexicalFamily` from Task 1.
- Produces `MorphologyImportPlan.payload.variants`, `summary.rootVariants`, and persisted variant state.
- Preserves `apply_morphology_import(jsonb, text)` as the only apply mutation boundary.

- [ ] **Step 1: Add failing pgTAP and repository tests**

```sql
select has_table('public', 'morphology_root_variants', 'root variants are persisted structurally');
select lives_ok(
  $$ select public.apply_morphology_import(<valid-v2-plan>, 'integration-test') $$,
  'v2 import persists variants with the rest of the plan'
);
select results_eq(
  $$ select variant_form from public.morphology_root_variants ... $$,
  array['cept'::text],
  'canonical root variants retain their explicit form'
);
select throws_ok(
  $$ select public.apply_morphology_import(<plan-with-missing-variant-root>, 'integration-test') $$,
  '22023', null, 'unknown variant roots roll back the entire import'
);
```

Write repository-plan tests that assert root variants are fetched, included in the apply RPC payload, counted as insert/update/unchanged, and retain their source provenance. Write a planner test with two `act` words sharing `act:action`, asserting only one family payload row is created.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/morphology/import-service.test.ts tests/morphology/supabase-import-repository.test.ts && supabase test db supabase/tests/morphology_import_transaction.test.sql`

Expected: FAIL because the table, payload field, variant mapping, and family de-duplication do not exist.

- [ ] **Step 3: Generate and implement the migration**

Run `supabase migration new morphology_root_variants` to obtain the migration filename. In that generated file:

```sql
create table public.morphology_root_variants (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.morphology_datasets(id) on delete restrict,
  canonical_root_id uuid not null references public.morphology_roots(id) on delete restrict,
  variant_form text not null,
  relation text not null check (relation in ('historical', 'pedagogical')),
  explanation text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, canonical_root_id, variant_form)
);
create index idx_morphology_root_variants_canonical_root_id
  on public.morphology_root_variants(canonical_root_id);
alter table public.morphology_root_variants enable row level security;
```

Add a published-dataset read policy matching the root-table access model. Extend the audit entity check with `root-variant`; add root-variant import events with snapshot, source/version, and an idempotency key. Extend the existing RPC to validate its `variants` array, upsert roots before variants, resolve canonical roots by `(dataset_id, root_key)`, write variants, and raise SQLSTATE `22023` for an unresolved canonical root. Preserve `security invoker`, `set search_path = ''`, and service-role-only `EXECUTE`.

- [ ] **Step 4: Extend the TypeScript plan and persistence adapter**

Add `PersistedMorphologyState.variants`, a `MorphologyImportVariant` payload type, and `summary.rootVariants`. Use a stable hash of the variant's canonical root key, form, relation, explanation, and provenance. Merge each root's individual provenance with the dataset provenance in the RPC rather than dropping it.

Replace the one-family-per-word implementation with a map keyed by `GoldWord.lexicalFamily?.key ?? gold:<wordId>`. Reject inconsistent display/explanation values for the same explicit family key when building the plan; otherwise emit exactly one family row. Use that family key for Gold records and derived exact-lemma projections.

Update `types/database.ts` and `SupabaseMorphologyImportRepository` to select/map variants and pass the richer payload to the unchanged RPC name.

- [ ] **Step 5: Reset local database and verify GREEN**

Run: `supabase db reset --local && supabase test db && pnpm test -- tests/morphology/import-service.test.ts tests/morphology/supabase-import-repository.test.ts`

Expected: all pgTAP files pass; v2 variants persist in the same transaction and a bad variant leaves no dataset rows behind.

- [ ] **Step 6: Commit the atomic persistence extension**

```bash
git add supabase/migrations supabase/tests lib/morphology/import-service.ts lib/morphology/import-runner.ts lib/repositories/supabase/morphology-import-repository.ts types/database.ts tests/morphology/import-service.test.ts tests/morphology/supabase-import-repository.test.ts
git commit -m "feat: persist morphology root variants atomically"
```

### Task 3: Produce a persisted v2 root expansion report

**Files:**
- Create: `lib/morphology/root-expansion-service.ts`
- Create: `tests/morphology/root-expansion-service.test.ts`
- Modify: `lib/repositories/supabase/morphology-coverage-repository.ts`
- Modify: `scripts/root-expansion-readiness-report.ts`
- Modify: `package.json`
- Modify: `tests/morphology/supabase-coverage-repository.test.ts`

**Interfaces:**
- Consumes persisted root metadata, variants, word records, families, and the immutable production catalog.
- Produces `buildPersistedRootExpansionReport(input)` and `pnpm morphology:root-expansion-report --dataset=gold-v2`.
- Supplies the deterministic root capacity inputs used in Task 4.

- [ ] **Step 1: Write the failing report tests**

```ts
it("counts distinct usable words and explicit lexical families per canonical root", () => {
  const report = buildPersistedRootExpansionReport(fixture);
  expect(report.roots[0]).toMatchObject({
    rootKey: "act",
    goldWordCount: 3,
    productionExactMatchCount: 3,
    usableProductionWordCount: 3,
    usableProductionFamilyCount: 1,
    highFrequencyCount: 2,
    ieltsTaggedCount: 2
  });
});

it("sorts by pedagogical value and never adds a substring-only production word", () => {
  expect(report.roots.map((root) => root.rootKey)).toEqual(["act", "aud"]);
  expect(report.roots[0]?.productionExactMatchCount).toBe(3);
});
```

- [ ] **Step 2: Run focused report tests and verify RED**

Run: `pnpm test -- tests/morphology/root-expansion-service.test.ts tests/morphology/supabase-coverage-repository.test.ts`

Expected: FAIL because the persisted expansion service and richer repository fields do not exist.

- [ ] **Step 3: Implement the persisted report read model**

Extend the coverage repository to return root educational content/provenance, explicit variant rows, family keys, ordered segment root IDs, and Gold/production record source fields for one selected dataset. Do not query or mutate unrelated datasets.

Implement `buildPersistedRootExpansionReport` to calculate, per canonical root: Gold words, exact production matches, usable production words/families, high-frequency records (use the catalog's `frequencyBand === "high"`), IELTS/TOEFL/academic tagged counts, confidence/risk, and variants. Sort by the documented score and canonical key. The report's exact-match count is records with `source === "gold-dataset-exact-lemma"`, never a string scan.

Make `morphology:root-expansion-report` require `--dataset=<version>` and print JSON only. Keep the existing candidate-readiness command separate because it is a pre-curation discovery tool.

- [ ] **Step 4: Run focused report tests and verify GREEN**

Run: `pnpm test -- tests/morphology/root-expansion-service.test.ts tests/morphology/supabase-coverage-repository.test.ts`

Expected: PASS with one-family/many-word diversity accurately represented and no inferred matches.

- [ ] **Step 5: Commit persisted report support**

```bash
git add lib/morphology/root-expansion-service.ts lib/repositories/supabase/morphology-coverage-repository.ts scripts/root-expansion-readiness-report.ts package.json tests/morphology/root-expansion-service.test.ts tests/morphology/supabase-coverage-repository.test.ts
git commit -m "feat: report persisted root expansion capacity"
```

### Task 4: Add the deterministic read-only Daily 30 simulator and readiness gate

**Files:**
- Create: `lib/morphology/daily30-simulator.ts`
- Create: `scripts/morphology-daily30-sim.ts`
- Create: `tests/morphology/daily30-simulator.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `PersistedCoverageData`, root-expansion report rows, and `ProductionVocabularyEntry[]`.
- Produces `simulateDaily30(input): Daily30SimulationReport` with daily selections and `readiness: "READY_FOR_PHASE_1B" | "NOT_READY_FOR_PHASE_1B"`.
- Does not expose any mutation interface.

- [ ] **Step 1: Write the failing simulator tests**

```ts
it("is deterministic, chooses two to four roots, and never repeats a word across days", () => {
  const first = simulateDaily30({ days: 2, candidates: fixtureCandidates });
  const second = simulateDaily30({ days: 2, candidates: fixtureCandidates });
  expect(first).toEqual(second);
  expect(first.days.every((day) => day.rootClusters.length >= 2 && day.rootClusters.length <= 4)).toBe(true);
  expect(new Set(first.days.flatMap((day) => day.selectedWords.map((word) => word.catalogWordId))).size)
    .toBe(first.summary.filledSlots);
});

it("reports a quality-preserving shortfall instead of using none-confidence or concentrated families", () => {
  const report = simulateDaily30({ days: 1, candidates: concentratedFixture });
  expect(report.days[0]).toMatchObject({ filledSlots: 0, shortfall: 30, noneConfidenceFallbackCount: 0 });
  expect(report.days[0]?.qualityWarnings).toContain("family-concentration");
  expect(report.readiness).toBe("NOT_READY_FOR_PHASE_1B");
});
```

- [ ] **Step 2: Run simulator tests and verify RED**

Run: `pnpm test -- tests/morphology/daily30-simulator.test.ts`

Expected: FAIL because the simulator and readiness gate do not exist.

- [ ] **Step 3: Implement the pure simulator**

Define typed candidates with catalog word ID, canonical root key, family key, frequency rank/band, coverage tags, learning value, confidence, and root pedagogical confidence. Exclude `none` and rejected records before grouping.

For each day, select clusters from roots with 5–15 remaining candidates. Prefer 2–4 roots, sort cluster candidates by distinct remaining family count, capacity, aggregate frequency, tag coverage, pedagogical confidence, and root key. Select candidates in the documented word order while limiting a family to two selections per root/day. Never backfill with weaker data; report the remaining slots and machine-readable warnings (`insufficient-root-capacity`, `family-concentration`, `no-eligible-candidates`).

Evaluate readiness with the seven spec conditions and include each failed metric in `limitingMetrics`. The simulator must return `NOT_READY_FOR_PHASE_1B` below 420 eligible usable words even when the separate coverage threshold of 400 is met.

The CLI parses positive integer `--days` (default 14) and required `--dataset`; creates a read-only Supabase client/repository exactly as the persisted coverage script does; invokes the pure service; and prints JSON. Add `morphology:daily30-sim` to `package.json`.

- [ ] **Step 4: Run simulator tests and verify GREEN**

Run: `pnpm test -- tests/morphology/daily30-simulator.test.ts`

Expected: PASS for deterministic full plans, no duplicate words, 2–4 roots when capacity permits, no `none` fallback, shortfall behavior, and both readiness outcomes.

- [ ] **Step 5: Commit the simulator**

```bash
git add lib/morphology/daily30-simulator.ts scripts/morphology-daily30-sim.ts tests/morphology/daily30-simulator.test.ts package.json
git commit -m "feat: simulate root-first daily 30 readiness"
```

### Task 5: Execute local v2 validation and document the readiness result

**Files:**
- Create: `docs/phase-1a-3-core-root-expansion-report.md`
- Modify: `supabase/tests/morphology_import_transaction.test.sql` (only if validation exposes a missing v2 transaction assertion)

**Interfaces:**
- Consumes all previous tasks and local Supabase only.
- Produces an evidence-backed final report with no remote deployment or product/UI changes.

- [ ] **Step 1: Add any missing validation tests before correction**

If a clean-local run reveals an untested difference between plan and persisted output, first add the smallest Vitest or pgTAP assertion that reproduces it, run it red, then implement the correction and run it green. Do not change v2 data merely to force the readiness result.

- [ ] **Step 2: Run a clean local database and database quality checks**

Run:

```bash
supabase db reset --local
supabase test db
supabase db lint --local --schema public --level warning --fail-on error
supabase db advisors --local --type all --level warn --fail-on error
supabase migration list --local
```

Expected: all morphology tests pass, no schema errors, and any advisor warning is documented with scope and ownership.

- [ ] **Step 3: Execute the actual v2 import sequence**

Run against the clean local instance only:

```bash
pnpm morphology:import -- --dry-run --version=gold-v2
pnpm morphology:import -- --apply --version=gold-v2
pnpm morphology:import -- --apply --version=gold-v2
pnpm morphology:coverage -- --mode=persisted --dataset=gold-v2
pnpm morphology:root-expansion-report -- --dataset=gold-v2
pnpm morphology:daily30-sim -- --days=14 --dataset=gold-v2
```

Record the dry-run counts, first and second apply results, coverage, every root report row, simulation summary, readiness status, and exact limiting metrics when not ready.

- [ ] **Step 4: Run all project quality gates**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Expected: all commands pass. Report any pre-existing warnings separately; do not mask them.

- [ ] **Step 5: Write the final Phase 1A-3 report**

Document the 24 requested results: v2 version; before/after root, Gold word, and derived counts; variants; capacity; confidence counts; top 20 root clusters; tag/frequency coverage; two apply results; persisted coverage; 14-day simulation; readiness; tests/pgTAP/lint/typecheck/build; and known limitations. State explicitly that the local database changed only for validation and the remote database was untouched. End with `READY_FOR_PHASE_1B` or `NOT_READY_FOR_PHASE_1B`, then stop without implementing Phase 1B.

- [ ] **Step 6: Commit validation evidence**

```bash
git add docs/phase-1a-3-core-root-expansion-report.md supabase/tests/morphology_import_transaction.test.sql
git commit -m "docs: validate core root expansion readiness"
```
