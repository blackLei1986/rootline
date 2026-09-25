# Rootline 2.0 Beta integration evidence

This file records observed Phase 4 gates. It is not a production-deployment record.

## Integration baseline — 2026-09-25

- Branch: `codex/phase-4-beta-integration`, created from validated Phase 3 tip `75265b9`.
- Remote `origin/main` was freshly fetched from GitHub and resolved to `4975593f1347b272fcc0f9249e4d1bb733f07dc1` (`Merge pull request #1 from blackLei1986/codex/phase-1a-1-morphology-audit`). This exact commit is an ancestor of the Phase 4 branch. Ahead/behind at inspection: `0 / 78`; no integration merge or conflict was needed.
- Cumulative milestone commits present after the remote-main merge base: Phase 1B `ac1a8f1`, Phase 2A `a3bdbbf`, Phase 2B `12c456c`, Phase 2C `845b2ad`, Phase 3 `75265b9`. These are provenance landmarks, not a claim that every phase consists of one commit.
- No local user data, production data, or the main checkout's untracked `supabase/.temp/` was changed.

| Baseline command | Observed result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged, 475 packages reused from local store. |
| `pnpm test` | Passed: 119 files, 484 tests. |
| `pnpm lint` | Passed. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm build` | Passed with Next.js 16.3.5 / webpack; `/progress` dynamic, `/today` and `/` currently static. |

The shell initially lacked `node` on `PATH`, so the first `pnpm test` invocation exited before running tests. The passing commands used the bundled Node runtime on `PATH`; this was an environment invocation issue, not a failed test assertion.

## Release-status boundary

This document separates local engineering evidence from a production deployment decision. The reviewed PR, target remote project state, approved Gold import, legal/privacy notices, and authorized production smoke remain separate gates; no remote migration or deployment occurred.

## Clean disposable database — 2026-09-25

- Ran Supabase CLI 2.118.0 from an independently verified official release binary against a new temporary project `rootline-phase4-beta-20260925`, database port 56422. The existing `rootline-local` project at port 54322 was not reset. An initial standalone Postgres container was discarded because it lacked the Supabase-managed system schema; its pgTAP failures were invalid environment evidence.
- The temporary project contained byte-for-byte copies of this branch's 19 migration files and 10 pgTAP files. `pnpm verify:beta-db` checked their hashes, the Docker Compose project/workdir identity, and the marked local database URL before issuing a local-project reset and test.
- Observed: all 19 migrations applied from a clean database; all 10 pgTAP files and 162 assertions passed, including RLS, Today, Reading, morphology, and Progress suites.
- CLI 2.118.0 returned `DbResetCancelledError` for the explicit `--db-url` form on both a bare container and the managed stack. Its local-project mode completed the same clean replay. The runner uses the latter only after matching the separate project ID, workdir, port, container, and source-file hashes.
- Supabase CLI published this temporary project's Docker DB port on `0.0.0.0`, despite the client using `127.0.0.1`. This is an exposure risk for a shared network and must be accounted for in the runbook; the project is disposable and contains no real user data. A loopback-only host firewall or isolated machine is preferable for future verification.

## Authenticated integrated journey — 2026-09-26

- Used only the disposable local Auth/API stack (`127.0.0.1:56421`) and an isolated Next dev port (3094). No `ROOTLINE_E2E_FIXTURES=1` route mocks, remote service key, production account, or migration change was used.
- `bash scripts/run-beta-local-e2e.sh` passed. A newly created verified account completed a frozen 30-target plan with partial work, reload/Continue, three Mini Reviews, Final Review, same-day lock, and no second plan after refresh. A second tab's stale write now receives a safe 409 and reloads the authoritative state.
- A local published Gold root and three curated articles were inserted as disposable runtime fixtures. The learner opened a word sheet, completed Daily-3 reading and recognition/cloze/recall reinforcement, refreshed the completed session, and confirmed Today remained 30/30. A second account had its own Today plan, no first-account Reading recommendation or Progress completion, and received a sanitized 404 for the first account's Today session.
- The first account used `Pacific/Kiritimati`; Today, the frozen Daily-3 set, and Progress were checked against its profile-local date across the UTC date boundary. Separate unit tests cover New York DST transition.
- At 390/430/768/1440 px, the journey checked Today long-answer input and submit control, Reading word dialog and exercises, and Today, Reading, article, Progress, Roots directory/detail, and Me pages for headings, horizontal overflow, clipped interactive controls, and mobile-navigation/footer overlap. This found and fixed the mobile nav being fixed to the sticky header rather than the viewport.
- The prior authenticated Phase 2C Reading browser spec passed independently (1/1), and the prior Phase 3 Progress browser spec passed independently (1/1) after adding a disposable approved morphology fixture. An initial combined run failed on a two-tab browser-state timing issue and missing Gold fixture; the tests were made deterministic and each relevant suite then passed separately. No unresolved product assertion from that combined attempt remains, but a later final combined gate is still required.
- After the passing isolated runs, fixture counts were checked: 0 matching Beta/Phase 2C/Phase 3 test users, 0 `example.test` articles, and 0 local-e2e morphology datasets.

## Environment and near-10K-state audit — 2026-09-26

- `lib/config/env.ts` separates public Supabase URL/publishable key from server-only service role, cron secret, and feed contact. Source search found the service-role key read only in server/admin or CLI code and cron secret used by the server cron route. The optimized `.next/static` browser bundle had no `SUPABASE_SERVICE_ROLE_KEY` or `CRON_SECRET` references (`rg -l` returned no matches). This is a reference audit, not a proof about every future deployment value.
- Found and fixed a production-misconfiguration risk: `ROOTLINE_E2E_FIXTURES=1` previously enabled unauthenticated Today fixture routes even under `NODE_ENV=production`. A focused test now asserts production disables this path, and the app routes use the guard.
- A disposable verified user with 9,750 `word_learning_states` measured these single local Next-dev responses; all HTTP statuses were 200:

| Request | Elapsed | Response bytes |
| --- | ---: | ---: |
| Today initial `/api/today` | 989 ms | 17,463 |
| Today resume `/api/today` | 68 ms | 17,463 |
| Reading list `/api/reading/recommendations` | 685 ms | 880 |
| Article `/reading/daily/[id]` | 2,197 ms | 38,938 |
| Progress `/progress` | 2,954 ms | 44,763 |

These are one cold/warm local-dev observations, not production p95, user-perceived paint time, or a release SLO. Article and Progress times merit production observation, but this sample does not justify a caching rewrite. The benchmark user, 9,750 states, and article were deleted; subsequent fixture counts were 0 users, 0 articles, 0 word states, and 0 local Gold datasets.

## Final local gates — 2026-09-26

| Gate | Observed result |
| --- | --- |
| Clean disposable migration replay | 19/19 applied in order, no manual intermediate state. |
| Complete pgTAP | 10 files, 162 assertions, PASS. |
| Full Vitest | 133 files, 522 tests, PASS. |
| Focused final product audit | 4/4 tests, PASS. |
| Authenticated browser acceptance | Integrated journey, near-10K benchmark, Phase 3 Progress, and Phase 2C Reading combined serially: 4/4 PASS. |
| Responsive | 390/430/768/1440 px checks on primary routes, root detail, Today long answer, Reading word sheet/exercises; PASS. |
| Isolation and fixture cleanup | Cross-account Today returned 404 without data; no first-account Reading/Progress state; fixture users/articles/states/Gold rows all 0 after run. |
| Lint, TypeScript, production build | PASS after the production-fixture guard typing correction; webpack build generated 195 static pages. |
| Browser bundle audit | No service-role, cron, local secret-key, or fixture-switch references in `.next/static` JS. |
| Whitespace gate | `git diff --check` PASS. |

The single benchmark sample varied on a warm combined run (Today initial 227 ms, resume 79 ms; Reading list 1,210 ms; article 551 ms; Progress 1,758 ms). This variation reinforces that the measurements are not p95 or a production performance claim.

Local engineering acceptance is green. **External Beta deployment is NOT READY / not authorized**: no target production backup/migration-ledger verification, production smoke approval, reviewed Gold content import, or applicable legal/privacy notice decision was supplied. The release runbook keeps these gates explicit. No production data was touched.
