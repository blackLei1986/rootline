# Rootline 2.0 — Phase 2C Reading → Vocabulary Reinforcement

**Status:** Written specification approved by user on 2026-09-25; implementation plan pending review

**Date:** 2026-09-25

**Base:** Phase 2B frozen Daily-3 summary reader, authenticated state endpoint, and one learner vocabulary state

## 1. Outcome and boundaries

Turn meaningful interaction with a Daily-3 article into small, context-based vocabulary reinforcement. Daily 30 remains the sole required daily commitment. Reading exposure, detail opens, article completion, exercise starts, answers, failures, and skips must never change Today target count, completed-word count, final-review completion, Today Complete, or streak completion. Reading may contribute conservative evidence to the existing word mastery, SRS, and weak-word signals; it must not create a second mastery score or a mandatory reading quota.

An article can be finished without reinforcement. The optional set is approximately 3–5 items when the displayed summary supplies enough safe contexts; fewer items or no set is preferable to fabricated or ambiguous content. No generic Quiz redirect, RSS expansion, generated article prose, new reading achievements, or Progress 2.0 is included.

## 2. Verified existing contracts and risks

- Daily-3 membership is the verified viewer's current frozen `(user_id, learning_date)` recommendation set. Its summary, Today match IDs, and recent match IDs are persisted. The article page currently shows summary only; extracted publisher text is not available for exercises.
- `user_article_states` already persists article `opened_at` and `completed_at`. The legacy `/api/articles/[id]/state` completion path records vocabulary encounters and is not used by Daily-3.
- `review_events` stores learning events with unique `(user_id, client_event_id)`. `LearningEventType` already includes `reading_encounter` and `reading_lookup`; the Daily-3 page does not yet emit them.
- `word_learning_states.state` stores the existing `WordProgress`/FSRS state. `recordWordAnswer` schedules it in browser-local storage. The generic `apply_sync_operation` path currently upserts whole word-state snapshots; a late stale snapshot can overwrite a newer Reading result. Client-local answer recording alone cannot satisfy the agreed duplicate-credit and persistence guarantees.
- `calculateWordMastery` currently treats successful `cloze`/`meaning-recall` events as active evidence and requires delayed review plus further conditions for stable/fluent status. The 2C mapping must distinguish Reading modes without converting exposure or lookup into active recall.
- Existing Today plans, sessions, target progress, and events have their own persistence path. Reading endpoints must not call it.

## 3. Chosen architecture

The server owns Reading evidence, exercise snapshots, answer validation, and accepted answer progress. An owner-scoped `reading_reinforcement_sessions` table stores one fixed question set and answers per `(user_id, article_id)`, plus its original learning date. A later recommendation of the same article returns that existing session, including if it is complete; it cannot grant a second round of the same article's answer credit. Continue a previously started session by its owned session ID after the learning date changes; only current frozen-set members can start a new one. This creates no historical article browser: past sessions expose only their frozen exercise content, not an old Daily-3 list or live article lookup.

Existing `review_events` is the evidence log and existing `word_learning_states` is the one SRS state. No Reading-specific mastery score or queue is introduced. A dedicated server service verifies viewer, frozen membership or owned existing session, question ID, and answer; the client never sends correctness, rating, next word state, or another user's ID as authority. A short database transaction claims the deterministic event, advances one question, and updates the existing word state together. A repeated request returns the saved outcome without another schedule step. Concurrent claims use a session revision and word-state compare-and-swap; a conflict retries against the latest state or returns a retryable response without recording partial credit.

The new session table uses the project's existing `public` schema, has RLS enabled, and has no direct `anon` or `authenticated` table grants because its snapshot contains answer keys. Only server routes using the service-role client may read/write raw session rows after verifying the viewer. Any transaction RPC is restricted to `service_role`, has a fixed `search_path`, receives a server-derived owner ID, and verifies that the locked session row belongs to that owner. pgTAP and route tests assert anonymous, other-user, and direct authenticated-client denial. The schema migration and grants are additive. No production data or deployment is part of this phase.

### Sync boundary

Accepted Reading answers return authoritative word progress to the browser; the client hydrates that state and does **not** run `recordWordAnswer` for the same answer. Before a Reading answer, pending sync for its selected word is flushed or a retryable sync warning is shown. Generic word-state sync must be hardened so a stale whole-state upload cannot overwrite a newer server Reading revision. On revision conflict, the original pending local operation is preserved and the client is offered reconciliation; it is never silently acknowledged or substituted with an older state. An unrelated concurrent offline edit to the same word is not assumed to be losslessly mergeable from the existing snapshot payload. Phase 2C accepts an explicit pending-sync conflict rather than losing either edit or pretending cross-device offline merge is complete.

