#!/usr/bin/env bash
set -euo pipefail

beta_cli="${BETA_SUPABASE_CLI:?Set BETA_SUPABASE_CLI to verified Supabase CLI 2.118.0}"
beta_workdir="${BETA_SUPABASE_WORKDIR:?Set BETA_SUPABASE_WORKDIR to the disposable Phase 4 project}"
if [[ "$beta_workdir" != /private/tmp/rootline-phase4-stack.* ]]; then
  echo "Refusing a non-disposable Supabase project" >&2
  exit 1
fi
if [[ "$($beta_cli --version)" != "2.118.0" ]]; then
  echo "Supabase CLI 2.118.0 is required" >&2
  exit 1
fi
beta_status="$($beta_cli status --workdir "$beta_workdir" --output json | sed -n '/^{/,$p')"
export E2E_SUPABASE_URL="$(jq -r .API_URL <<< "$beta_status")"
export NEXT_PUBLIC_SUPABASE_URL="$E2E_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(jq -r .PUBLISHABLE_KEY <<< "$beta_status")"
export E2E_SERVICE_ROLE_KEY="$(jq -r .SECRET_KEY <<< "$beta_status")"
export SUPABASE_SERVICE_ROLE_KEY="$E2E_SERVICE_ROLE_KEY"
export CLOUD_LEARNING_ENABLED=true
export BETA_E2E_PORT=3094
export NEXT_PUBLIC_SITE_URL="http://localhost:3094"
export CRON_SECRET="phase4-local-e2e-only-not-for-production"
export FEED_FETCH_CONTACT="beta-local@example.test"
if [[ "$E2E_SUPABASE_URL" != "http://127.0.0.1:56421" || "$E2E_SERVICE_ROLE_KEY" != sb_secret_* ]]; then
  echo "Refusing non-local or unexpected Supabase credentials" >&2
  exit 1
fi
if [[ "$#" -eq 0 ]]; then
  set -- tests/e2e/beta-journey.spec.ts
fi
exec pnpm exec playwright test "$@"
