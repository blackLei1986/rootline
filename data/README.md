# Vocabulary data policy

The Stage 1 catalog is static and reviewable. Root meanings and representative derivatives were cross-checked against educational root references and etymology references, including the IES/REL morphology guide, Naomi Finkelstein's Latin roots list, and Etymonline for selected roots such as `tract`.

Data rules:

- `frequency.band` is an editorial learning-priority band, not a corpus rank.
- `frequency.rank`, `frequency.source`, and `cefr` stay undefined until a licensed or otherwise trustworthy dataset is connected.
- Daily study prioritizes high-confidence teaching relations and Core words.
- Medium- or low-confidence relations remain visible to the audit and should not silently become Core examples.
- Related-word IDs and course root IDs must resolve inside the catalog.
- `coverageTags` are shared Master Vocabulary filters, not duplicate exam word lists.
- `examRelevance` is an internal learning-value score and must not be presented as an official probability.
- A missing `rootIds` list is valid when no teachable decomposition adds learning value.
- Generated content must pass `Generate → Validate → Score → Audit → Accept`; AI output never writes directly to the production catalog.

Run `pnpm audit:vocabulary` after every content change.

References:

- https://ies.ed.gov/sites/default/files/migrated/rel/regions/southeast/pdf/REL_2021086.pdf
- https://www.naomifinkelstein.org/latin-roots-prefixes-and-suffixes-to-expand-english-vocabulary/
- https://www.etymonline.com/word/tract
