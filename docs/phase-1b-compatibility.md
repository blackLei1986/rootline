# Phase 1B compatibility behavior

Daily plans remain immutable per user and profile-local learning date. A plan created before the Phase 1B deployment is not rewritten or replaced mid-day: the existing Today page continues to render that plan through the retained legacy flow, and its existing session / review history is not deleted. The first new learning date after deployment receives a frozen Daily 30 snapshot and initializes per-target progress rows.

The production `POST /api/today` regeneration path is removed. Same-date plan reads return the stored plan, including after refresh or sign-in on another device. Daily 30 progress is additive (`today_target_progress` plus `today_sessions.current_block`); old plans do not require synthetic target rows. Reading, Rapid Scan, and the existing mastery/SRS stores remain available as secondary capabilities, but are not required stages in the Daily 30 flow.

This means an account that already has today's legacy plan will not be silently migrated to a different 30-word commitment that day. That is intentional safety behavior; the cost is a one-learning-day delay before Daily 30 is first shown to that account.
