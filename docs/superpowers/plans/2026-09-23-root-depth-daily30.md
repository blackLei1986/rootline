# Root Depth Expansion + Daily 30 Capacity Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an immutable `gold-v3` expansion and capacity-aware simulator that reaches Daily 30 readiness only with verified morphology evidence.

**Architecture:** v3 extends v2 through a standalone evidence-backed curation source. Existing atomic import and exact-lemma projection remain unchanged. The persisted report calculates capacity tiers and family distributions, while the pure simulator treats 15 as a daily per-root pool limit rather than an exclusion threshold and emits causal diagnostics.

**Tech Stack:** TypeScript, Vitest, Supabase/pgTAP, Zod, Next.js project scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-root-depth-daily30-design.md`

## Global Constraints

- Preserve all `gold-v2` source/data history; add `gold-v3` only.
- Use exact catalog lemma matching only; spelling is not etymology evidence.
- Do not weaken confidence, duplicate, family-diversity, or 2-4-root quality rules.
- Local Supabase only; no production/UI/Today/SRS modifications.

## Review Focus

- Deep roots (>15 remaining candidates) must become usable via a capped daily pool, never be excluded.
- A root with one lexical family cannot simulate as diverse capacity.
- A v3 word with no exact production lemma cannot create a derived record.
- A second identical v3 import must create neither record writes nor audit events.
- Shortfall diagnostics must attribute every unfilled slot without adding weaker candidates.

### Task 1: Add immutable evidence-backed v3 curation

**Files:** Create `data/morphology/gold-v3.ts`; modify `lib/morphology/types.ts`, `lib/morphology/gold-dataset.ts`, CLI argument tests, dataset/import tests.

- [x] Write failing tests asserting `gold-v3` includes v2 unchanged, has unique word IDs, has explicit provenance/family keys, and only derives exact production lemmas.
- [x] Implement `GoldDatasetVersion` v3 selection and a v3 source weighted toward expansions of existing near-ready roots, with high-capacity new roots only where sourced evidence supports them.
- [x] Run focused tests, typecheck, and lint; commit `feat: add gold v3 root depth curriculum`.

### Task 2: Report root capacity tiers and diversity

**Files:** Modify `lib/morphology/root-expansion-service.ts`, `scripts/root-expansion-report.ts`; modify report tests.

- [x] Write failing report tests for A/B/C/D tier boundaries, words-per-family distribution, stable capacity score ordering, and tag counts.
- [x] Implement capacity tier/score and deterministic family distribution from persisted exact records only.
- [x] Run focused tests; commit `feat: report root capacity tiers`.

### Task 3: Upgrade quality-preserving simulation diagnostics

**Files:** Modify `lib/morphology/daily30-simulator.ts`, `scripts/morphology-daily30-sim.ts`; modify simulator tests.

- [x] Write failing tests for deep-root daily pooling, per-cause shortfall counts, cluster metrics, family concentration, and deterministic 14-day readiness.
- [x] Implement capped per-root daily pools, causal diagnostics, and expanded daily metrics without relaxing any eligibility or family rule.
- [x] Run focused tests; commit `feat: diagnose daily 30 capacity shortfalls`.

### Task 4: Locally validate `gold-v3` readiness

**Files:** Create `docs/phase-1a-4-root-depth-capacity-report.md`; modify pgTAP only if clean-local validation exposes an untested atomic difference.

- [x] Reset local DB; run pgTAP, v3 dry-run, first/second apply, persisted coverage, capacity report, and 14-day simulation.
- [x] Add a failing regression test before correcting any validation defect.
- [x] Run lint, typecheck, full tests, build, and `git diff --check`; document exact actual metrics and readiness.
- [x] Commit `docs: validate root depth capacity readiness`.
