# Phase 6 · Reading Discovery Engine

## Phase A audit

The existing vocabulary system already exposes the stable identifiers and signals required by reading analysis:

- `Word`: `lemma`, `wordFamilyId`, frequency, learning value, exam relevance, roots, morphology, collocations and senses.
- `WordProgress`: recognition state and confidence, fluency, verification, memory strength and SRS dates.
- `Phrase` and `SentencePattern`: stable IDs, normalized text candidates, coverage tags and target word links.
- `Learner Model`: one shared progress store; Reading does not create a second mastery model.

The missing boundary was reading-specific context: documents, token offsets, contextual occurrences, a learning queue, reading progress and personal sentences. Those remain separate from public master content while referencing the same `wordId`.

## Pipeline

`tokenize → normalize → lemmatize → vocabulary/family match → proper-noun filter → phrase/pattern match → knowledge state → coverage/difficulty → recommendation`

The pipeline is deterministic and synchronous. It performs no remote calls and treats pasted text only as data. A prebuilt `VocabularyIndex` provides constant-time lookup maps and phrases are grouped by first token, sorted longest-first.

## Coverage semantics

- Function words contribute to overall flow but not content-word difficulty.
- Proper nouns and numbers do not become vocabulary gaps.
- Untracked is kept separate from explicitly unknown.
- Content coverage includes unmatched content tokens in its denominator, preventing a sparse master vocabulary from inflating the score.
- Stable coverage only counts fluent items.

Coverage is presented as an estimate, not a comprehension guarantee.

## Recommendation semantics

The score combines learning value, knowledge gap, contextual importance, repetition and path relevance. TOEFL, IELTS and Academic source types override the general path only for article ranking. Results are grouped into priority learning, suggested learning, inferable and ignore-for-now.

## Storage and privacy

`reading-storage.ts` is the only persistence boundary. Documents, contextual sentences and queues are browser-local and are never copied into the public master sentence dataset. Removing a document removes its contextual data but deliberately preserves shared `WordProgress` and SRS history.

## Learning loop

The article session follows three focused stages:

1. Quick Check for high-value uncertain words.
2. Context-first learning with phrase and morphology cues.
3. Original-sentence Cloze verification.

A correct Cloze updates both SRS and recognition verification. Re-analysis then makes Coverage Gain visible before the learner returns to the article.
