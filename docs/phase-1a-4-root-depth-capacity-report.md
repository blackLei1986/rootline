# Phase 1A-4 — Root depth and Daily 30 capacity report

## Verdict

`gold-v3` is **NOT_READY_FOR_PHASE_1B**. The local evidence-backed projection
cannot fill the required 420 unique slots without either reusing candidates,
weakening the two-to-four-root and family-diversity rules, or inventing further
morphology evidence. None of those changes was made.

This is an evidence-exhaustion result for the curated v3 inventory, not a claim
that the product is ready for Phase 1B.

## Scope and safeguards

- `gold-v3` is an additive snapshot over unchanged `gold-v2`; it has explicit
  per-word public etymology provenance and explicit lexical-family groups.
- Production-catalog membership is only an exact-lemma projection. It is never
  treated as evidence of a root relation.
- The local importer remains atomic and idempotent. No remote Supabase project,
  Today planner, SRS/progress state, or UI was changed.
- The simulator now caps a deep root's **daily pool** at 15 rather than excluding
  it, rotates through two to four viable roots to avoid front-loading a single
  root, caps one root/family at two selected words, and reports root, family,
  frequency, tag, concentration, warning, and shortfall diagnostics per day.

## Local validation

All commands below were executed against a reset local Supabase instance.

| Check | Actual result |
| --- | --- |
| `supabase db reset --local` | completed |
| pgTAP | 4 files, 61 assertions, PASS |
| v3 dry run | 48 roots, 583 gold words, 366 families, 406 exact derived candidates, 0 errors |
| first v3 apply | 989 records inserted; 993 audit events created |
| identical second apply | 0 inserts, 0 updates, 989 unchanged; 0 audit events created |
| focused morphology tests | PASS |
| lint, TypeScript, diff whitespace | PASS |

## Persisted capacity

| Metric | Actual | Supporting target | Result |
| --- | ---: | ---: | --- |
| exact usable production candidates | 406 | 500 | below target |
| roots with at least 5 usable words | 39 | 40 | below target |
| roots with at least 10 usable words | 20 | 25 | below target |
| roots with at least 5 usable families | 23 | 25 | below target |
| tier A / B / C / D roots | 20 / 15 / 12 / 1 | diagnostic | recorded |
| persisted morphology coverage | 4.51% (406 / 9,000) | diagnostic | recorded |

The first three capacity targets miss by a small amount, but the exact-candidate
total is also 14 short of the 420 unique words required by the simulator. The
remaining deficit must not be filled by substring matches or unevidenced root
claims.

## 14-day Daily 30 simulation

The balanced root-first schedule selected 320 of 420 slots. All selected words
were unique and non-`none`; all fully filled days used two to four roots. Of
the remaining 100 slots, 94 were blocked by the per-root lexical-family cap and
6 by exhausted viable root pools.

Frequency uses `very-high/high/medium/low`; tags use `general/IELTS/TOEFL/academic`.

| Day | Roots | Selected | Families | Frequency mix | Tags | Max root / family | Shortfall | Warning |
| ---: | --- | ---: | ---: | --- | --- | --- | ---: | --- |
| 1 | pos, spect, mit, press | 30 | 29 | 4/20/3/0 | 27/19/23/24 | 8 / 2 | 0 | — |
| 2 | tract, vis, form, port | 30 | 29 | 10/13/7/0 | 30/19/18/19 | 8 / 2 | 0 | — |
| 3 | cap, duc, fer, ject | 30 | 28 | 10/17/3/0 | 28/18/16/19 | 8 / 2 | 0 | — |
| 4 | mov, scrib, ten, fac | 30 | 30 | 12/9/9/0 | 25/19/19/23 | 8 / 1 | 0 | — |
| 5 | rupt, struct, cess, pos | 30 | 26 | 5/9/15/1 | 28/19/25/27 | 8 / 2 | 0 | — |
| 6 | spect, press, serv, dict | 30 | 26 | 3/8/11/8 | 17/16/23/26 | 8 / 2 | 0 | — |
| 7 | mit, cur, pend, cess | 30 | 21 | 4/6/15/5 | 19/18/22/26 | 9 / 2 | 0 | — |
| 8 | tract, vis, loc, gen | 25 | 18 | 2/5/9/9 | 18/14/16/21 | 8 / 2 | 5 | family concentration |
| 9 | liter, manu, form, cap | 24 | 16 | 0/6/12/6 | 17/12/18/20 | 7 / 2 | 6 | root-capacity exhaustion |
| 10 | act, equ, log, grad | 23 | 12 | 3/9/11/0 | 17/12/12/17 | 6 / 2 | 7 | family concentration |
| 11 | aud, graph, dom, bio | 22 | 12 | 0/7/8/7 | 10/14/12/18 | 6 / 2 | 8 | family concentration |
| 12 | centr, bene, corp, ann | 16 | 11 | 3/4/4/5 | 11/11/11/14 | 4 / 2 | 14 | family concentration |
| 13 | none viable | 0 | 0 | 0/0/0/0 | 0/0/0/0 | 0 / 0 | 30 | family concentration |
| 14 | none viable | 0 | 0 | 0/0/0/0 | 0/0/0/0 | 0 / 0 | 30 | family concentration |

Summary: 406 eligible candidates, 320 filled slots, 48 distinct roots, 94
shortfall slots attributed to family concentration, and 6 to root-capacity
exhaustion. Readiness limiting metrics:
`eligible-usable-words:406<420`, `filled-slots:320<420`,
`root-clusters:not-2-to-4`, and `quality-warnings:present`.

## Follow-up boundary

Phase 1B must remain blocked. Any future capacity work needs newly reviewed,
source-supported words that also have exact production lemmas and add genuine
lexical-family breadth. It must not reclassify spelling similarity, duplicate an
existing lexical family under a new key, relax the two-word family cap, or add
fallback candidates.
