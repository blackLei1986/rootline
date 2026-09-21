# Rootline 2.0 — Phase 1A-1 Morphology Architecture Audit

Date: 2026-09-21
Scope: baseline verification, architecture audit, non-mutating coverage dry-run, and an additive Phase 1A-2 proposal. This phase does not alter production vocabulary mappings, database schema, Daily 30, or any user learning state.

## Executive conclusion

Rootline already has three useful but separate assets:

1. A 9,000-lemma production catalog with a lexical `wordFamilyId`.
2. A curated 20-root / 150-word teaching set with explicit root, affix, and explanation data.
3. A Supabase schema that can represent roots and word-to-root relations, but not a versioned Root → Family → Word morphology model with provenance.

They must not be conflated. In particular, the production `wordFamilyId` is a graph-derived lexical-family head, not evidence that a word belongs to a pedagogically valid root family. The safe starting point is a candidate layer which accepts only exact lemma matches to the curated set. It produced 123 `derived` candidates and leaves 8,877 production entries as `none`.

## Baseline health

Initial checks found TypeScript and tests green, while lint had four real `prefer-const` errors and two unused-variable warnings. The behavior-neutral lint repair is limited to:

- `lib/learning/scheduler.ts`: four non-reassigned bindings are now `const`.
- `components/inference-challenge.tsx`: removed an unused computed value.
- `tests/learning/scheduler.test.ts`: removed an unused import.

No lint rule, TypeScript option, test, or build check was suppressed.

Final quality gate (2026-09-21):

| Check | Result |
| --- | --- |
| `pnpm lint` | passed |
| `pnpm typecheck` | passed |
| `pnpm test` | 61 files, 207 tests passed |
| `pnpm build` | passed; 214 static pages generated |

## Existing vocabulary architecture

### Runtime catalog

`data/vocabulary/production-catalog.json` is the 9,000-entry runtime catalog. `ProductionVocabularyEntry` includes `word`, `lemma`, `wordFamilyId`, surface forms, learning metadata, and legacy `morphologyConfidence` (`high | medium | low | none`). It has no persisted root IDs, affix segments, formation explanation, source provenance, or strict `verified | derived | none` status.

`scripts/build-production-vocabulary.ts` creates generated-catalog family IDs through `buildWordFamilyHeads`. It joins selected lemmas using Open English WordNet `derivation` links and chooses the highest-frequency member as the family head. That makes the ID a useful lexical/derivational connectivity hint. It cannot establish a root, etymology, teachable decomposition, or manually verified word family.

Catalog family distribution:

| Measure | Result |
| --- | ---: |
| Production lemmas | 9,000 |
| Distinct `wordFamilyId` values | 7,474 |
| Singleton families | 6,278 |
| Multi-member families | 1,196 |
| Largest observed family size | 6 |
| Example largest heads | `character`, `different`, `election`, `equal`, `sense` |
| Legacy morphology confidence | 9,000 `none`; 0 `high` / `medium` / `low` |

The generator assigns `none` to imported entries. Static curated words can carry the legacy high/medium/low value through their own path, but that old four-level scale is not a verified 2.0 data contract and must not be relabeled retroactively.

### Curated morphology assets (Gold Dataset)

`data/roots.ts` defines 20 curated roots. `data/words.ts`, together with the staged source files it imports, contains 150 curated words: 149 have one or more root IDs and one is intentionally rootless. The set contains root IDs, optional prefix/suffix objects, decomposition text, literal meaning, semantic notes, and manually curated related-family material.

For this phase, those 20 roots and 150 words are treated as the **Morphology Gold Dataset**. They are read-only source material: no word, root, relation, confidence, or explanation was overwritten.

The source tree also contains useful mechanisms worth retaining:

- `data/word-factory.ts` normalizes static word records and supplies the legacy confidence scale.
- `data/roots.ts` is the current root content source.
- `lib/reading/lemmatize.ts` handles inflection-oriented lookup, not root inference.
- `scripts/build-production-vocabulary.ts` provides lexical family connectivity, not a morphology candidate engine.

There is no existing conservative candidate engine for root assignment across the 9,000-entry catalog. Phase 1A-1 therefore adds one only as a pure, read-only dry-run utility.

### Database architecture

`supabase/migrations/202609180001_vocabulary_core.sql` already defines:

- `words`: includes `lemma` and the legacy text `word_family`.
- `roots`: canonical root content.
- `word_roots`: a many-to-many relation with sequence, surface form, role, explanation, numeric confidence, and source.
- `word_forms`: form storage.

This is a good substrate, but it lacks a first-class morphology family, a strict confidence label, score/provenance fields with one contract, and ordered prefix/suffix segmentation. The current `word_roots` relation should be preserved as legacy evidence during an additive migration; it should not be silently repurposed as a new source of truth.

## 2.0 morphology foundation

### Meaning of each layer

```text
Root (a reusable teaching/etymological unit)
  └── Morphology Family (a reviewed, teachable grouping under one primary root)
        └── Word (a specific lemma and its inflectional forms)
```

- A **Root** such as `spect` expresses a reusable meaning unit ("look / see"). A word can expose more than one root, but has at most one primary root for a particular teaching decomposition.
- A **Morphology Family** is a reviewed instructional grouping under a primary root. It is not the existing Open English WordNet connectivity group and it is not necessarily identical to a shared spelling substring.
- A **Word** keeps its current `lemma`, meaning, forms, and legacy `wordFamilyId`. A morphology assignment adds teaching evidence; it never overwrites those fields.

