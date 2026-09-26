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
- `bash scripts/run-beta-local-e2e.sh` passed. A newly created verified account completed a frozen 30-target plan with partial work, reload/Continue, three Mini Reviews, Final Review, same-day lock, and no second plan after refresh. The final regression also chose a wrong answer in both Mini and Final Review without stranding completion. A second tab's stale write receives a safe 409 and reloads the authoritative state.
- A local published Gold root and three curated articles were inserted as disposable runtime fixtures. The learner opened a word sheet, completed Daily-3 reading and recognition/cloze/recall reinforcement, refreshed the completed session, and confirmed Today remained 30/30. A second account had its own Today plan, no first-account Reading recommendation or Progress completion, and received a sanitized 404 for the first account's Today session.
- The first account used `Pacific/Kiritimati`; at the actual run time, Today, the frozen Daily-3 set, and Progress were checked against its profile-local date. This is not a deterministic same-instant UTC-midnight or DST integration test. Separate unit tests cover New York DST transitions; a controlled-clock cross-service test remains open.
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
| Full Vitest | Final post-review run: 134 files, 535 tests, PASS. |
| Focused final product audit | 4/4 tests, PASS. |
| Authenticated browser acceptance | Final post-review: integrated journey with wrong Mini/Final answers, near-10K benchmark, and Reading-Today: 3/3 PASS; prior Phase 3 Progress and Phase 2C Reading reinforcement: 2/2 PASS. Earlier pre-review combined run: 4/4 PASS. |
| Responsive | 390/430/768/1440 px checks on primary routes, root detail, Today long answer, Reading word sheet/exercises; PASS. |
| Isolation and fixture cleanup | Cross-account Today returned 404 without data; no first-account Reading/Progress state; fixture users/articles/states/Gold rows all 0 after run. |
| Lint, TypeScript, production build | PASS after the production-fixture guard typing correction; webpack build generated 195 static pages. |
| Browser bundle audit | No service-role, cron, local secret-key, or fixture-switch references in `.next/static` JS. |
| Whitespace gate | `git diff --check` PASS. |

The single benchmark sample varied on a warm combined run (Today initial 227 ms, resume 79 ms; Reading list 1,210 ms; article 551 ms; Progress 1,758 ms). This variation reinforces that the measurements are not p95 or a production performance claim.

## Independent branch review and resolution — 2026-09-26

- Read-only review of `4975593..7a22963` found no Critical issues and three Important gaps. The post-review change makes persisted `false` review answers count as answered; retains new/replaced offline operations through in-flight flushes and serializes flushes using browser Web Locks where available; and journals Today learning operations until the server confirms their exact operation ID. Accepted recognition/review/activity credit is applied with a local persisted operation marker, so lost responses, refresh, and same-ID retries do not double-credit SRS or wrong-answer evidence. An unresolved result remains visibly blocked instead of being inferred from a newer session revision.
- Targeted review regressions cover wrong Mini/Final answers and refresh, enqueue/replacement/conflict during flush, simultaneous flush, accepted lost-response review credit, delayed operation-status race, reload recovery, and cross-account operation status. Final browser journey exercised wrong Mini and Final answers. A minor deterministic cross-service UTC-midnight/DST integration test remains deferred; the timezone claim above is narrowed accordingly.
- Post-review fixture audit returned `users=0,articles=0,states=0,gold=0`. The disposable Supabase project was stopped afterward; the existing `rootline-local` project remained untouched. No post-review SQL migration changed, so the clean 19-migration/162-assertion replay above remains the database gate.

Local engineering acceptance is green. **External Beta deployment is NOT READY / not authorized**: no target production backup/migration-ledger verification, production smoke approval, reviewed Gold content import, or applicable legal/privacy notice decision was supplied. The release runbook keeps these gates explicit. No production data was touched.

## Phase 5 instrumentation — 2026-09-26

This section records implementation evidence only. It does not claim any real-use learning day or Beta outcome.

- Implemented on isolated branch `codex/phase-5-real-use-beta`, based on local Phase 4 head `9263f4b`. Telemetry is opt-in and stays in browser `localStorage`; account ID is used only as a namespace key and omitted from export. No database migration, telemetry API, analytics vendor, or production learner data was added or touched.
- The Today API carries a transient `planCreated` response flag (not in the frozen stored plan). Today aggregates plan creation/observation, server-confirmed start/completion/review answers, source counts, active visible timing, recoverable errors and 409 recovery. Mini and Final outcomes remain distinct. The new-day/old-account browser namespace is isolated.
- Reading and Progress are counted only as allowlisted route categories. Reading reinforcement completion is recorded only when a confirmed answer changes the session to complete. Article identifiers, URLs, titles, content, word IDs, answer text, account ID, and email are excluded from Beta storage/export. Journal text is capped and sanitizes URL/email/obvious tagged IDs.
- Me includes explicit participation, JSON export, and account-specific deletion controls. The end-of-Today feedback is optional; skip does not call Today APIs or change completion state.
- Route timings are client-side effect-to-next-frame samples, not server/load/LCP/p95 measurements. Exact word-level next-day/delayed retention cannot be linked without retaining cross-day identifiers; report only exploratory source/review aggregates and qualitative observations.
- Real-use state: **pending**. No dates are populated in the protocol table. Automated tests, E2E fixtures, and developer actions are not evidence of learner days. Seven normal learning dates, export review, the 26-item final report, and a verdict remain outstanding. Fourteen days require a separate human decision after the seven-day review.
- The known controlled-clock cross-service midnight/DST integration test remains deferred. Today uses its account learning date; Reading/Progress route counts use browser-local dates, and any timezone mismatch must be annotated.
- This worktree is not deployed or pushed. No public release or production access is authorized by this instrumentation work.
- Final Phase 5 engineering gates on the isolated branch: Vitest 138 files / 555 tests PASS; ESLint PASS; TypeScript PASS; Next.js 16.3.5 webpack production build PASS, with `/today` dynamic at request time. `git diff --check` PASS.
- Browser bundle audit: no `SUPABASE_SERVICE_ROLE_KEY`, `E2E_SERVICE_ROLE_KEY`, `CRON_SECRET`, or `PRIVATE_KEY` references in `.next/static`. Source audit found no `fetch`, `sendBeacon`, or `XMLHttpRequest` in the Beta logger/store/UI modules. Storage parsing reconstructs an allowlisted schema; regression coverage confirms unknown email/article fields are excluded from exports.
- Authenticated local Playwright journey was **not run**. The safe runner requires `BETA_SUPABASE_CLI` and `BETA_SUPABASE_WORKDIR`, both unset; Docker API access returned permission denied. No browser fixtures were created, so no fixture cleanup was needed. This is an environment gate, not a pass.
- Per the original Phase 5 final report, there are 26 report items (not 28). All 26 and the eight product questions are reserved for the seven-day evidence review; no verdict or Release Candidate recommendation is assigned yet.
