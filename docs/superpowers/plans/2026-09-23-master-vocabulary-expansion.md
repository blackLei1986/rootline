# Phase 1A-6 Master Vocabulary Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the production Master Vocabulary in quality-controlled batches and measure whether the existing morphology dataset can support the original 14-day Daily 30 gate.

**Architecture:** Reuse the ECDICT + Open English WordNet production builder and its report/audit gates. Make the existing tier allocation support controlled targets above 9,000 without altering root, family, or scheduling rules; curate morphology only from independently cited evidence and import through the current atomic local importer.

**Tech Stack:** TypeScript, Vitest, pnpm, local Supabase, pgTAP.

**Spec:** `/Users/leipan/.codex/attachments/883895ea-2ee0-4418-a0f7-2dfcd8e1aa78/已粘贴的文本.txt`

## Global Constraints

- Default daily target remains 30 words with approximately 2–4 roots/day and 5–15 useful words/root.
- Do not weaken morphology, family, uniqueness, or readiness gates to make the simulation pass.
- Expand in quality-controlled batches of approximately 150–300; stop on 420/420.
- Do not use substring matching, spelling resemblance, legacy family IDs, simulator deficit, or unsupported morphology as root evidence.
- Use only local Supabase; no Today/SRS/product UI changes and no remote production writes.

## Review Focus

- Candidate source data is missing or incomplete: fail safely without replacing accepted catalog files.
- A requested target does not divide evenly across content tiers: quotas must sum exactly to the target and be deterministic.
- Candidate records have missing/low frequency ranks, weak examples, duplicates, or low-value extension tiers: report and exclude them through current gates.
- Gold additions do not exactly match production lemmas or lack independent evidence: keep them out of morphology projection.
- Local Supabase is unavailable: do not silently substitute non-persisted coverage for the persisted readiness gate.

### Task 1: Support deterministic expansion quotas

**Files:** Create `lib/vocabulary-production-plan.ts` and `tests/vocabulary-production-plan.test.ts`; modify `scripts/build-production-vocabulary.ts`.

**Produces:** `computeProductionTierTargets(target)` returning deterministic quotas preserving the existing tier proportions and summing exactly to target.

- [x] Test the 9,000 baseline and expansion targets, including exact totals and deterministic allocation.
- [x] Run the focused test and confirm RED before implementation.
- [x] Implement proportional largest-remainder allocation and use it in the existing builder.
- [x] Run the focused test, typecheck, and lint.

### Task 2: Build and review one expansion batch

**Files:** Modify generated production catalog, manifest, QA sample, and public vocabulary shards only through `vocab:build-production`.

- [x] Record the initial production report, dry-run morphology coverage, persisted coverage, and 14-day simulations.
- [x] Build and review three controlled 250-word batches with ECDICT frequency ranks and OEWN definitions/examples; review frequency, tags, morphology, family identity, and pedagogical usefulness.
- [x] Run production report and audit; all three retained batches passed existing gates. The final frontier was retained for its source exam tags and two exact existing Gold mappings despite low frequency.
- [x] Curate Gold-v5 entries only where exact lemmas and root relations have independent public evidence and real lexical-family identity.
- [x] Run exact-lemma dry-run, local apply twice, persisted coverage, root/capacity reports, and both 14-day strategies; stop at 9,750 with 380/420 because further low-frequency expansion has diminishing value.

### Task 3: Verify, report, and review

**Files:** Create `docs/phase-1a-6-master-vocabulary-expansion-report.md`; modify tests only if they encode an actual discovered regression.

- [x] Run pgTAP on local Supabase, then production vocabulary audit/report and morphology import checks (no database reset was needed; the existing local persistence evidence was retained).
- [x] Run full test suite, lint, typecheck, production build, and `git diff --check`.
- [x] Record before/after counts, batch quality mix, persisted morphology, capacity losses, readiness verdict, and limitations in `docs/phase-1a-6-master-vocabulary-expansion-report.md`.
- [ ] Have a fresh reviewer inspect the branch; correct Critical/Important findings before reporting.
