# Rootline Phase 1B — Today 30 Design

## Authority and goal

This design implements the user's Phase 1B brief (`/Users/leipan/.codex/attachments/89bb9435-f466-4cfb-a7e3-e42638ec6e93/已粘贴的文本.txt`). Phase 1B replaces the primary Today model of a small new-word set plus independent Rapid Scan with a fixed, resumable daily commitment of up to 30 unique target words, organized in three blocks. The 380/420 pure-root simulation is a product-quality signal, not a blocker: valid Root Core is preferred, and real Support Words fill capacity without invented morphology.

## Existing infrastructure to retain

- Existing Next App Router `/today` route and Today plan / event services.
- Supabase Auth, per-user RLS, persisted plan snapshots, and idempotent `sync_operations`.
- Existing morphology confidence/review layer; exact-lemma verified+approved records qualify, as do exact-lemma `gold-dataset-exact-lemma` projections in derived/pending state. `none`, rejected, non-exact, and legacy family-only records never qualify as Root Core.
- Existing recognition, mastery, SRS scheduling, vocabulary and shared UI components.
- Reading, Course, Rapid, Quiz, and Recovery capabilities remain available through their own routes or contextual links; they are not competing primary choices for today's work.

## Plan selection and freeze

Build a deterministic plan once per `(user_id, user-local learning_date)` and return its stored snapshot on all later requests for that date. Snapshot ordered target IDs, display/meaning and usable learning-card material, source class, morphology/family grouping, block/position, and the planner version. Date conversion follows the existing profile timezone logic; UTC midnight must not produce a second plan.

Choose targets in this priority order: unfinished targets from the immediately previous local date; up to five genuinely weak/reinforcement targets based on existing mastery/recognition/error evidence (not every due SRS word); reliable Root Core; high-value Support Words. Deduplicate by canonical vocabulary identity and cap at 30. Carryover is finite: only the previous date's unfinished snapshot is imported, and the next snapshot still caps at 30. If 30 distinct eligible candidates do not exist, return the actual count rather than duplicate words or invent data.

Within Root Core, require either a verified+approved exact-lemma record or a curated Gold exact-lemma projection (`source=gold-dataset-exact-lemma`, confidence derived, not rejected), plus actual root segments; do not infer from legacy family IDs or substrings. Then rank root relevance, frequency, IELTS/TOEFL, academic value, learning value, and family diversity. Prefer 2–4 useful root clusters; root and block boundaries are independent. Within Support, rank frequency, IELTS/TOEFL, academic value, and learning value. Support has null morphology fields unless the same exact word independently has trusted morphology.

## Persistence and event model

The existing `today_plans.plan_snapshot` remains the immutable plan authority. Additive schema changes persist target status, current block/activity, recognition, exercise/review outcomes, and completion. Target and session writes must be scoped to the authenticated owner and frozen plan, performed transactionally, and idempotent by client operation ID. Existing legacy Today plans/events remain readable; do not delete or rewrite users' in-flight history.

The server session is authoritative for resuming after refresh/device changes. Existing mastery/SRS helpers continue to own long-term scheduling; Today events add evidence once and only after a successful/idempotently accepted write. Failed writes are retryable without double-applying SRS or marking a target complete prematurely.

## Learning sequence and UI

The required sequence is Root Preview where meaningful, then 30-target work split into blocks A/B/C (10 each), with a mini-review after each block and an adaptive final review. Learning activities include quick recognition (known/fuzzy/unknown), a concise word learning card, association appropriate to the target's evidence (morphology for Root Core, semantic for Support), cloze recall, and review. Known words receive a lighter explanation but still a recall opportunity; unknown words get full treatment. Do not require article reading in Today.

Cards show reliable pronunciation, core meaning, relevant morphology/formation or a reliable semantic cue, common phrase, and one quality sentence. Secondary material is expandable. Root previews are concise with root form, meanings, a short explanation, and 2–3 useful examples when available. On completion, show actual target count, Root Core/Support counts, encountered roots, review accuracy, and weak targets for future reinforcement; no next batch, shuffle, or regenerate action is available that date.

The homepage centers Today's Goal, progress, remaining-time estimate, Start/Continue, Today's Roots, and Review Status. Primary navigation trends toward Today / Roots / Reading / Progress / Me. Mobile uses a compact top bar and/or bottom navigation and must avoid overflow at 390px, 430px, 768px, and desktop.

## Completion and compatibility

Today completion requires target work, all three mini-reviews, and final review. Same-date plan completion is a hard lock. A new plan is available only when the user's learning date changes. Internal development fixtures may remain isolated from production UI. Existing progress and SRS are preserved; Reading 2.0, RSS redesign, additional morphology expansion, gamification, chat, and analytics redesign are out of scope.

## Known risks to test

- Low eligible catalog volume must degrade truthfully rather than fabricate 30.
- Large carryover plus weak load must remain capped and deterministic.
- Replay/concurrent request must not duplicate learning events, daily stats, or SRS scheduling.
- Plan snapshot must remain stable when vocabulary or morphology records change later.
- User-local day transitions and concurrent plan creation must not fork daily plans.
- Legacy Today plans and in-progress sessions must remain readable after migration.
