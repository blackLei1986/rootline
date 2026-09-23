# Phase 1A-5 — Lexical-family capacity validation

## Outcome

`NOT_READY_FOR_PHASE_1B`. Gold v4 is locally valid and improves the best 14-day Daily 30 result from 320 to 361 valid slots, but it does not reach the required 420/420. No Today, SRS, UI, remote Supabase, merge, or push operation was performed.

## Gold v3 → v4

| Metric | v3 | v4 | Change |
| --- | ---: | ---: | ---: |
| Gold roots | 48 | 48 | 0 |
| Gold words | 583 | 588 | +5 |
| Exact production candidates | 406 | 411 | +5 |
| Best Daily 30 slots / 420 | 320 | 361 | +41 |

V4 keeps v3 immutable. It adds five exact production lemmas with explicit Etymonline provenance and lexical-family keys. All retained candidates have positive 14-day scarcity-aware marginal gain: one at +1 and four at +5 slots. Candidate sets that measured zero or negative gain under the final scheduler were excluded before the final import.

## Local import and persistence

After a local database reset, all 61 pgTAP tests passed. The v4 dry run had zero errors. First local apply wrote 999 records and 1,003 audit events; the identical second apply reported zero inserted/updated records and zero created audit events.

Validation also found and fixed a reporting-path pagination defect: the Supabase default 1,000-row result limit truncated v4 persisted coverage. `SupabaseMorphologyCoverageRepository` now pages records; the regression test covers 1,001 rows. The final simulator consumes all 599 Gold records plus all 422 exact-lemma candidates.

## Effective-capacity diagnosis

Run the persisted per-root diagnostic with:

```sh
pnpm morphology:daily30-sim -- --dataset=gold-v4 --days=14 --strategy=scarcity-aware --include-capacity-report
```

It emits, for every root, raw usable candidates, per-family distribution, effective capacity under the two-word family cap, selected and unused catalog IDs, and first/last scheduled day. The roots still below the five-word viability threshold are `chron` (4), `cosm` (4), `cred` (4), `jur` (4 / effective 3), `metr` (2), `nav` (3), and `tele` (3). V4 makes `micro` and `phon` viable at 5 each and schedules both completely.

The remaining shortage is primarily structural rather than raw eligibility: scarcity-aware v4 has 411 eligible candidates but fills 361. Its 59 unfilled slots attribute exactly to 44 family-concentration slots and 15 root-capacity-exhaustion slots. This keeps the loss cause distinct from rejected, missing, or `none`-confidence records.

## Scheduler comparison

| Dataset / request | Actual allocation | Filled | Full days | Shortfall attribution |
| --- | --- | ---: | ---: | --- |
| v3 balanced | balanced | 320 / 420 | 7 | 78 family, 22 root |
| v4 balanced | balanced | 331 / 420 | 7 | 51 family, 38 root |
| v4 scarcity-aware | scarcity-aware | 361 / 420 | 10 | 44 family, 15 root |

The scheduler is deterministic and enforces unique IDs, 2–4 roots per viable day, a 15-word root pool, and two words per root/family. It evaluates 2–4-root combinations by current valid fill, then avoids 1–4-word stranded remainders, preserves family breadth, and prefers scarcer roots. It retains an explicit `balanced-fallback` when a scarcity heuristic would reduce the full-horizon result; v4's scarcity-aware allocation is a genuine +30-slot improvement over v4 balanced.

## Evidence boundary and next gate

The retained v4 entries use direct Online Etymology Dictionary word histories for their root relation. The continuation gate is deliberately unchanged: only further independently evidenced, exact-production, positive-marginal-gain families may be added. Phase 1B remains blocked until a fresh valid 14-day simulation reaches 420/420.