The current schema also grants authenticated clients direct write access to `word_learning_states`, bypassing a sync-only guard. Phase 2C must remove that direct write path and route existing local migration writes through the guarded operation without breaking read access or owner isolation. The same server-owned boundary reserves Phase 2C's `reading-*` event identities against direct authenticated insertion and generic client event sync. Other pre-existing client event semantics are not redesigned in this phase.

## 4. Evidence model and idempotency

Evidence identity is deterministic per verified user:

| Action | Event identity | Existing-state effect |
| --- | --- | --- |
| Summary exposure of a highlighted, actually displayed matched word | `reading-exposure:{articleId}:{wordId}` | One `reading_encounter`; no FSRS or mastery-counter advancement. |
| Explicit highlighted-word detail open | `reading-lookup:{articleId}:{wordId}` | One `reading_lookup`; no FSRS or mastery-counter advancement. |
| One answered reinforcement item | `reading-answer:{sessionId}:{questionId}` | One `quiz_correct` or `quiz_wrong` with Reading mode, server-computed result, and the conservative mapping below. |

The server verifies that an exposure/lookup word belongs to the frozen match IDs **and** occurs in the displayed summary tokenization. Merely rendering a recommendation card, scrolling, refreshing, or reopening a completed article never adds more exposure credit. A user can open a detail again for reading, but the learning event remains one per article and word. Stable IDs, database uniqueness, and transaction-level duplicate handling cover double-click, refresh, back/forward, retry, and another device replaying the same exercise request.

Evidence hierarchy is `exposure < detail open < context recognition < Reading Cloze < short recall < delayed recall`. Phase 2C generates no dedicated delayed-recall exercise; later ordinary spaced review supplies that evidence.

### Conservative mapping

- Exposure and detail open append weak events only. They cannot set `firstLearnedAt`, mark a word recognized/stable/active, or schedule a review.
- Context Recognition correct increments recognition evidence only, not FSRS review count or active-recall evidence. A wrong answer increases weak-word evidence but does not force the next Daily 30 plan to include that word.
- Reading Cloze correct uses the existing FSRS adapter's `hard` rating; Short Recall correct uses `good`. Either wrong answer uses `again`. The answer mode is included in the existing event metadata and mastery logic recognizes only successful Cloze/Recall as active retrieval. One immediate answer is never labeled delayed recall.
- Stable/fluent/mastered status continues to require the existing delayed and cumulative conditions. Reading does not set any mastery level directly. Weak-word selection continues to use the existing learner state and Daily planner rules.
- The server owns timestamp and correctness. It does not accept a client-supplied rating, mastery value, arbitrary event ID, or Today plan ID for Reading evidence.

## 5. Deterministic reinforcement set

An eligible target is a unique ID in the article's frozen Today/recent match lists whose actual highlighted surface occurs in its frozen displayed summary and whose production vocabulary entry has a usable core meaning. Source context is an original summary sentence or contiguous local clause that contains that exact highlighted token. No live RSS fetch, publisher extraction, AI rewrite, morphology inference, or reanalysis of article text is allowed.

Rank eligible words in this order: Today matches, recent weak/due words according to the existing learner state, words whose detail the learner opened, then other recent matches. Within a priority band, use a deterministic tie-break based on frozen article ID and word ID. Select no more than five distinct words, normally three to five. Do not quiz every highlight. If fewer than three safe items exist, show the actual smaller count; if none exists, omit the CTA. Starting the session freezes target IDs, source sentence, question type, prompt, options, accepted answer forms, and ordering; refresh and vocabulary-catalog changes do not regenerate them.

Cycle available question types to include Context Recognition, Reading Cloze, and Short Recall when at least three safe, distinct targets permit it. A question is omitted rather than padded when its source sentence, answer, or distractors are ambiguous. The server keeps answer keys out of the response until submission.

- **Context Recognition:** display an original sentence/clause and its highlighted target. Ask for the target's catalogued core meaning, not an unverified claim about a polysemous sense. Choices are deterministic, distinct, and non-identical to the correct core meaning; insufficient safe distractors disqualify that question. Existing Today context-question utilities may be reused after adapting their summary-only and ambiguity checks.
- **Reading Cloze:** replace exactly one actual occurrence in the original summary context with a blank. Accept the frozen original surface form case-insensitively; do not accept an ungrammatical lemma in place of an inflected surface merely to raise the score.
- **Short Recall:** show the word's core meaning and a short article context cue; request the catalogue lemma. Accept the frozen lemma case-insensitively, with only explicitly validated equivalent forms if the frozen question records them.
- A trusted morphology-backed word may show its already verified root association as a post-answer explanation or optional cue. A Support word receives no decomposition or invented root hint.

## 6. Routes, state, and UI

