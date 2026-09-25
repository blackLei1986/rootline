# Morphology Persistence Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task.

**Goal:** Safely persist Gold morphology data and exact derived candidates locally, then report persisted coverage.

**Architecture:** A server-only CLI invokes database-side import/materialization transactions. Static Gold data remains authoritative; reports distinguish persisted facts from dry-run projections.

**Tech Stack:** TypeScript, Zod, Supabase/Postgres, Vitest, pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-21-morphology-foundation-design.md` and Phase 1A-2B request.

## Global Constraints

- Never modify Daily 30, Today, SRS, Reading, user-learning state, production catalog, or legacy word-family data.
- Local database validation only; no remote deployment.
- No heuristic morphology inference: exact normalized Gold lemma matching only.
- Preserve verified records and same-source/version rejections.

### Task 1: Implement idempotent import and CLI

- [ ] Write failing import tests for dry run, apply, re-run, verified precedence, rejected protection, and provenance.
- [ ] Add a server-only importer and CLI with `--dry-run` and `--apply`.
- [ ] Run imports locally, assert 20 Gold roots and 123 derived candidates, then commit.

### Task 2: Add persisted reports

- [ ] Write failing coverage and root-expansion report tests.
- [ ] Implement persisted coverage and planning-only expansion reports.
- [ ] Run both report modes locally, then commit.

### Task 3: Validate and document

- [ ] Run lint, typecheck, tests, build, pgTAP, migration list, advisors, and diff checks.
- [ ] Write the final local-validation report and request a whole-branch review.
