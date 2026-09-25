# Progress 2.0 metric definitions

This dashboard is an account-scoped view for a verified learner. It is not a historical reconstruction of all vocabulary knowledge.

## Today and consistency

- A Today learning date comes from `today_plans.learning_date` in the learner's profile timezone, not from the UTC completion timestamp. When multiple versions exist, the highest `generation_version` is authoritative.
- A day is complete only when that plan and its matching session are both `complete` and the plan has `completed_at`. Partial target progress, Reading, and generic activity do not complete a day.
- The Today numerator is the number of frozen target IDs completed in the matching session; the denominator is the distinct target count in that frozen plan. When it is below 30, the actual denominator and saved shortage reason appear. With no plan, no `0/30` plan is invented.
- Seven-day completion is completed eligible local dates / eligible local dates in the inclusive seven-date window. Thirty-day completion uses the analogous 30-date window. Eligibility begins at the first persisted Today plan and includes subsequent dates without a plan; today counts even while unfinished. With no eligible dates, the percentage is unavailable, not zero. Percentages round to the nearest integer.
- Streak counts consecutive completed Today dates ending today, or ending yesterday while today is unfinished. It stops at the first eligible missed date.

## Vocabulary and roots

- Counts use distinct IDs in the production vocabulary catalog. A word occupies one state only: stable, else learning, else touched. Passive Reading and recognition-only evidence can mark touched but cannot by themselves mark stable. Passive IDs are paged in a deterministic order and include both learning/Reading events and saved article encounters.
- All of an account's word states and their database observation timestamp are read in one service-role-only SQL statement. This avoids mixing old and new word states across separately paged HTTP requests; the aggregate stays on the server and is never serialized to the browser.
- Stable uses the shared `calculateWordMastery` predicate: a delayed review at least 24 hours after first learning, at least two correct or verification successes, memory strength at least 55, latest rating not `again`, and no review more than 14 days overdue. Learning is a non-stable word with active learning or review evidence; touched is passive or recognition evidence without active learning.
- The 10K measure is current stable catalog words / **10,000**, rounded to one decimal and capped at 100%. The current catalog size is not the denominator. A very small nonzero stable count may display `0.0%`; the integer numerator remains visible.
- Root links come only from the latest published Gold dataset's approved, verified morphology records and root segments. A catalog word counts once per root, but may contribute to multiple roots. Root mastery is stable linked words / usable linked catalog words; learned includes learning and stable. Root counts are not added to derive global vocabulary.

## Growth and Reading

- Opening Progress as a verified learner observes and upserts the current stable count for that learner's local date. There is one snapshot per user/date; a later observation on the same date replaces the prior count. Observation time is recorded when the word-state read completes, and the database rejects an older observation that finishes writing after a newer one.
- The growth display uses only actual recorded dates in the recent 30-day window. It does not backfill pre-Phase-3 history or interpolate days without visits. Its first-date label refers to that window, not all-time history. Fewer than two points are described in text, not drawn as a trend. A stable count can decrease after an incorrect answer or substantial overdue time.
- Reading's optional number counts completed vocabulary-reinforcement sessions for articles dated within the recent seven local learning dates. It is separate from Today completion and the streak. If this bounded source fails, the card is omitted rather than presented as zero.
- Estimated vocabulary size is deferred. The current catalog and individual learning records do not support a calibrated estimate or confidence interval for unseen words.

Authoritative source failure makes Progress unavailable rather than manufacturing zero values. Snapshot capture failure degrades only the growth section. The dashboard does not use browser-local Progress counters or send raw word states, review events, or answer keys to the browser.
