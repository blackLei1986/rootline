#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
node_bin=/Users/leipan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
if [ ! -x "$node_bin" ]; then
  echo "Bundled Node.js runtime is unavailable." >&2
  exit 1
fi
if ! docker inspect supabase_kong_rootline-local >/dev/null 2>&1; then
  echo "The local Supabase gateway container is not running." >&2
  exit 1
fi

read_local_key() {
  docker exec supabase_kong_rootline-local sh -c 'cat /home/kong/kong.yml' | \
    KEY_KIND="$1" "$node_bin" -e '
      const source = require("node:fs").readFileSync(0, "utf8");
      const kind = process.env.KEY_KIND === "service" ? "secret" : "publishable";
      const found = source.match(new RegExp(`headers\\.apikey == '\''(sb_${kind}_[^'\'']+)'\''`));
      if (!found) process.exit(1);
      process.stdout.write(found[1]);
    '
}

export E2E_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_URL="$E2E_SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(read_local_key publishable)"
export SUPABASE_SERVICE_ROLE_KEY="$(read_local_key service)"
export E2E_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
export CRON_SECRET=phase2c-local-test-only
export FEED_FETCH_CONTACT=phase2c-local@example.test
export CLOUD_LEARNING_ENABLED=true
export RSS_READING_ENABLED=true
unset ROOTLINE_E2E_FIXTURES

http_status="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$E2E_SUPABASE_URL/auth/v1/admin/users")"
if [ "$http_status" != 200 ]; then
  echo "Local Supabase admin API refused the local service credential (HTTP $http_status)." >&2
  exit 1
fi

"$node_bin" node_modules/@playwright/test/cli.js test tests/e2e/reading-reinforcement.spec.ts "$@"
