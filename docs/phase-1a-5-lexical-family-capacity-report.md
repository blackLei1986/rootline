# Phase 1A-5 — Lexical-family capacity validation

## Outcome

`NOT_READY_FOR_PHASE_1B`. Gold v4 is locally valid and improves the best 14-day Daily 30 result from 320 to 341 valid slots, but it does not reach the required 420/420. No Today, SRS, UI, remote Supabase, merge, or push operation was performed.

## Gold v3 → v4

| Metric | v3 | v4 | Change |
| --- | ---: | ---: | ---: |
| Gold roots | 48 | 49 | +1 |
| Gold words | 583 | 599 | +16 |
| Exact production candidates | 406 | 422 | +16 |
| Best Daily 30 slots / 420 | 320 | 341 | +21 |

V4 keeps v3 immutable. It adds one explicitly sourced root (`volv`) and 16 exact production lemmas with explicit Etymonline provenance and lexical-family keys. The expanded-root share is one of eight roots receiving v4 effort (12.5%). All retained candidates have positive 14-day scarcity-aware marginal gain: ten at +1, two at +3, and four at +8 slots. Two initially sourced candidates (`generous`, `degenerate`) measured zero gain and were excluded before the final import.

## Local import and persistence

After a local database reset, all 61 pgTAP tests passed. The v4 dry run had zero errors. First local apply wrote 1,021 records and 1,025 audit events; the identical second apply reported zero inserted/updated records and zero created audit events.

Validation also found and fixed a reporting-path pagination defect: the Supabase default 1,000-row result limit truncated v4 persisted coverage. `SupabaseMorphologyCoverageRepository` now pages records; the regression test covers 1,001 rows. The final simulator consumes all 599 Gold records plus all 422 exact-lemma candidates.

## Effective-capacity diagnosis

Run the persisted per-root diagnostic with:

```sh
pnpm morphology:daily30-sim -- --dataset=gold-v4 --days=14 --strategy=scarcity-aware --include-capacity-report
```

It emits, for every root, raw usable candidates, per-family distribution, effective capacity under the two-word family cap, selected and unused catalog IDs, and first/last scheduled day. The roots still below the five-word viability threshold are `chron` (4), `cosm` (4), `cred` (4), `jur` (4 / effective 3), `metr` (2), `nav` (3), and `tele` (3). V4 makes `micro` and `phon` viable at 5 each and schedules both completely; `volv` is viable at 6 and schedules completely.

The remaining shortage is primarily structural rather than raw eligibility: scarcity-aware v4 has 422 eligible candidates but fills 341. Its 79 unfilled slots attribute exactly to 47 family-concentration slots and 32 root-capacity-exhaustion slots. This keeps the loss cause distinct from rejected, missing, or `none`-confidence records.

## Scheduler comparison

| Dataset / request | Actual allocation | Filled | Full days | Shortfall attribution |
| --- | --- | ---: | ---: | --- |
| v3 balanced | balanced | 320 / 420 | 7 | 78 family, 22 root |
| v4 balanced | balanced | 338 / 420 | 7 | 48 family, 34 root |
| v4 scarcity-aware | scarcity-aware | 341 / 420 | 8 | 47 family, 32 root |

The scheduler is deterministic and enforces unique IDs, 2–4 roots per viable day, a 15-word root pool, and two words per root/family. It retains an explicit `balanced-fallback` when a scarcity heuristic would reduce the full-horizon result; v4's scarcity-aware allocation is a genuine +3-slot improvement over v4 balanced.

## Evidence boundary and next gate

The retained v4 entries use direct Online Etymology Dictionary word histories for their root relation. The continuation gate is deliberately unchanged: only further independently evidenced, exact-production, positive-marginal-gain families may be added. Phase 1B remains blocked until a fresh valid 14-day simulation reaches 420/420.
