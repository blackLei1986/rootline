# Phase 7: production vocabulary and product convergence

## Acceptance result

Rootline's production catalog contains 9,000 unique accepted lemmas. The acceptance gate is recalculated from the deployed detail shards rather than trusting the number of JSON records or a manifest field.

- 9,000 accepted lemmas
- 23,419 unique surface forms
- 7,474 derivational word families
- Tier 1: 2,200
- Tier 2: 2,800
- Tier 3: 3,000
- Tier 4: 1,000
- Core meaning, example, source, and tier assignment coverage: 100%
- Duplicate critical errors and broken references: 0

Every accepted production entry has a lemma, part of speech, Chinese core meaning, corpus frequency band/rank, learning-value score, tier, at least one example, and source metadata. Tier 1 entries have at least three examples and Tier 2 entries have at least two. Morphology remains optional and is only shown when the confidence is useful.

Word families are merged conservatively from Open English WordNet derivational relations. Inflections stay within one lemma via ECDICT exchange forms; related derivations such as `analyze`, `analysis`, and `analytical` share a family without being collapsed into one lemma.

The authoritative command is `npm run vocab:production-report`. It reads all deployed letter shards, deduplicates by normalized lemma, checks the minimum fields, and fails when the accepted count, duplicate gate, or tier-depth gate fails.

## Sources and attribution

The imported catalog combines:

- [ECDICT](https://github.com/skywind3000/ECDICT), MIT license: Chinese translations, pronunciation, parts of speech, corpus ranks, and inflection exchange fields.
- [Open English WordNet 2025](https://en-word.net/), CC BY 4.0: English definitions and usage examples.

Source references and confidence are kept on every production entry. IELTS and TOEFL labels are orientation tags, not claims of official exam ownership or score prediction.

## Performance model

The 9,000-word content library is never stored in localStorage and is never bundled into every page.

- Search loads one compact, prebuilt index only after the user opens search.
- A detail route fetches one first-letter shard at runtime; no 9,000-page static generation is used.
- Today loads one 100-entry daily bucket, then exposes only 20, 35, or 50 candidates according to the time budget.
- localStorage contains only interacted learner progress. A storage adapter now isolates persistence calls so Reading documents can move to IndexedDB without rewriting the learning engines.

Reading documents remain suitable for localStorage at the current product scale. IndexedDB becomes the next migration when stored reading text and personal sentences approach roughly 1 MB or need indexed queries. Vocabulary content should remain versioned static data or move to a database, not IndexedDB progress records.

## Product convergence

The top navigation is Today, Vocabulary, Reading, and Progress. Dashboard has one primary action: start today's plan. Rapid Scan, roots, paths, sentence practice, quizzes, and manual review remain available as secondary tools.

Today combines warm-up review, a 20–50-word rapid scan, focused learning, sentence reinforcement, a short quiz, and a summary. Due reviews and Reading Inbox words influence priority, while the mix prevents reading words from taking over the whole session.

Progress separates Recognized, Stable, Active, and Fluent vocabulary. Stable requires delayed evidence at least 24 hours after first learning and can decline when review is badly overdue. Active requires successful meaning-to-word or cloze recall. Fluent additionally requires repeated correctness, quick responses, memory strength, and current retention.
