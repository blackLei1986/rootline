# RSS Reading operations

This pipeline exists to select learning material, not to reproduce a general-purpose feed reader. It should expose one to three suitable candidates and preserve publisher attribution plus an original-article link.

## Runtime configuration

Set `RSS_READING_ENABLED=true`, a long random `CRON_SECRET`, and a monitored contact address in `FEED_FETCH_CONTACT`. Outbound requests identify themselves as `RootlineVocabularyReader/1.0` with that contact. Never pass browser cookies, authorization headers, or other incoming credentials to a feed or article host.

## Manual local refresh

Start the application with the account and RSS environment variables configured, then invoke the bounded task endpoint:

```text
curl -H "Authorization: Bearer <local-cron-secret>" http://localhost:3000/api/cron/feeds
```

Each invocation considers at most 10 sources and 10 pending articles. The response contains counts only. It must not contain fetched bodies, tokens, secrets, or user data.

## Scheduler

Configure the deployment scheduler to call `/api/cron/feeds` with the exact Bearer secret. Use a modest interval; conditional requests send ETag and Last-Modified, and a 304 response creates no duplicate articles. Rotate the secret if it appears in logs or support material.

## Network and content limits

- Every initial URL and redirect is DNS-resolved and checked against loopback, private, reserved, link-local, multicast, documentation, and cloud-metadata address ranges.
- At most three redirects are followed.
- Feed responses are limited to 2 MiB after decompression.
- Article HTML is limited to 5 MiB after decompression.
- Requests time out after 15 seconds.
- OPML imports retain at most 200 unique HTTPS/HTTP sources and apply the same public-network policy.
- The system does not bypass logins, paywalls, robots controls, or publisher access restrictions.

## Retry and failure recovery

Feed failures store only a categorized error code and a retry time. Do not store raw response bodies in error logs. A failed source remains isolated from other sources; correct or remove its URL in source management, then trigger another bounded refresh.

If extraction rejects an article, inspect the category (`UNREADABLE`, `TOO_SHORT`, unsupported type, network policy, or size limit). Do not weaken network policy to recover one publisher. Prefer a different public feed or keep the item rejected.

## Logs and monitoring

Safe log fields are source ID, article ID, task status, duration, HTTP status, categorized error code, fetched/inserted/duplicate counts, and analysis version. Never log extracted article text, feed bodies, email addresses, authorization headers, service-role keys, or cron secrets.

## Release gates

Run the production vocabulary report, RSS audit, full test suite, lint, type check, production build, and the Supabase RLS tests. The authoritative content metric is `accepted lemma count`; it must equal 9,000 in the generated Reading index.
