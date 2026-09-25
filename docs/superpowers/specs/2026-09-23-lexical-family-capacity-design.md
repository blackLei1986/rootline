# Lexical-family breadth recovery and effective capacity design

## Intent and authorization

Phase 1A-5 recovers valid 14-day Daily 30 capacity from the evidence-bounded
Phase 1A-4 baseline. The user supplied the complete phase specification and
previously authorized recommended autonomous continuation. Phase 1B remains
out of scope until this phase's readiness gate is met.

The baseline is `gold-v3`: 406 exact production candidates and a balanced
14-day simulation of 320/420 slots. The problem to solve is effective capacity,
not an arbitrary Gold-word or root-count target.

## Architecture

### Pure capacity planner

`lib/morphology/daily30-capacity-planner.ts` will contain pure functions that
operate only on `Daily30Candidate` values and simulator reports. It will
produce one deterministic root diagnostic per root:

- raw usable candidates and lexical-family distribution;
- daily effective capacity (`min(15, sum(min(2, family words)))`);
- simulated contribution, unused candidates, and first/last scheduled day;
- loss classified as family-cap, root-pool, root-cluster, eligible exhaustion,
  or another existing simulator cause.

This makes the daily-capacity limit explicit without treating a raw word count
as learning capacity. It does not create morphology evidence.

### Scheduling strategies

The existing strategy is retained as `balanced` for compatibility. A
`scarcity-aware` strategy will select two-to-four root clusters using a
deterministic score that prefers roots whose currently usable pool is scarce
or would otherwise fall below the five-candidate viability threshold, while
still first maximizing the current day's valid fill. Within a cluster it uses
the same round-robin, 15-word daily pool, two-word root/family cap, exact
candidate, and uniqueness rules as the balanced strategy.

The simulator will accept `strategy: "balanced" | "scarcity-aware"` and
report the selected strategy. Both results are generated from exactly the same
candidate set. Readiness will use the better valid deterministic strategy but
the report will preserve the comparison.

### Marginal capacity planning

`estimateMarginalCapacityGain` will simulate a prospective eligible candidate
against the same candidate set and strategy. Its result is the increase in
filled 14-day slots plus the root/family context used to prioritize review.
The metric returns zero for a duplicate ID, a non-eligible candidate, or a
candidate in an already saturated family when no additional slot can result.
It is a review-prioritization signal only; source-backed curation remains the
sole authority for root membership.

### Evidence-backed v4 curation

`gold-v4` will extend the immutable v3 projection. At least 80% of curation
effort targets existing shortfall-day roots and genuinely new lexical families;
new roots are considered only if source-backed and high-capacity. Every added
word must have independent public etymology provenance, an explicit real
family key, a useful exact production lemma, and a positive measured marginal
capacity gain before it is retained. `gold-v3` is never altered.

## Data flow

1. Load persisted exact production records and construct `Daily30Candidate`s.
2. Run balanced and scarcity-aware 14-day simulations.
3. Build root-level effective-capacity diagnostics and candidate marginal-gain
   rankings from those pure results.
4. Curate only source-supported high-gain v4 entries, then use the unchanged
   atomic local importer to persist the new dataset.
5. Re-run both simulations and emit a report with actual readiness evidence.

## Quality and safety constraints

- Exact lemma projection, explicit provenance, and no substring inference are
  mandatory.
- Candidates remain unique across the horizon; `none` and rejected records are
  ineligible; root/family selection is capped at two per day.
- A day may use only two to four roots. No strategy may fabricate a family,
  select more roots, or reuse a word to claim capacity.
- No remote Supabase, UI, Today, SRS, or production scheduling changes.
- `READY_FOR_PHASE_1B` requires 420 unique valid slots, 14 acceptable days,
  zero unsupported/none fallback, and no serious concentration violation.
- If no source-backed positive-gain candidate remains, report `NOT_READY` and
  the exact deficit rather than weaken a guard.

## Test design

Tests will pin the effective-capacity formula, deterministic strategies,
scarcity preservation of a root that would become stranded, positive marginal
gain for a new family versus zero gain for saturation, mixed shortfall-cause
accounting, v4 additive versioning, and unchanged importer idempotency.
