-- ============================================================
-- Rootline: Phase 1 — vocabulary core schema (normalized v2)
--
-- Tables (11):
--   vocabulary core  : words, word_senses, roots, word_roots,
--                      tags, word_tags, word_forms
--   learning content : sentences, word_sentences
--   user progress    : user_word_progress, review_logs
--
-- Normalization for: one-word-many-senses (word_senses), many POS,
-- word families / derivations (word_forms), affixes (roots),
-- exam/CEFR tags (tags/word_tags), RSS word spotting, AI content gen.
--
-- Idempotent: safe to re-run.
--   - tables:        CREATE TABLE IF NOT EXISTS
--   - indexes:       CREATE INDEX IF NOT EXISTS
--   - policies:      DROP POLICY IF EXISTS + CREATE POLICY
--   - triggers/func: CREATE OR REPLACE / DROP TRIGGER IF EXISTS
--
-- RLS model:
--   - Public vocabulary (words/word_senses/roots/word_roots/tags/
--     word_tags/word_forms) is SELECT-only for anon + authenticated;
--     no write policies, so normal clients cannot mutate core content.
--     service_role bypasses RLS for admin/AI bulk imports.
--   - sentences / word_sentences: SELECT-only.
--   - user_word_progress / review_logs: owner-only (auth.uid() = user_id).
-- ============================================================

-- 000. pgcrypto for parity (gen_random_uuid() is core in PG13+; kept for a
--      consistent extension set with earlier migrations).
create extension if not exists pgcrypto with schema extensions;

-- 001. shared updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ============================================================
-- 002. words — headword inventory (8,000–10,000+ words)
-- ============================================================
create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  lemma text,
  normalized_word text unique not null,
  phonetic_uk text,
  phonetic_us text,
  audio_uk_url text,
  audio_us_url text,
  frequency_rank integer,
  frequency_score numeric,
  cefr_level text,
  difficulty_score numeric,
  word_family text,
  status text default 'draft',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- requirement 1: frequency_rank
create index if not exists idx_words_frequency_rank on public.words (frequency_rank);
-- requirement 2: cefr_level
create index if not exists idx_words_cefr_level on public.words (cefr_level);
-- requirement 3: normalized_word -> unique index (from the UNIQUE constraint)
-- supplementary: word family (word_family), AI workflow (status), lemma
create index if not exists idx_words_word_family on public.words (word_family);
create index if not exists idx_words_status on public.words (status);
create index if not exists idx_words_lemma on public.words (lemma);

drop trigger if exists set_updated_at_words on public.words;
create trigger set_updated_at_words
  before update on public.words
  for each row execute function public.set_updated_at();

alter table public.words enable row level security;
drop policy if exists words_select_all on public.words;
create policy words_select_all on public.words for select using (true);

