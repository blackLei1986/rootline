-- ============================================================
-- Rootline: root learning mode & word-family expansion (v1)
--
-- Two concerns:
--   1. Extend public.roots with curated teaching metadata used by
--      the root-learning homepage, the 4-stage study flow, and the
--      inference / Root Challenge exercises.
--   2. Add root_learning_progress — the per-user, per-root progress
--      record that powers adaptive root study (recognition /
--      derivation / inference skill scores + word-family stats).
--
-- Depends on 202609180001_vocabulary_core.sql (public.roots).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
--             DROP POLICY IF EXISTS + CREATE POLICY. Safe to re-run.
--
-- RLS: root_learning_progress is owner-only (auth.uid() = user_id),
--      mirroring user_word_progress / review_logs / user_word_skill.
-- ============================================================

-- ---------- 1. public.roots: teaching metadata ----------
-- Non-destructive: all columns are nullable so existing rows are never
-- invalidated; backfill can happen incrementally via seed/import.
alter table public.roots
  add column if not exists family_size integer,
  add column if not exists high_frequency_word_count integer,
  add column if not exists learning_value numeric,
  add column if not exists semantic_transparency numeric,
  add column if not exists etymology_accuracy numeric;

-- Fast lookup for the root-library homepage ranking.
create index if not exists idx_roots_learning_value on public.roots (learning_value desc);

-- ---------- 2. public.root_learning_progress ----------
create table if not exists public.root_learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  root_id uuid not null references public.roots (id) on delete cascade,
  -- adaptive skill scores (0..100), seeded at 0
  recognition_score numeric not null default 0,
  derivation_score numeric not null default 0,
  inference_score numeric not null default 0,
  -- word-family coverage stats
  words_seen integer not null default 0,
  words_mastered integer not null default 0,
  -- scheduling
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, root_id)
);

-- due-queue lookup for the root-learning homepage
create index if not exists idx_root_learning_progress_user_next_review
  on public.root_learning_progress (user_id, next_review_at);
create index if not exists idx_root_learning_progress_root_id
  on public.root_learning_progress (root_id);

drop trigger if exists set_updated_at_root_learning_progress on public.root_learning_progress;
create trigger set_updated_at_root_learning_progress
  before update on public.root_learning_progress
  for each row execute function public.set_updated_at();

alter table public.root_learning_progress enable row level security;

drop policy if exists root_learning_progress_select_own on public.root_learning_progress;
create policy root_learning_progress_select_own
  on public.root_learning_progress for select using (auth.uid() = user_id);

drop policy if exists root_learning_progress_insert_own on public.root_learning_progress;
create policy root_learning_progress_insert_own
  on public.root_learning_progress for insert with check (auth.uid() = user_id);

drop policy if exists root_learning_progress_update_own on public.root_learning_progress;
create policy root_learning_progress_update_own
  on public.root_learning_progress for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists root_learning_progress_delete_own on public.root_learning_progress;
create policy root_learning_progress_delete_own
  on public.root_learning_progress for delete using (auth.uid() = user_id);
