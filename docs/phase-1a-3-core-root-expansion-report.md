# Phase 1A-3 core root expansion validation

Validated locally on 2026-09-22 against a clean Docker Supabase instance. No remote database was contacted or changed.

## v2 import

- Dataset: `gold-v2`; 45 canonical roots (v1: 20), 408 Gold words (v1: 150), and 3 historical `cap` variants (`capt`, `cept`, `cip`).
- The dry run reported 45 root inserts, 3 variant inserts, 236 explicit lexical families, 408 Gold records, 271 exact-lemma derived candidates, 735 segments, and no errors.
- First local apply inserted 679 records and created 683 audit events. Second apply inserted/updated zero records, reported 679 unchanged records, and created zero audit events.
- Exact-lemma projection is the only production projection rule; no substring matching is used. Persisted v2 coverage is 271 derived usable records (3.01% of the production catalog), with 34 roots at five usable words and three at ten.

## Capacity and Daily 30 simulation

- The persisted report records root-level source provenance, confidence/risk metadata, explicit lexical families, and variants. The CLI emits the complete deterministic root ordering for a selected persisted dataset.
- The 14-day local simulation found 271 eligible usable words across 45 roots, filled 208 of 420 slots, and never used a `none` confidence fallback or repeated a selected word.
- Day 1 filled 30 slots; capacity then declined due to the two-words-per-root-family/day quality guard. Days 10–14 correctly emitted shortfalls rather than weakening quality requirements.
- Readiness: **NOT_READY_FOR_PHASE_1B**. Limiting metrics: `eligible-usable-words:271<420`, `filled-slots:208<420`, non-2–4-root days after capacity exhaustion, and family-concentration warnings.

## Verification

- Clean local database reset and all pgTAP tests passed (including atomic variants, root metadata provenance, RLS, audit events, and rollback).
- Focused v2 dataset, persistence, report, and simulator tests passed; TypeScript and ESLint passed before final quality-gate execution.

Known limitation: the local v2 expansion reaches the 400-Gold-word content target but not the separate 420 eligible-production-word Daily 30 readiness threshold. This report intentionally does not add Phase 1B behavior or relax confidence/family constraints.
