import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type AuditCheck = { file: string; pattern?: RegExp; label: string };

const checks: AuditCheck[] = [
  { file: "lib/feeds/network-policy.ts", pattern: /0xa9fe0000/, label: "cloud metadata address blocking" },
  { file: "lib/feeds/network-policy.ts", pattern: /fc00::/, label: "private IPv6 blocking" },
  { file: "lib/feeds/network-policy.ts", pattern: /dns\/promises/, label: "DNS resolution policy" },
  { file: "lib/feeds/safe-fetch.ts", pattern: /feedBytes:\s*2 \* 1024 \* 1024/, label: "2 MiB feed limit" },
  { file: "lib/feeds/safe-fetch.ts", pattern: /articleBytes:\s*5 \* 1024 \* 1024/, label: "5 MiB article limit" },
  { file: "lib/feeds/safe-fetch.ts", pattern: /redirects:\s*3/, label: "three redirect limit" },
  { file: "lib/feeds/safe-fetch.ts", pattern: /redirect:\s*"manual"/, label: "manual redirect validation" },
  { file: "tests/feed-network-policy.test.ts", pattern: /127\.0\.0\.1/, label: "blocked address tests" },
  { file: "tests/safe-feed-fetch.test.ts", pattern: /redirect pivot/, label: "redirect-pivot test" },
  { file: "supabase/migrations/202609170002_rss_reading.sql", pattern: /create table public\.feed_sources/, label: "feed schema" },
  { file: "supabase/migrations/202609170002_rss_reading.sql", pattern: /create table public\.user_article_scores/, label: "private article scoring schema" },
  { file: "supabase/migrations/202609170002_rss_reading.sql", pattern: /security_invoker\s*=\s*true/, label: "invoker-security article view" },
  { file: "app/api/cron/feeds/route.ts", pattern: /authorizeCronRequest/, label: "protected cron route" },
  { file: "lib/jobs/feed-refresh.ts", pattern: /etag:\s*source\.etag/, label: "conditional feed requests" },
  { file: "lib/feeds/opml.ts", pattern: /FEED_LIMITS\.opmlSources/, label: "bounded OPML import" },
  { file: "lib/reading/analyze-production.ts", pattern: /getProductionReadingIndex/, label: "production analysis index" },
  { file: "app/reading/page.tsx", pattern: /ForYou/, label: "Reading candidate hub" },
  { file: "components/reading/for-you.tsx", pattern: /slice\(0, 3\)/, label: "one-to-three candidate UI limit" },
  { file: "tests/reading-candidate-view.test.tsx", pattern: /toHaveLength\(3\)/, label: "candidate limit test" },
  { file: "docs/rss-reading-operations.md", pattern: /RootlineVocabularyReader/, label: "RSS operations guide" }
];

export function runRssReadingAudit(root: string) {
  const missing: string[] = [];
  for (const check of checks) {
    const path = resolve(root, check.file);
    if (!existsSync(path)) {
      missing.push(`${check.label}: missing ${check.file}`);
      continue;
    }
    if (check.pattern && !check.pattern.test(readFileSync(path, "utf8"))) {
      missing.push(`${check.label}: expected content not found in ${check.file}`);
    }
  }
  const indexPath = resolve(root, "data", "vocabulary", "reading-index.json");
  let acceptedLemmaCount = 0;
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as { acceptedLemmaCount?: number; entries?: unknown[] };
    acceptedLemmaCount = index.acceptedLemmaCount ?? 0;
    if (acceptedLemmaCount !== 9_000 || index.entries?.length !== 9_000) {
      missing.push("production Reading index: accepted lemma count must be exactly 9000");
    }
  } else {
    missing.push("production Reading index: missing data/vocabulary/reading-index.json");
  }
  return { checks: checks.length + 1, missing, acceptedLemmaCount };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runRssReadingAudit(process.cwd());
  if (result.missing.length) {
    console.error(`RSS Reading audit failed (${result.missing.length}/${result.checks}):`);
    result.missing.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
  } else {
    console.log(`RSS Reading audit passed: ${result.checks} checks; accepted lemma count ${result.acceptedLemmaCount}.`);
  }
}
