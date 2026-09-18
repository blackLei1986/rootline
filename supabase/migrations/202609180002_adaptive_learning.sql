-- ============================================================
-- Rootline: adaptive learning & review system (v1)
--
-- Upgrades user_word_progress and review_logs for an FSRS-style
-- scheduler (stability / difficulty model), and adds a per-skill
-- scoring table. Depends on 202609180001_vocabulary_core.sql.
--
-- Idempotent: ALTER ... ADD/DROP COLUMN IF [NOT] EXISTS, so it is
-- safe to re-run. Column type change (interval_days -> numeric) is
-- a no-op when already numeric.
--
-- RLS: user_word_progress / review_logs already have owner-only
-- policies from 001. user_word_skill gets the same here.
-- ============================================================

-- ---------- 1. user_word_progress: FSRS-style fields ----------
-- Drop legacy SM-2 fields superseded by the stability/difficulty model.
alter table public.user_word_progress
  drop column if exists status,
  drop column if exists correct_count,
  drop column if exists wrong_count,
  drop column if exists ease_factor;

alter table public.user_word_progress
  add column if not exists state text not null default 'new',
  add column if not exists stability numeric not null default 0,
  add column if not exists difficulty numeric not null default 5,
  add column if not exists lapse_count integer not null default 0,
  add column if not exists streak integer not null default 0,
  add column if not exists last_rating integer,
  add column if not exists first_learned_at timestamptz,
  add column if not exists mastered_at timestamptz,
  add column if not exists suspended boolean not null default false;

-- interval_days: integer -> numeric (fractional days now allowed)
alter table public.user_word_progress
  alter column interval_days type numeric using interval_days::numeric;

-- ---------- 2. review_logs: richer review event ----------
alter table public.review_logs
  drop column if exists result,
  drop column if exists review_type;

alter table public.review_logs
  add column if not exists rating integer,
  add column if not exists question_type text,
  add column if not exists answer_correct boolean,
  add column if not exists previous_interval numeric,
  add column if not exists new_interval numeric,
  add column if not exists previous_stability numeric,
  add column if not exists new_stability numeric;

-- ---------- 3. user_word_skill: per-skill scores ----------
create table if not exists public.user_word_skill (
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  recognition_score numeric not null default 0,
  recall_score numeric not null default 0,
  spelling_score numeric not null default 0,
  listening_score numeric not null default 0,
  context_score numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index if not exists idx_user_word_skill_word_id on public.user_word_skill (word_id);

drop trigger if exists set_updated_at_user_word_skill on public.user_word_skill;
create trigger set_updated_at_user_word_skill
  before update on public.user_word_skill
  for each row execute function public.set_updated_at();

alter table public.user_word_skill enable row level security;

drop policy if exists user_word_skill_select_own on public.user_word_skill;
create policy user_word_skill_select_own
  on public.user_word_skill for select using (auth.uid() = user_id);

drop policy if exists user_word_skill_insert_own on public.user_word_skill;
create policy user_word_skill_insert_own
  on public.user_word_skill for insert with check (auth.uid() = user_id);

drop policy if exists user_word_skill_update_own on public.user_word_skill;
create policy user_word_skill_update_own
  on public.user_word_skill for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_word_skill_delete_own on public.user_word_skill;
create policy user_word_skill_delete_own
  on public.user_word_skill for delete using (auth.uid() = user_id);