-- ============================================================
-- 003. word_senses — one word, many senses / POS (一词多义 / 多词性)
-- ============================================================
create table if not exists public.word_senses (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words (id) on delete cascade,
  part_of_speech text,
  sense_order integer,
  meaning_zh text,
  definition_en text,
  usage_note text,
  register text,
  cefr_level text,
  is_common boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- requirement 4: word_senses.word_id
create index if not exists idx_word_senses_word_id on public.word_senses (word_id);

drop trigger if exists set_updated_at_word_senses on public.word_senses;
create trigger set_updated_at_word_senses
  before update on public.word_senses
  for each row execute function public.set_updated_at();

alter table public.word_senses enable row level security;
drop policy if exists word_senses_select_all on public.word_senses;
create policy word_senses_select_all on public.word_senses for select using (true);

-- ============================================================
-- 004. roots — affixes / etymological roots
-- ============================================================
create table if not exists public.roots (
  id uuid primary key default gen_random_uuid(),
  root text not null,
  normalized_root text unique not null,
  root_type text,
  meaning_zh text,
  meaning_en text,
  language_origin text,
  etymology text,
  explanation text,
  memory_tip text,
  frequency_rank integer,
  productivity_score numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_roots_frequency_rank on public.roots (frequency_rank);
create index if not exists idx_roots_root_type on public.roots (root_type);

drop trigger if exists set_updated_at_roots on public.roots;
create trigger set_updated_at_roots
  before update on public.roots
  for each row execute function public.set_updated_at();

alter table public.roots enable row level security;
drop policy if exists roots_select_all on public.roots;
create policy roots_select_all on public.roots for select using (true);

-- ============================================================
-- 005. word_roots — many-to-many join (word <-> root)
-- ============================================================
create table if not exists public.word_roots (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words (id) on delete cascade,
  root_id uuid not null references public.roots (id) on delete cascade,
  sequence integer,
  surface_form text,
  role text,
  explanation text,
  confidence numeric,
  source text,
  created_at timestamptz not null default now(),
  unique (word_id, root_id, sequence)
);

-- requirement 5: word_id covered by the UNIQUE(word_id, root_id, sequence)
--                leading prefix; add an explicit root_id index for reverse lookup.
create index if not exists idx_word_roots_root_id on public.word_roots (root_id);

alter table public.word_roots enable row level security;
drop policy if exists word_roots_select_all on public.word_roots;
create policy word_roots_select_all on public.word_roots for select using (true);

-- ============================================================
-- 006. tags — exam / CEFR / priority tags (IELTS, TOEFL, CET, GRE, ...)
-- ============================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  category text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tags_category on public.tags (category);

alter table public.tags enable row level security;
drop policy if exists tags_select_all on public.tags;
create policy tags_select_all on public.tags for select using (true);

-- ============================================================
-- 007. word_tags — many-to-many join (word <-> tag)
-- ============================================================
create table if not exists public.word_tags (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  priority integer,
  source text,
  created_at timestamptz not null default now(),
  unique (word_id, tag_id)
);

-- requirement 6: word_id covered by UNIQUE(word_id, tag_id); add tag_id
--                for reverse lookup (which words carry a given tag).
create index if not exists idx_word_tags_tag_id on public.word_tags (tag_id);

alter table public.word_tags enable row level security;
drop policy if exists word_tags_select_all on public.word_tags;
create policy word_tags_select_all on public.word_tags for select using (true);

-- ============================================================
-- 008. word_forms — inflections & derivations (word family)
-- ============================================================
create table if not exists public.word_forms (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words (id) on delete cascade,
  form text not null,
  form_type text,
  created_at timestamptz not null default now(),
  unique (word_id, form)
);

-- reverse lookup by surface form (for RSS word spotting / normalization)
create index if not exists idx_word_forms_form on public.word_forms (form);

alter table public.word_forms enable row level security;
drop policy if exists word_forms_select_all on public.word_forms;
create policy word_forms_select_all on public.word_forms for select using (true);

-- ============================================================
-- 009. sentences — example sentences (unchanged from v1)
-- ============================================================
create table if not exists public.sentences (
  id uuid primary key default gen_random_uuid(),
  sentence_en text not null,
  sentence_zh text,
  difficulty_level integer,
  source_type text,
  source_name text,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sentences_difficulty_level on public.sentences (difficulty_level);
create index if not exists idx_sentences_source_type on public.sentences (source_type);

drop trigger if exists set_updated_at_sentences on public.sentences;
create trigger set_updated_at_sentences
  before update on public.sentences
  for each row execute function public.set_updated_at();

alter table public.sentences enable row level security;
drop policy if exists sentences_select_all on public.sentences;
create policy sentences_select_all on public.sentences for select using (true);

-- ============================================================
-- 010. word_sentences — many-to-many join (word <-> sentence)
-- ============================================================
create table if not exists public.word_sentences (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words (id) on delete cascade,
  sentence_id uuid not null references public.sentences (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (word_id, sentence_id)
);

create index if not exists idx_word_sentences_sentence_id on public.word_sentences (sentence_id);

alter table public.word_sentences enable row level security;
drop policy if exists word_sentences_select_all on public.word_sentences;
create policy word_sentences_select_all on public.word_sentences for select using (true);

-- ============================================================
-- 011. user_word_progress — per-user spaced-repetition state (owner-only)
-- ============================================================
create table if not exists public.user_word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  status text,
  familiarity integer,
  review_count integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  interval_days integer not null default 0,
  ease_factor numeric not null default 2.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, word_id)
);

create index if not exists idx_user_word_progress_user_next_review
  on public.user_word_progress (user_id, next_review_at);
create index if not exists idx_user_word_progress_word_id
  on public.user_word_progress (word_id);

drop trigger if exists set_updated_at_user_word_progress on public.user_word_progress;
create trigger set_updated_at_user_word_progress
  before update on public.user_word_progress
  for each row execute function public.set_updated_at();

alter table public.user_word_progress enable row level security;

drop policy if exists user_word_progress_select_own on public.user_word_progress;
create policy user_word_progress_select_own
  on public.user_word_progress for select using (auth.uid() = user_id);

drop policy if exists user_word_progress_insert_own on public.user_word_progress;
create policy user_word_progress_insert_own
  on public.user_word_progress for insert with check (auth.uid() = user_id);

drop policy if exists user_word_progress_update_own on public.user_word_progress;
create policy user_word_progress_update_own
  on public.user_word_progress for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_word_progress_delete_own on public.user_word_progress;
create policy user_word_progress_delete_own
  on public.user_word_progress for delete using (auth.uid() = user_id);

-- ============================================================
-- 012. review_logs — immutable review event log (owner-only)
-- ============================================================
create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  result text,
  response_time_ms integer,
  review_type text,
  reviewed_at timestamptz not null default now()
);

create index if not exists idx_review_logs_user_reviewed
  on public.review_logs (user_id, reviewed_at desc);
create index if not exists idx_review_logs_word_id
  on public.review_logs (word_id);

alter table public.review_logs enable row level security;

drop policy if exists review_logs_select_own on public.review_logs;
create policy review_logs_select_own
  on public.review_logs for select using (auth.uid() = user_id);

drop policy if exists review_logs_insert_own on public.review_logs;
create policy review_logs_insert_own
  on public.review_logs for insert with check (auth.uid() = user_id);

drop policy if exists review_logs_update_own on public.review_logs;
create policy review_logs_update_own
  on public.review_logs for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists review_logs_delete_own on public.review_logs;
create policy review_logs_delete_own
  on public.review_logs for delete using (auth.uid() = user_id);
