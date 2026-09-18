# Vocabulary migrations

The production vocabulary uses stable lemma-based IDs. Content edits must preserve these IDs.

When a future release merges, removes, or renames a lemma, add a versioned migration map here. A migration must declare the old ID, the replacement ID (or tombstone), the source vocabulary version, and the destination version so that learner progress can be remapped without loss.

The current production version is `2026.09.production-v1`; no ID migrations are required yet.
