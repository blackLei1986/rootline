# Lexical-family breadth recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach 420 valid unique Daily 30 slots only through capacity-preserving scheduling and source-backed, positive-gain `gold-v4` curation.

**Architecture:** A pure planner diagnoses root/family capacity and marginal candidate gain. The simulator retains `balanced` as its baseline and adds deterministic `scarcity-aware` scheduling under identical hard rules. Only evidence-backed additions with positive measured gain may enter immutable `gold-v4` through the existing local atomic importer.

**Tech Stack:** TypeScript, Vitest, Supabase/pgTAP, Zod, Next.js project scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-lexical-family-capacity-design.md`

## Global Constraints

- Keep `gold-v3` immutable and add only `gold-v4`.
- Keep exact lemma, explicit provenance, real family identity, no `none`, uniqueness, 2-4 roots/day, a 15-word root pool, and a two-word root/family cap.
- Do not use spelling, substring, `wordFamilyId`, or AI-only inference as evidence.
- Make no Today/SRS/UI/remote Supabase changes. Phase 1B remains blocked unless a valid simulation returns 420/420.

## Review Focus

- Deep roots must be capped per day, never excluded.
- Scarce roots that would become sub-five stranded pools must be protected when a valid fill permits it.
- A new family can earn positive marginal gain; duplicate/saturated additions cannot falsely earn it.
- Mixed family-cap and root-pool losses must add exactly to the shortfall.
- A repeat v4 apply must write no records or audit events.

### Task 1: Add pure effective-capacity and marginal-gain planning

**Files:** Create `lib/morphology/daily30-capacity-planner.ts`, `tests/morphology/daily30-capacity-planner.test.ts`; modify `lib/morphology/daily30-simulator.ts`.

**Produces:** `buildEffectiveDailyCapacityReport({ candidates, simulation })` and `estimateMarginalCapacityGain({ candidates, candidate, days, strategy })`.

- [ ] Write failing tests asserting a five-word `3+2` family root has raw capacity 5 but daily effective capacity 4; a new-family candidate adds one slot; and a saturated-family candidate adds zero.
- [ ] Run `pnpm exec vitest run tests/morphology/daily30-capacity-planner.test.ts`; verify it fails because the module is absent.
- [ ] Implement pure root diagnostics: sorted family distribution, raw/effective capacity, selected/unused IDs, exhaustion day, and existing shortfall-cause totals. Implement marginal gain as `augmented.filledSlots - baseline.filledSlots` without creating evidence.
- [ ] Run `pnpm exec vitest run tests/morphology/daily30-capacity-planner.test.ts && pnpm run typecheck && pnpm run lint`; verify PASS.
- [ ] Commit with `feat: analyze effective daily capacity`.

### Task 2: Add scarcity-aware deterministic simulation

**Files:** Modify `lib/morphology/daily30-simulator.ts`, `scripts/morphology-daily30-sim.ts`, and `tests/morphology/daily30-simulator.test.ts`.

**Produces:** `simulateDaily30({ candidates, days, strategy: "balanced" | "scarcity-aware" })`, strategy-labelled reports, and a CLI strategy argument.

- [ ] Write failing tests where scarcity-aware scheduling fills more valid slots than balanced by consuming a root before its remaining pool would be below five; assert deterministic output, 2-4 roots/day, unique IDs, and unchanged family cap.
- [ ] Run `pnpm exec vitest run tests/morphology/daily30-simulator.test.ts`; verify failure because strategy selection is absent.
- [ ] Implement cluster choice that maximizes valid current fill, then prefers preventing sub-five leftovers, greater remaining family breadth, scarcer roots, and stable root-key ties. Reuse the existing round-robin selection and all guards.
- [ ] Run focused simulator/planner tests plus typecheck and lint; verify PASS.
- [ ] Commit with `feat: schedule daily capacity by scarcity`.

### Task 3: Diagnose v3 and curate positive-gain v4 breadth

**Files:** Create `data/morphology/gold-v4.ts`; modify `lib/morphology/types.ts`, `lib/morphology/gold-dataset.ts`, `lib/morphology/import-cli.ts`, dataset/import tests.

**Produces:** `createGoldDatasetV4()` and v4 CLI support.

- [ ] Write failing tests asserting v4 is additive, has explicit source URLs and family keys, and v4 imports only exact production lemmas.
- [ ] Run dataset/import focused tests; verify failure because v4 is absent.
- [ ] Use v3 planner diagnostics to target shortfall roots. For every retained addition, record independent public evidence, a real new family, exact production lemma, pedagogical rationale, and positive 14-day marginal gain. Exclude unsourced, duplicate, and saturated-family candidates; new roots remain at most roughly 20% of effort.
- [ ] Run focused tests, typecheck, lint, and a local `gold-v4` dry run; require zero plan errors.
- [ ] Commit with `feat: add positive-gain gold v4 breadth`.

### Task 4: Validate local v4 readiness or evidence exhaustion

**Files:** Create `docs/phase-1a-5-lexical-family-capacity-report.md`; modify `scripts/morphology-daily30-sim.ts`; modify pgTAP only for a discovered atomic-import defect.

- [ ] Reset local Supabase and run pgTAP before v4 import.
- [ ] Run v4 dry-run, first apply, and identical second apply using only local credentials; require second run zero inserts, updates, and audit events.
- [ ] Emit persisted coverage/root reports, effective-capacity report, marginal-gain distribution, and both 14-day scheduler outputs. Record all required before/after and loss-attribution metrics.
- [ ] Run `pnpm test && pnpm run lint && pnpm run typecheck && pnpm run build && git diff --check`; verify PASS.
- [ ] If 420 valid slots are absent and no source-backed positive-gain additions remain, document `NOT_READY_FOR_PHASE_1B`; otherwise document `READY_FOR_PHASE_1B` and stop expansion.
- [ ] Commit with `docs: validate lexical family capacity readiness`.