### Proposed application contract

The following is a target data contract for Phase 1A-2, not a migration executed in this phase:

```ts
type MorphologyStatus = "verified" | "derived" | "none";

interface MorphologyRecord {
  wordId: string;                 // joins words.id
  word: string;                   // from words.word
  lemma: string;                  // from words.lemma
  familyId: string | null;        // new morphology family ID, never legacy word_family by implication
  primaryRootId: string | null;
  rootIds: string[];              // derived from ordered segments
  prefixes: Array<{ form: string; meaning: string }>;
  suffixes: Array<{ form: string; meaning: string }>;
  formationExplanation: string | null;
  confidence: MorphologyStatus;
  morphologyScore: number | null; // 0–100
  source: string;
  provenance: Record<string, unknown>;
}
```

`verified` means a record has been manually approved in the new model. `derived` means an algorithm or deterministic import proposed it. `none` means no claim. A derived record must never be described as manually verified, even when the derivation is an exact match to a Gold Dataset lemma.

### Additive database proposal for Phase 1A-2

1. Add `morphology_families` with an immutable key, optional `primary_root_id`, canonical label, status, score, source, provenance JSON, explanation, timestamps, and uniqueness/indexes appropriate to its key and root.
2. Add `word_morphology` as a one-current-record-per-word candidate/review layer: `word_id`, nullable `morphology_family_id`, nullable `primary_root_id`, strict status, score constrained to 0–100, source, provenance JSON, formation explanation, and review timestamps.
3. Add ordered `word_morphology_segments` with `word_morphology_id`, `position`, `kind` (`prefix | root | suffix`), surface form, optional root reference, gloss, and explanation. This is how the API derives `rootIds`, `prefixes`, and `suffixes` without forcing them into an opaque serialized column.
4. Preserve `words.word_family` and `word_roots` unchanged. Treat them as source/legacy evidence during backfill, not as the new morphology-family write target. No trigger should mirror writes between old and new structures.
5. Enable RLS on each new table. Public clients may read published records only; client-side insert/update/delete policies remain absent. Import, review, and promotion run server-side with a scoped service role. Add migration tests for both positive and negative RLS paths.

This is deliberately additive: no destructive rename, no overwrite of `word_family`, and no change to the active vocabulary, Today, Daily 30, progress, or reading contracts.

## Dry-run coverage audit

Implementation:

- `lib/morphology/audit.ts` is a pure function. It accepts catalog entries and curated words, returns a report, and never mutates its inputs.
- `scripts/morphology-coverage-report.ts` reads the catalog and emits JSON only.
- `pnpm morphology:coverage` runs the report.

Candidate rule: normalize the production lemma and accept a candidate **only** if it exactly equals a curated Gold Dataset lemma that has at least one root. No substring, prefix, suffix, word-family, spelling-lookalike, or semantic inference is allowed. Every accepted candidate has `confidence: "derived"`, `source: "gold-dataset-exact-lemma"`, score 100 for this deterministic match rule, and explicit provenance.

Results:

| Measure | Result |
| --- | ---: |
| Total production vocabulary | 9,000 |
| V2 persisted `verified` records | 0 |
| V2 persisted `derived` records | 0 |
| Dry-run exact-Gold candidates | 123 |
| Dry-run `none` | 8,877 |
| Candidate word coverage | 1.37% |
| Production lexical families | 7,474 |
| Families represented by candidates | 123 |
| Candidate family coverage | 1.65% |
| Curated roots known | 20 |
| Curated roots with a candidate | 20 |
| Root coverage | 100% |
| Roots with at least 5 usable candidate words | 17 |
| Roots with at least 10 usable candidate words | 1 (`spect`) |

Top usable root clusters: `spect` 10; `port` 9; `fer`, `mit`, `pos`, `press`, `ten`, `tract`, and `vis` 7 each; `duc`, `fac`, `form`, `ject`, and `rupt` 6 each. `dict` has 10 Gold words but only 3 exact matches in the current production catalog, which is a useful signal that catalog coverage and curated coverage are different measurements.

Example candidate projections include `accept → cap`, `admit → mit`, `affect → fac`, `aspect → spect`, and `attention → ten`. They remain candidates until the new storage/review workflow explicitly promotes records to `verified`.

## Phase 1A-2 proposal

1. Create the additive migration and RLS tests described above; validate it in a local Supabase environment before remote deployment.
2. Import the 20 roots / 150 curated words into a versioned Gold Dataset source with per-record provenance. The import itself should be reviewable and reversible.
3. Materialize the 123 exact-lemma projections as `derived` rows only. Do not change `words.word_family`, static data, or user-visible learning selection.
4. Add a reviewer workflow that can promote an individual candidate to `verified`, adjust segments/explanations, or reject it back to `none`, retaining the decision provenance.
5. Define conservative follow-on candidate rules and a sampled review protocol before applying them. Any rule based solely on an apparent substring or legacy `wordFamilyId` is insufficient.
6. Re-run this coverage report after each batch. Use its verified/derived/none split and cluster counts as the gate for any later Daily 30 or Today-flow design work.

Stop condition for Phase 1A-1: achieved. The project can now distinguish reliable Gold Dataset evidence, deterministic derived candidates, and unknown entries without altering the existing product flow.
