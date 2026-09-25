# Root depth expansion and Daily 30 capacity design

## Intent

Phase 1A-4 increases trustworthy, production-relevant morphology capacity until a 14-day, 30-word/day simulation can pass without weakening any quality rule. It is a content-readiness phase only: no Today planner, learner progress, SRS, UI, or remote Supabase changes.

## Approved execution assumption

The user requested recommended handling without intermediate interruption. This design therefore uses the existing isolated Phase 1A branch, a new immutable `gold-v3` additive snapshot, test-first implementation, and local-only database validation.

## Data model and provenance

`gold-v3` is assembled as `gold-v2` plus `data/morphology/gold-v3.ts`. The v3 source contains two explicit categories: additions to existing canonical roots and carefully selected new high-capacity roots. Each word retains a stable `v3:<word>` identity, a root-specific explicit lexical-family key, and public etymology provenance. No v2 row or dataset hash is modified.

Production catalog membership ranks an already evidenced candidate; it never establishes root membership. Curation is accepted only where a cited source supports the asserted relationship. A data-integrity test rejects duplicate v3 word IDs and an import test verifies exact-lemma-only projection.

## Capacity reports

The persisted report adds `capacityTier` (`A`: >=10 usable words and >=3 families; `B`: 6-9; `C`: 3-5; `D`: <3), a deterministic capacity score, and a sorted words-per-family distribution. The score is a ranking signal only: usable words, family breadth, high-frequency and exam/academic coverage, and root pedagogical confidence. It does not create etymology evidence.

## Simulation

The pure Daily 30 simulator remains root-first and excludes rejected or `none` records. It selects 2-4 roots daily and caps selections at two words per root/family/day. A deep root is eligible once it has at least five remaining candidates; its daily candidate pool is then deterministically bounded to its best 15 candidates. This replaces the incorrect prior behavior that excluded roots with more than 15 total candidates.

Every shortfall includes deterministic counts for eligible-word exhaustion, root-capacity exhaustion, family concentration, root-cluster constraints, and other quality exclusions. Each day exposes root cluster metrics, selected words, tag/frequency counts, family use, and warnings.

## Readiness

`READY_FOR_PHASE_1B` requires 420/420 unique slots across 14 days, no `none` fallback, no duplicate selected IDs, 2-4 roots per day, no serious family/root quality warning, and at least 400 eligible usable production words. Supporting targets are >=500 eligible words, >=40 roots with five usable words, >=25 roots with ten usable words, and >=25 roots with five usable families. If evidence is exhausted before the gate, report `NOT_READY_FOR_PHASE_1B`; do not fabricate data.

## Local validation

Reset only local Supabase; dry-run, apply `gold-v3`, repeat apply, then emit coverage, capacity, and 14-day simulation reports. Run pgTAP, lint, typecheck, complete tests, and build. The final report records actual deltas and diagnostics and explicitly states whether remote state was untouched.
