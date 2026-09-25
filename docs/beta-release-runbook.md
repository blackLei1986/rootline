# Rootline 2.0 Beta release runbook

This is an approval-ready procedure, not authorization to touch production. Phase 4 produces a reviewable PR and local evidence; it does not merge, apply remote migrations, deploy, or create a production test account.

## Release inputs and gates

Before scheduling a Beta cutover, name the owner, target Supabase project ID, target Vercel project/environment, exact Git commit, maintenance window, backup/restore owner, smoke-test account, and rollback deployment. Confirm the current remote migration ledger and database state against the 19 repository migrations; resolve any drift before a push. A clean local replay (`pnpm verify:beta-db`) and 10-file/162-assertion pgTAP pass are evidence for the code, not evidence that a specific remote project is safe to migrate. Supabase recommends migration-file-based changes and warns that direct remote schema edits can desynchronize history ([database migrations](https://supabase.com/docs/guides/deployment/database-migrations)).

Required configuration:

| Variable | Boundary | Use |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public/browser-safe | Exact target Supabase API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public/browser-safe | Target publishable key; never substitute a service-role key. |
| `NEXT_PUBLIC_SITE_URL` | Public/browser-safe | Exact canonical app origin used for auth callbacks. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Trusted server data access; never prefix with `NEXT_PUBLIC_` or expose in HTML. |
| `CRON_SECRET` | Server-only secret | Authorize feed cron requests. |
| `FEED_FETCH_CONTACT` | Server-only configuration | Contact identity for feed fetches. |
| `CLOUD_LEARNING_ENABLED` | Server-only flag | Keep `false` until the authorized schema/RLS gate is green; set `true` for the cutover. |
| `RSS_READING_ENABLED` | Server-only optional flag | Leave `false` unless the existing feed ingestion path is intentionally enabled. Daily-3 does not require custom RSS management. |

`ROOTLINE_E2E_FIXTURES` is acceptance-only and must be absent in every deployed environment. The production build now hard-disables that route even if the variable is misconfigured. `E2E_*`, `BETA_*`, temporary local keys, and test-only contact/cron values are never production configuration. Auth confirmation and allowed callback URL must match the deployed origin. Rotate any key accidentally printed in logs or stored in a client bundle; `.next/static` must not contain service-role or cron variable references.

## Local verification before the release decision

Use a separate Supabase project ID and ports; never run reset against `rootline-local`, a linked project, or a remote URL. The Task 7 runner requires a marked loopback DB URL, exact Docker/CLI project identity, temporary workdir, and byte-matching copies of this branch's migration and pgTAP files. CLI 2.118.0 used here needs its local-project reset mode; its explicit `--db-url` reset returned `DbResetCancelledError`. Use the disposable project setup described in `docs/beta-integration-evidence.md` and set the following variables in your own shell, without committing values:

```bash
export BETA_SUPABASE_CLI=/absolute/path/to/verified/supabase-2.118.0
export BETA_SUPABASE_WORKDIR=/private/tmp/rootline-phase4-stack.XXXXXX
export BETA_DISPOSABLE_CONTAINER=supabase_db_rootline-phase4-beta-IDENTIFIER
export BETA_DISPOSABLE_DB_URL='postgresql://postgres:postgres@127.0.0.1:56XXX/postgres?sslmode=disable&beta_disposable=1'
pnpm verify:beta-db
bash scripts/run-beta-local-e2e.sh
bash scripts/run-beta-local-e2e.sh tests/e2e/reading-reinforcement.spec.ts
bash scripts/run-beta-local-e2e.sh tests/e2e/progress-2-0.spec.ts
bash scripts/run-beta-local-e2e.sh tests/e2e/beta-performance.spec.ts
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

For local Docker, the CLI published the disposable DB port on `0.0.0.0`, not just loopback. Use an isolated host/network or firewall and stop the disposable stack after verification. Do not put personal or production data in it. The benchmark is one local dev-mode sample with 9,750 state rows, not a production p95 or an SLO.

## Approved migration-first cutover

1. Confirm a restorable backup or PITR point, current schema/migration ledger, RLS/grants, and the exact target project. Confirm no concurrent migration operator. Stop if the target identity or ledger differs from the approved record. Supabase's [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) includes RLS and backup review.
2. With separately authorized production credentials, apply only reviewed additive migrations in timestamp order through the documented Supabase migration workflow. Do not use `db reset`, `--include-seed`, local fixture SQL, or a blanket dump restore on production. Record versions and outputs.
3. Verify table/index/function presence, RLS enabled and grants/RPC permissions with read-only checks; inspect errors and connection health. Do not execute pgTAP fixtures against real learner data without a separately approved, isolation-safe plan.
4. Build and stage the reviewed app commit with the production variables above. Confirm preview smoke and auth callback. Only after the database gate passes, enable cloud learning and promote the application deployment. Vercel promotion and rollback are deployment-level operations, not database reversions ([deployment promotion](https://vercel.com/docs/deployments/promoting-a-deployment)).
5. With an explicitly approved Beta test account, perform the minimum production-safe read/login/Today/Reading/Progress smoke. Do not silently consume a real learner's 30 or generate fixture articles. Observe server errors, auth failures, RLS denials, Today conflicts, Reading answer conflicts, latency, and unexpected reset/replay activity during the agreed window.

If an app regression occurs, route traffic back to the known-good Vercel deployment and keep the additive schema in place. An instant rollback does not rebuild or revert environment variables ([Vercel rollback behavior](https://vercel.com/docs/instant-rollback)). Never auto-drop schema or reverse migrations in production. If the schema itself is defective, stop writes if necessary, preserve backups/logs, design a reviewed forward repair, and authorize any restore separately with a data-loss analysis.

## Beta scope, notices, and release notes

Phase 4 keeps Today as the default 30-word loop, makes Roots/Reading/Progress/Me the primary navigation, tightens loading/empty/error/offline/conflict behavior, fixes mobile bottom navigation, and verifies migration and authenticated composition. No AI tutor, social feature, leaderboard, custom RSS UI, new exercise family, or large vocabulary expansion is included.

Legal/privacy notices and the intended Beta audience/region have not been supplied in this task. Code tests do not establish legal compliance. Product/legal owners must review the applicable privacy notice, terms, data-retention/deletion process, and consent flows before any external Beta invitation. Published Gold morphology content also needs an approved import into the target environment; a clean migration-only database has no trusted-root content, and the local browser fixture is not a production seed.
