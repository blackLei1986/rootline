# Rootline 2.0 — Phase 1A-6 Final Report

## Outcome

Phase 1A-6 expands the accepted production vocabulary from 9,000 to 9,750 entries in three reviewed batches of 250. Gold morphology is now `gold-v5`; persisted exact-lemma mappings rose from the recorded 9,250-word Gold-v4 snapshot (412) to 422 at 9,750. The best 14-day simulation fills 380/420 valid slots, so the result is **NOT_READY_FOR_PHASE_1B**. No daily product rules were relaxed, and Phase 1B was not started.

## Expansion and value review

The existing ECDICT + Open English WordNet production pipeline selected by ECDICT frequency rank, WordNet definition/examples, tier requirements, and candidate review. Exact lemma exclusions were used for `algerian`, `guatemalan`, `goddamned`, `unman`, `cockney`, `pussy`, `orgy`, `dung`, `ovarian`, `snapper`, and `antiquate`. The final 750 additions span ranks 14,074–15,528; all are low-frequency `tier-4-extension` entries. ECDICT and OEWN-backed meaning, example, source, and tier coverage were 100%, with no duplicate lemmas/families within the accepted catalog, broken references, or tier-depth issues.

Direct ECDICT tags across those 750 additions (not mutually exclusive): IELTS 74; TOEFL 195; GRE 302; 369 distinct TOEFL-or-GRE academic-tagged lemmas; 378 with at least one IELTS/TOEFL/GRE tag; 42 with a general-English school/exam tag. These are source tags, not a claim that the entire tail is high-frequency general English. Production `coverageTags` also use tier-based fallback: for example, an academic tag may be assigned when no source exam tag is present. Whole-catalog reported counts changed from 9,000 to 9,750 as follows: general 5,000→5,417; academic 6,844→7,445; IELTS 3,472→3,545; TOEFL 4,125→4,319. The general/academic catalog totals therefore should not be read as direct additions from source tags alone.

The catalog contains 8,089 WordNet family IDs versus 7,474 at baseline (net +615). Within the 750 added lemmas, 617 family IDs were absent from the baseline and 128 joined an existing family identity; the selected tier quotas also removed two formerly represented IDs from the final catalog. No family IDs were split to manufacture capacity.

## Gold-v5 and persisted morphology

Five independently sourced Gold words were added: `cessation`→cess, `choreograph`→graph, `conjecture`→ject, `eccentricity`→centr (extension of the existing eccentric family), and `iconography`→graph. The source evidence is recorded per entry in [`gold-v5.ts`](../data/morphology/gold-v5.ts), with citations to the [Online Etymology Dictionary](https://www.etymonline.com/).

Across the expansion, 11 additional production lemmas now have exact Gold mappings: `cessation`, `choreograph`, `conjecture`, `eccentricity`, `iconography`, `interject`, `cosmological`, `jurisprudence`, `regenerate`, `append`, and `synchronize`. The last six were already represented in Gold sources and entered the production catalog through the reviewed batches. The five authored Gold words add four new Gold lexical-family identities and one justified extension to `centr:eccentric`; canonical Gold roots remain 48. Gold words increased from 588 to 593.

| Metric | Recorded baseline | Final |
| --- | ---: | ---: |
| Production lemmas | 9,000 | 9,750 |
| WordNet family IDs | 7,474 | 8,089 |
| Gold dataset | gold-v4 | gold-v5 |
| Persisted exact-derived mappings | 412 at the 9,250-word Gold-v4 snapshot | 422 |
| Persisted `none` morphology records | 8,838 at the 9,250-word snapshot | 9,328 |
| Gold roots / Gold words | 48 / 588 | 48 / 593 |
| Root capacity (raw / family-capped effective) | 412 / 383 | 422 / 391 |

The importer dry-run reported zero errors, verified conflicts, or rejected conflicts. The final 9,750-word apply inserted two newly eligible derived records and created two audit events; the immediate reapply inserted/updated zero records and created zero audit events (all 1,015 persisted records unchanged). Persisted morphology coverage is 422 derived + 593 Gold = 1,015 records, with zero rejected and 9,328 production lemmas still unmapped.

## Daily 30 readiness

Rules remain 14 days × 30, root-first, 2–4 root clusters/day, family diversity, no repeated selected words, no unsupported/`none` morphology, and no fallback. Both strategies remain below the 420/420 authority gate:

| Strategy | Filled | Unique | Complete days | Root clusters/day | Shortfall attribution |
| --- | ---: | ---: | ---: | --- | --- |
| Balanced | 349/420 | 349 | 7 | 2–4 | 23 family-concentration; 48 root-capacity |
| Scarcity-aware | 380/420 | 380 | 10 | 3–4 | 19 family-concentration; 21 root-capacity |

The best result has 0 `none`-confidence selections, 0 duplicate selected lemmas, and at most two words per family per day. The effective per-root capacity sum is 391; the simulator schedules 380 within its daily 2–4-root constraints. Scarcity-aware is **NOT_READY_FOR_PHASE_1B**; the remaining gap is 40 slots (19 family concentration + 21 root capacity). No unsupported morphology or root-count changes were used to close it.

## Verification

- Unit/integration suite: **77 files, 262 tests passed**.
- Local pgTAP: **61/61 passed** across four SQL test files.
- Lint: passed.
- TypeScript: passed (`tsc --noEmit`).
- Production build: passed.
- Vocabulary audit: passed; no broken references, duplicate IDs, invalid frequency, missing source, or malformed master fields. It still reports 149 missing CEFR annotations in the existing sample data.
- Production vocabulary report: **9,750 accepted**, final and target gates passed, 100% required coverage, zero duplicate candidates/review/tier-depth issues.
- Gold-v5 dry-run/apply/reapply and persisted coverage: passed; no remote production system was contacted.
- `git diff --check`: passed.

## Limitations and decision

The new words all fall in the lowest-frequency extension tier; source exam tags keep the expansion useful, but the final 250-word frontier produced only two additional exact Gold mappings. The remaining Daily 30 deficit is structural rather than a lack of raw candidates: family caps account for 19 slots and constrained root capacity for 21. Further low-frequency expansion alone has diminishing returns. Preserve the current constraints and make no automatic Phase 1B transition; any next step that changes the 2–4-root rule or accepts substantially lower-value content needs a separate product decision.

Source datasets used by the existing pipeline: [ECDICT (MIT)](https://github.com/skywind3000/ECDICT) and [Open English WordNet](https://en-word.net/).