- `POST /api/reading/articles/[id]/evidence` accepts only a known exposure/detail-open action for a frozen summary word, after verified-viewer and current-set membership checks. Evidence recording failure does not block reading or the word-detail dialog; it reports an unobtrusive retryable save state.
- `POST /api/reading/articles/[id]/reinforcement` starts or returns the one frozen session for a current recommendation member, once the article is marked finished. It returns public question fields, prior accepted outcomes, cursor/status, and aggregate counts, but never unsubmitted answer keys.
- `GET /api/reading/reinforcement/[sessionId]` returns an owned existing session, including after date rollover, without reauthorizing through the now-expired daily recommendation. A foreign/unknown ID has one non-disclosing not-found response.
- `POST /api/reading/reinforcement/[sessionId]/answers` submits `{questionId, answer}` only. The server validates the current unanswered item and computes correctness; a duplicate returns the persisted result. A request for an unrelated, future, or forged item is rejected. Only confirmed submissions advance the cursor.

The Reading home may show a small, separate “继续未完成巩固” area with up to the three most recently active owned sessions, linked directly to their exercise route. This does not add recommendations, a historical article collection, or access to old article content; older sessions remain available through their exact session links.

The existing `user_article_states` remains unopened / in progress / finished based on opened/completed timestamps. Reinforcement status is separate (`not started` / `active` / `complete`) and never reverses article completion. After finishing an article, show “快速巩固 N 个词” only if a safe set exists, plus an equal-right-to-leave path. The exercise view is short and article-context-first, not a full Today-style lesson. On network failure keep the typed answer and focus, explain that credit was not saved, and allow retry. When the server confirms, show answer feedback without color-only signals and advance accessibly. Refresh, browser navigation, and cross-day revisit restore the accepted cursor.

The article/result UI reports descriptive counts such as Today words encountered, unique words actively opened, items practiced, and correct items. It never displays internal mastery, stability, or FSRS scores. Choices, input, feedback, and resume controls support keyboard/focus; long answers wrap. Validate no horizontal overflow at 390, 430, 768, and 1440 pixels.

## 7. Failure and content cases

- Signed-out or unverified requests use the existing verified-viewer boundary. Forged article/session/word/question IDs reveal no other-user metadata and create no event.
- A current recommendation with no summary, no actual highlighted match, or insufficient safe context remains readable and completable but offers no unreliable reinforcement set.
- An empty set is not represented as “3 words”; the CTA reflects the actual frozen count. There is no fallback to generic Quiz or a live feed.
- If the evidence write fails, the article or dialog remains usable and the UI does not claim the event was saved. If answer persistence fails, there is no optimistic score, SRS update, or cursor advance.
- A stale sync snapshot is rejected/preserved rather than silently overwriting accepted Reading evidence. The UI can report pending synchronization while Reading remains skippable.
- An already completed exercise is read-only on reopen. The learner can review feedback but cannot resubmit for credit.
- Support words have normal lexical details and may be practiced when context is safe, but no morphology is synthesized.

## 8. Verification and completion

Unit and integration tests cover deterministic selection, 0–5 cap, missing/ambiguous summary, safe distractors, inflected Cloze answer, Support versus trusted morphology, evidence-strength mapping, weak-word response, stable event IDs, duplicate/racing submissions, retry after failure, stale word-state sync conflict, and cross-day owner-scoped resume. Explicit regression tests compare Today plan/session/target progress and Today Complete before and after Reading actions. Existing Phase 1B/2B tests remain unchanged in meaning and pass.

The additive schema migration receives pgTAP checks for RLS/grants, owner/non-owner/anonymous access, unique session identity, duplicate event prevention, and transactional answer/state consistency. Run database advisors and verify the migration against local Supabase only. Run full tests, lint, typecheck, production build, and final audit.

Authenticated local-browser acceptance covers login; complete or partly complete Today; open Daily-3; open Today and recent highlighted words; finish the article; start and answer recognition and Cloze; refresh mid-set and resume; answer Recall and finish; return to Today and assert its counts/status did not change from Reading activity. Repeat relevant interaction and overflow checks at 390, 430, 768, and 1440 pixels. Unrelated pre-existing placeholder browser tests are not counted as Phase 2C evidence.

Phase 2C is complete only after evidence, short contextual reinforcement, persisted resume, conservative mastery/SRS effects, duplicate prevention, Today independence, mobile/accessibility, and every quality gate pass. Stop there; do not begin Progress 2.0.

## 9. Known limitations and explicit costs

- The source contract is summary-only. Short or ambiguous summaries may yield fewer than three questions or no reinforcement at all. The publisher article body is not fetched or invented.
- Submitting an answer requires a live server connection. The article itself stays readable during a network interruption, but an unconfirmed answer gains no credit.
- The pre-existing sync protocol sends whole word snapshots. Phase 2C prevents stale overwrite and preserves unresolved conflicting local work, but it does not promise automatic lossless merging of simultaneous offline edits to the same word from multiple devices. That would require an event-level redesign beyond this reinforcement loop.
- Exposure/detail events are deduplicated per article and word; intentional repeated reading does not produce unlimited credit. No Reading streak or achievement system is added.
