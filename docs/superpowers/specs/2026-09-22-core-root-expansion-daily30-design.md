# Rootline 2.0 Phase 1A-3: Core Root Expansion and Daily 30 Readiness Design

## Intent

Phase 1A-3 grows the trusted, versioned Rootline morphology curriculum enough to measure whether a future Root-first Daily 30 experience is viable. It does not implement Daily 30, change Today, alter SRS or user-learning state, or deploy a remote database.

Success is an evidence-backed, locally imported Gold Dataset v2; reports derived from its persisted rows; and a deterministic, read-only 14-day simulation that either passes the published readiness gate or precisely explains why it does not.

## Scope and invariants

- Preserve `gold-v1` as-is. No Phase 1A-3 change edits its source facts or reuses its version identifier for changed content.
- Add a full, additive `gold-v2` snapshot containing the v1 curriculum plus only new roots and word records with explicit evidence.
- Do not infer a word's morphology from a substring. The only automated production projection is exact normalized lemma equality with an explicitly curated Gold word.
- Do not modify `production-catalog.json`, production `wordFamilyId`, Today, SRS, user-progress data, or remote Supabase.
- Production projections created by v2 remain `derived`; only reviewer actions may set a production record to `verified`.
- Preserve existing atomic import, append-only audit, verified-over-derived protection, and same-source/version rejection protection.

## Source and curation policy

Each new v2 root and variant must have a `provenance` object containing at least a stable source URL, access date, source title, and a concise evidence note. The primary public reference is the [Online Etymology Dictionary source methodology](https://www.etymonline.com/columns/post/sources), whose stated references include specialist Latin, Greek, and English etymological dictionaries. A second accessible dictionary Word History is recorded when it materially confirms a relationship.

The curated source labels each relation as one of:

- `historical`: the cited source supports the origin or form relationship.
- `pedagogical`: a transparent learner mnemonic, explicitly not asserted as historical fact.

No root, variant, or word enters v2 if its relation has neither direct evidence nor an explicitly bounded pedagogical rationale. Ambiguous surface forms are excluded rather than broadened through spelling rules.

## Gold Dataset v2 model

`gold-v2` is a complete snapshot, not a patch to v1. It contains all v1 records unchanged plus approximately 25–30 additional curated canonical roots and enough high-value curated words to target 400–600 Gold words in total.

Each new root has:

- canonical `rootKey` and root form;
- English and Chinese core meanings;
- reliable origin when available;
- a pedagogical explanation and risk note;
- `etymologyConfidence` (`high`, `medium`, or `cautious`) and `pedagogicalConfidence` (0–100);
- explicit source provenance;
- zero or more explicitly declared variants.

Each variant has a surface form, relation classification (`historical` or `pedagogical`), explanation, and provenance. A variant never creates an automatic word match. Curated word records refer only to their canonical root keys.

Each v2 curated word has an explicit `lexicalFamilyKey`. A family key represents a meaningful lexical family chosen during curation; it is not derived from spelling or inflection. V1 records keep their existing per-word family keys so v1 history is not rewritten.

## Persistence model

The existing `morphology_roots` row stores root descriptions, confidence and root-level provenance in its structured educational/provenance JSON. A new `morphology_root_variants` table stores one row per `(dataset, canonical root, variant form)` with relation classification, explanation, and provenance.

The atomic import payload gains root variants and optional explicit lexical family keys. The existing `apply_morphology_import` RPC validates that every variant points to a root in the same dataset, writes all datasets/roots/variants/families/records/segments/events in its one transaction, and rolls back on any invalid relation. It continues to revoke public execution and permit only `service_role`.

The CLI accepts exactly `gold-v1` or `gold-v2`. It builds one plan for both `--dry-run` and `--apply`; it never writes from dry-run. Import records preserve source, version, content hash, source-word identity, exact-lemma matching rule, and root/word provenance.

## Reporting model

The persisted root expansion report reads only `gold-v2` persisted morphology rows plus the fixed production vocabulary catalog. For every root it emits:

- Gold word count and production exact-match count;
- usable production word and lexical-family counts;
- high-frequency, IELTS, TOEFL, and academic counts;
- root confidence and curation risk notes.

Rows sort by a deterministic pedagogical-value score: pedagogical confidence, usable-family breadth, usable-word coverage, high-frequency coverage, exam/academic coverage, then canonical root key as the final tie-breaker. Counts never use proposed candidates or substring matches.

## Daily 30 readiness simulator

`pnpm morphology:daily30-sim --days=14 --dataset=gold-v2` is a pure, non-production report command. It reads the persisted dataset and production catalog, then performs no mutation of Supabase or any application learning state.

Eligible candidates are production records from the selected dataset with `derived` or `verified` confidence and a non-rejected review status. Candidates with `none` confidence are excluded. Candidates are grouped by canonical root and explicit lexical family.

For each day, the deterministic planner:

1. chooses two to four root clusters that have five to fifteen remaining eligible words and sufficient family breadth;
2. ranks root clusters by available family breadth, usable-word capacity, frequency, exam/academic coverage, pedagogical confidence, and canonical key;
3. ranks words within each cluster by frequency rank, IELTS/TOEFL/academic tags, learning value, family breadth contribution, then catalog ID;
4. selects no more than two words from a lexical family per root per day;
5. never repeats a selected production word across days;
6. fills to 30 only with eligible records. If it cannot do so under these rules, it reports the exact shortfall and warnings rather than weakening constraints.

Every daily result includes selected root clusters, per-root counts, words, frequency bands, tag coverage, family diversity, fallback count, and warnings. The summary includes requested/fully-filled days, target/filled slots, unique words/roots, root capacity counts, none-confidence fallback count, and family-concentration warnings.

## Readiness gate

`READY_FOR_PHASE_1B` requires all of:

- at least 400 usable production morphology words;
- at least 35 roots with at least 5 usable production words;
- at least 10 roots with at least 10 usable production words;
- fourteen consecutive fully filled 30-word plans with no word reuse;
- zero none-confidence root-cluster fallback;
- zero serious family-concentration warning;
- passing engineering quality gates.

Although 400 is the coverage threshold, fourteen non-repeating 30-word days require at least 420 eligible production words. Therefore any result below 420 cannot pass the consecutive-plan condition and must be `NOT_READY_FOR_PHASE_1B`, even if it clears 400 coverage. This is a logical consequence of the requested simulation, not a lowered or substituted quality bar.

## Test and validation contract

Tests must demonstrate v2 source/version separation, root variant persistence, provenance preservation, exact production projection, no substring inference, lexical-family diversity, root-cluster capacity, deterministic simulations, no cross-day reuse, two-to-four-root preference, no `none` fallback, shortfall reporting, and both readiness outcomes.

Validation runs locally only: clean local Supabase reset, v2 dry-run, first apply, identical second apply, persisted coverage/root reports, 14-day simulator, pgTAP, lint, typecheck, Vitest, and production build. The final report compares v1 and v2 totals and ends Phase 1A-3 without starting Phase 1B.
