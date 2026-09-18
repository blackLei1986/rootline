# Master Vocabulary architecture

## Existing-schema audit

The first three rounds had a strong learning loop, but content was still root-led:

- `Word` treated collocations and examples as embedded strings instead of reusable learning entities.
- A sense held only a translation and optional definition; it could not prioritize core senses or link evidence.
- Frequency bands were editorial and lacked field-level confidence.
- Word-family counts, surface-word counts and lemma counts were not separated.
- The same model could not safely represent a valuable word with no teachable root.
- There was no candidate state machine, strict generation schema, retry boundary or source-aware quality gate.

The migration is additive. Stable word IDs and legacy presentation fields stay intact so stored learner progress keeps working.

## Master entities

`Word` is the single source of truth. General, Academic, IELTS-oriented and TOEFL-oriented paths are filters over `coverageTags`; they are not duplicate word lists.

First-class reusable entities are `WordFamily`, `WordSense`, `Phrase`, `Sentence`, `SentencePattern` and `QuizCandidate`. `SourceMetadata` and `AIMetadata` make uncertain fields traceable. `Root` is optional.

## Pipeline contract

The processing order is:

1. Import a reliable seed list.
2. Normalize stable lemma IDs.
3. Detect lemma + part-of-speech duplicates.
4. Enrich through the `AIProvider` interface.
5. Validate strict Zod schemas and references.
6. Score completeness, sources, sentences, context and duplicates.
7. Route to `accepted`, `needs-review` or `rejected`.
8. Export accepted records only.

Candidate checkpoints use `pending`, `generated`, `validated`, `accepted`, `rejected` and `needs-review`. Generation retries at most three times. Accepted records are cached and skipped by later generation runs. Every large command supports `--dry-run` and `--limit`.

## Quality policy

- `>= 85`: auto-accept only when source confidence is also high enough.
- `70–84`: human review.
- `< 70`: reject or regenerate.
- Sentence catalog threshold: 78 for naturalness and utility.
- CEFR, rank, etymology and exam relevance remain candidates unless supported by a named source and confidence.
- Exam relevance is an internal learning score, never an official occurrence probability.

The current pilot intentionally contains one fully reviewed record (`significant`). Scale should proceed 100 → 500 → 2000 only after each audit gate is stable.
