# Phase 1A-2B Morphology Foundation Validation Report

Validated on 2026-09-22 against a clean local Supabase database. This report covers only Phase 1A-2B; no Phase 1B or product UI scope was added.

## 1. Schema / migration

- The morphology schema stores versioned datasets, roots, families, word records, ordered segments, provenance, review state, and append-only audit events.
- `20260922031145_morphology_atomic_import.sql` adds the complete import fields, foreign-key indexes, append-only audit enforcement, and the atomic `apply_morphology_import(jsonb, text)` RPC.
- The RPC is `security invoker`, has an empty `search_path`, and is executable only by `service_role`.
- A clean `supabase db reset --local` applied all nine local migrations successfully. `supabase db lint` reported no schema errors.

## 2. Gold roots imported

- 20 Gold roots were persisted for `gold-v1`.
- The second identical import reported all 20 unchanged.

## 3. Gold words imported

- 150 curated Gold words were persisted as durable word records, distinct from the 123 production-derived records.
- Each Gold record retains lemma identity, word, morphology expression, literal meaning, explanation, dataset version, source, provenance, family, primary root, and review status.
- Gold records use stable `gold:<wordId>` catalog IDs, making their dataset origin unambiguous without colliding with production vocabulary IDs.

## 4. Segments imported

- 329 structured segments were persisted.
- Prefix, root, and suffix segments retain surface form, normalized form, kind, meaning, position, root relation, explanation, and provenance.
- Segment reconstruction is ordered by the stored integer position, not by string concatenation.

## 5. Relations imported

- 545 morphology relations were persisted across word-to-family, word-to-primary-root, and segment-to-root links.
- 150 Gold families were persisted; the second import reported all families, segments, and relations unchanged.

## 6. Derived candidates persisted

- All 123 Phase 1A-1 exact-lemma candidates were persisted with `confidence = derived`, `source = gold-dataset-exact-lemma`, and `morphology_score = 100`.
- Their provenance includes source lemma, dataset version, and matching rule.
- No candidate was promoted to `verified`, and the production vocabulary catalog, including production `wordFamilyId`, was not modified.

## 7. Verified / derived / none / rejected counts

For the 9,000-word production vocabulary after local import:

- verified: 0
- derived: 123
- none: 8,877
- rejected: 0

The separate Gold layer contains 20 roots and 150 Gold words.

## 8. Atomic transaction implementation

- The CLI builds one immutable import plan, uses it for both dry-run and apply, and sends that complete plan to one PostgreSQL RPC call.
- Dataset, roots, families, Gold records, derived records, segments, and audit events execute in one database transaction.
- Any exception aborts the RPC and rolls back the whole logical import; the client does not simulate atomicity with sequential upserts.

## 9. Audit event implementation

- Audit events cover Gold import, derived creation, approve, edit, reject, re-import/version change, and reopen-compatible state transitions.
- Events retain entity ID, word ID, action, previous/result snapshots, source, dataset version, actor/reviewer, timestamp, reason, metadata, and a stable idempotency key.
- A database trigger rejects audit `UPDATE` and `DELETE`; history is append-only.
- The first import created 274 events (one dataset event plus 150 Gold and 123 derived events); the second identical import created zero.

## 10. Reviewer protection

- A verified record is never downgraded by a derived import.
- A rejected record is not recreated by the same source and dataset version.
- Dataset-version changes produce a version-change event; new source/version or an explicit reopen can make a candidate eligible again.
- These cases are covered by both service tests and live pgTAP database tests.

## 11. Dry-run output

The clean-database dry-run made no mutation and reported:

| Entity | Insert | Update | Unchanged |
| --- | ---: | ---: | ---: |
| Gold roots | 20 | 0 | 0 |
| Families | 150 | 0 | 0 |
| Gold words | 150 | 0 | 0 |
| Segments | 329 | 0 | 0 |
| Relations | 545 | 0 | 0 |
| Derived candidates | 123 | 0 | 0 |
| Audit events | 274 create | — | 0 |

Verified conflicts: 0; rejected conflicts: 0; errors: 0.

## 12. First apply output

- records inserted: 273
- records updated: 0
- records unchanged: 0
- verified/rejected skips: 0/0
- audit events created: 274

The apply output used the same counts and plan produced by the dry-run path.

## 13. Second apply idempotency output

- records inserted: 0
- records updated: 0
- records unchanged: 273
- audit events created: 0
- unchanged roots/families/Gold words/segments/relations/derived/events: 20/150/150/329/545/123/274

No duplicate durable rows or false change events were produced.

## 14. Rollback test

The live database transaction test injects an invalid segment reference into a complete import plan. The RPC raises an error and the test verifies that the dataset, roots, records, segments, and audit events from that import are all absent afterward.

## 15. Persisted coverage report

The report reads the persisted morphology tables rather than dry-run candidates:

- total vocabulary: 9,000
- Gold roots: 20
- Gold words: 150
- persisted verified/derived/none/rejected: 0/123/8,877/0
- morphology coverage: 1.37%
- roots with at least 5 usable words: 17
- roots with at least 10 usable words: 1
- provenance distribution: `gold-dataset` 150; `gold-dataset-exact-lemma` 123
- dataset distribution: `gold-v1` 273

Per-root usable word and family counts are reconstructed from persisted foreign keys and ordered segments. `spect` has 10; `port` 9; `fer`, `mit`, `pos`, `press`, `ten`, `tract`, and `vis` 7; `duc`, `fac`, `form`, `ject`, and `rupt` 6; `cap`, `mov`, and `scrib` 5; `struct` 4; `cred` and `dict` 3.

## 16. Root expansion readiness report

- status: `insufficient-evidence`
- evidence rule: `exact-configured-lexical-cue`
- minimum evidence words per root: 2
- minimum ready candidates: 20
- qualifying candidates: 17

The report uses real production frequency, tags, and learning-value metadata plus explicit lexical cues. It does not infer roots by substring. Because only 17 candidates satisfy the evidence rule, it truthfully declines to claim a 20–30-root expansion list.

## 17. Tests

- Vitest: 73 files, 233 tests passed.
- Local pgTAP: 4 files, 51 tests passed.
- Coverage includes Gold roots/words, ordered segments, relations, derived/provenance/audit persistence, dry-run zero mutation, apply, second-apply idempotency, verified/rejected protection, dataset-version change, audit deduplication, and transaction rollback.

## 18. Lint

`pnpm lint` passed with no warnings or errors.

## 19. TypeScript

`pnpm typecheck` passed.

## 20. Production build

`pnpm build` passed with Next.js 16.3.5 and generated all 214 static pages.

## 21. Local vs remote database status

- Local Supabase: reset from scratch, migrated, pgTAP-tested, imported twice, and queried for both persisted reports.
- Remote Supabase: not modified or deployed by this phase validation.

## 22. Remaining known limitations

- Root expansion has only 17 evidence-qualified candidates, below the 20-candidate readiness threshold; this does not block the Phase 1A-2B persistence Definition of Done.
- Supabase advisors still report pre-existing `auth_rls_initplan` performance warnings on learning-progress tables outside this phase. No morphology schema lint error or morphology foreign-key-index warning remains.
- Deployment to a remote database remains a separate, explicitly authorized release step.
