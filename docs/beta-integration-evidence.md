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

## Phase 4 gates still to observe

- Product changes and their RED→GREEN tests.
- Clean disposable-database migration replay and complete pgTAP suite.
- Integrated authenticated browser journey, responsive widths, conflict/offline, timezone, and two-user isolation.
- Final full tests, lint, TypeScript, build, product audit, release runbook, review, and integration PR.

Beta readiness remains **undetermined** until those gates have observed results.
