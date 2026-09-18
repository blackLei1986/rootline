-- ============================================================
-- Rootline: combined schema migration (run in Supabase SQL editor)
-- Order: 001 account/learning -> 002 rss/reading -> 003 today/reading
--        -> 004 vocabulary core -> 005 adaptive learning -> 006 root learning
-- All statements are idempotent; safe to re-run.
-- ============================================================


-- ---------- 202609170001_account_learning ----------
create extension if not exists pgcrypto with schema extensions;

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

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  timezone text not null default 'Asia/Shanghai',
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'active', 'complete')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_exams text[] not null default '{}',
  daily_time_budget integer not null default 20 check (daily_time_budget in (10, 20, 30)),
  preferred_topics text[] not null default '{}',
  difficulty_preference text not null default 'balanced' check (difficulty_preference in ('comfortable', 'balanced', 'challenging')),
  recommendation_controls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.word_learning_states (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, word_id)
);

create table public.review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null,
  event_type text not null,
  word_id text,
  session_id text,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_event_id)
);

create table public.learner_auxiliary_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  root_progress jsonb not null default '{}'::jsonb,
  daily_stats jsonb not null default '{}'::jsonb,
  calibration jsonb,
  learning_settings jsonb not null default '{}'::jsonb,
  transfer_stats jsonb not null default '{}'::jsonb,
  storage_version integer not null default 2 check (storage_version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vocabulary_encounters (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  document_kind text not null check (document_kind in ('reading-document', 'article')),
  document_id text not null,
  source_key text,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_encountered_at timestamptz not null,
  last_encountered_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, word_id, document_kind, document_id)
);

create table public.personal_sentences (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text,
  text text not null check (char_length(text) between 1 and 5000),
  target_word_ids text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.today_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  generation_version integer not null default 1 check (generation_version > 0),
  status text not null default 'not-started' check (status in ('not-started', 'active', 'complete')),
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes <= 180),
  selected_article_id uuid,
  degradation_reason text,
  plan_snapshot jsonb not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, learning_date, generation_version)
);

create table public.today_plan_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.today_plans(id) on delete cascade,
  item_type text not null check (item_type in ('review', 'rapid-scan', 'focus-word', 'reading', 'context-question')),
  position integer not null check (position >= 0),
  content_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, position)
);

create table public.today_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.today_plans(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'complete')),
  current_stage text not null,
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  outcomes jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id)
);

create table public.reading_documents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  source_type text not null,
  document_text text not null,
  analysis jsonb not null,
  analysis_version text not null,
  document_created_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table public.reading_progress (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  progress jsonb not null,
  version integer not null default 1 check (version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_id),
  foreign key (user_id, document_id) references public.reading_documents(user_id, id) on delete cascade
);

create table public.migration_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_installation_id text not null,
  schema_version integer not null check (schema_version > 0),
  status text not null default 'pending' check (status in ('pending', 'running', 'partial', 'complete', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  entity_counts jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_installation_id, schema_version)
);

create table public.migration_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.migration_batches(id) on delete cascade,
  entity_type text not null,
  legacy_id text not null,
  content_hash text not null,
  result text not null check (result in ('imported', 'skipped', 'failed')),
  error_category text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, entity_type, legacy_id)
);

create table public.sync_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null,
  operation_kind text not null check (operation_kind in ('word-state', 'learning-event', 'learner-auxiliary', 'reading-document', 'reading-progress', 'personal-sentence', 'today-plan', 'today-event')),
  entity_id text not null,
  entity_version integer not null check (entity_version > 0),
  applied_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, operation_id)
);

create index review_events_user_occurred_idx on public.review_events (user_id, occurred_at desc);
create index vocabulary_encounters_user_word_idx on public.vocabulary_encounters (user_id, word_id);
create index today_plans_user_date_idx on public.today_plans (user_id, learning_date desc);
create index reading_documents_user_created_idx on public.reading_documents (user_id, document_created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger word_states_set_updated_at before update on public.word_learning_states for each row execute function public.set_updated_at();
create trigger learner_auxiliary_set_updated_at before update on public.learner_auxiliary_state for each row execute function public.set_updated_at();
create trigger encounters_set_updated_at before update on public.vocabulary_encounters for each row execute function public.set_updated_at();
create trigger personal_sentences_set_updated_at before update on public.personal_sentences for each row execute function public.set_updated_at();
create trigger today_plans_set_updated_at before update on public.today_plans for each row execute function public.set_updated_at();
create trigger today_items_set_updated_at before update on public.today_plan_items for each row execute function public.set_updated_at();
create trigger today_sessions_set_updated_at before update on public.today_sessions for each row execute function public.set_updated_at();
create trigger reading_documents_set_updated_at before update on public.reading_documents for each row execute function public.set_updated_at();
create trigger reading_progress_set_updated_at before update on public.reading_progress for each row execute function public.set_updated_at();
create trigger migration_batches_set_updated_at before update on public.migration_batches for each row execute function public.set_updated_at();
create trigger migration_items_set_updated_at before update on public.migration_items for each row execute function public.set_updated_at();
create trigger sync_operations_set_updated_at before update on public.sync_operations for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_preferences', 'word_learning_states', 'learner_auxiliary_state', 'vocabulary_encounters',
    'personal_sentences', 'today_plans', 'today_plan_items', 'today_sessions',
    'reading_documents', 'reading_progress', 'migration_batches', 'migration_items'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;

  foreach table_name in array array['review_events', 'sync_operations'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
  end loop;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;

create or replace function public.apply_sync_operation(
  p_user_id uuid,
  p_operation_id text,
  p_kind text,
  p_entity_id text,
  p_version integer,
  p_payload jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted_operation uuid;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise insufficient_privilege using message = 'sync owner mismatch';
  end if;

  insert into public.sync_operations (
    user_id, operation_id, operation_kind, entity_id, entity_version
  ) values (
    p_user_id, p_operation_id, p_kind, p_entity_id, p_version
  )
  on conflict (user_id, operation_id) do nothing
  returning id into inserted_operation;

  if inserted_operation is null then
    return false;
  end if;

  case p_kind
    when 'word-state' then
      insert into public.word_learning_states (
        user_id, word_id, state, version, client_updated_at
      ) values (
        p_user_id, p_entity_id, p_payload, p_version, timezone('utc', now())
      )
      on conflict (user_id, word_id) do update set
        state = excluded.state,
        version = excluded.version,
        client_updated_at = excluded.client_updated_at;
    when 'learning-event' then
      insert into public.review_events (
        user_id, client_event_id, event_type, word_id, session_id, occurred_at, payload
      ) values (
        p_user_id,
        p_payload ->> 'id',
        p_payload ->> 'type',
        p_payload ->> 'wordId',
        p_payload ->> 'sessionId',
        (p_payload ->> 'timestamp')::timestamptz,
        coalesce(p_payload -> 'metadata', '{}'::jsonb)
      )
      on conflict (user_id, client_event_id) do nothing;
    when 'learner-auxiliary' then
      insert into public.learner_auxiliary_state (
        user_id, root_progress, daily_stats, calibration, learning_settings,
        transfer_stats, storage_version, client_updated_at
      ) values (
        p_user_id,
        coalesce(p_payload -> 'roots', '{}'::jsonb),
        coalesce(p_payload -> 'dailyStats', '{}'::jsonb),
        p_payload -> 'calibration',
        coalesce(p_payload -> 'settings', '{}'::jsonb),
        coalesce(p_payload -> 'transferStats', '{}'::jsonb),
        coalesce((p_payload ->> 'version')::integer, 2),
        timezone('utc', now())
      )
      on conflict (user_id) do update set
        root_progress = excluded.root_progress,
        daily_stats = excluded.daily_stats,
        calibration = excluded.calibration,
        learning_settings = excluded.learning_settings,
        transfer_stats = excluded.transfer_stats,
        storage_version = excluded.storage_version,
        client_updated_at = excluded.client_updated_at;
    when 'reading-document' then
      insert into public.reading_documents (
        user_id, id, title, source_type, document_text, analysis,
        analysis_version, document_created_at
      ) values (
        p_user_id,
        p_entity_id,
        p_payload ->> 'title',
        p_payload ->> 'sourceType',
        p_payload ->> 'text',
        p_payload,
        p_payload ->> 'analysisVersion',
        (p_payload ->> 'createdAt')::timestamptz
      )
      on conflict (user_id, id) do update set
        title = excluded.title,
        source_type = excluded.source_type,
        document_text = excluded.document_text,
        analysis = excluded.analysis,
        analysis_version = excluded.analysis_version,
        document_created_at = excluded.document_created_at;
    when 'reading-progress' then
      insert into public.reading_progress (
        user_id, document_id, progress, version, client_updated_at
      ) values (
        p_user_id, p_entity_id, p_payload, p_version, timezone('utc', now())
      )
      on conflict (user_id, document_id) do update set
        progress = excluded.progress,
        version = excluded.version,
        client_updated_at = excluded.client_updated_at;
    when 'personal-sentence' then
      insert into public.personal_sentences (
        id, user_id, document_id, text, target_word_ids, created_at
      ) values (
        p_entity_id,
        p_user_id,
        p_payload ->> 'documentId',
        p_payload ->> 'text',
        coalesce(
          array(select jsonb_array_elements_text(p_payload -> 'targetWordIds')),
          '{}'::text[]
        ),
        (p_payload ->> 'createdAt')::timestamptz
      )
      on conflict (id) do update set
        text = excluded.text,
        target_word_ids = excluded.target_word_ids;
    else
      raise exception 'unsupported sync kind: %', p_kind;
  end case;

  return true;
end;
$$;

revoke all on function public.apply_sync_operation(uuid, text, text, text, integer, jsonb) from public;
grant execute on function public.apply_sync_operation(uuid, text, text, text, integer, jsonb) to authenticated;


-- ---------- 202609170002_rss_reading ----------
create table public.feed_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  normalized_feed_url text not null unique,
  site_url text,
  title text not null,
  description text,
  etag text,
  last_modified text,
  fetch_status text not null default 'idle' check (fetch_status in ('idle', 'fetching', 'ready', 'failed')),
  last_successful_fetch_at timestamptz,
  next_retry_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_feed_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_source_id uuid not null references public.feed_sources(id) on delete cascade,
  enabled boolean not null default true,
  topic_tags text[] not null default '{}',
  preference_weight numeric(5,2) not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, feed_source_id)
);

create table public.articles (
  id uuid primary key default extensions.gen_random_uuid(),
  feed_source_id uuid references public.feed_sources(id) on delete set null,
  external_id text,
  canonical_url text not null unique,
  publisher_url text not null,
  title text not null,
  author text,
  published_at timestamptz,
  summary text,
  language text not null default 'en',
  extracted_text text,
  content_fingerprint text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'extracted', 'rejected', 'failed')),
  extraction_error_code text,
  analysis_version text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index articles_source_external_idx
on public.articles (feed_source_id, external_id)
where feed_source_id is not null and external_id is not null;

create unique index articles_content_fingerprint_idx
on public.articles (content_fingerprint)
where content_fingerprint is not null;

create table public.article_analyses (
  article_id uuid primary key references public.articles(id) on delete cascade,
  vocabulary_version text not null,
  analysis_state text not null check (analysis_state in ('metadata', 'full', 'stale')),
  word_count integer not null check (word_count >= 0),
  unique_lemma_count integer not null check (unique_lemma_count >= 0),
  estimated_minutes integer not null check (estimated_minutes > 0),
  lexical_matches jsonb not null default '[]'::jsonb,
  topic_features jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_article_scores (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  content_word_coverage numeric(5,2) not null check (content_word_coverage between 0 and 100),
  valuable_unknown_word_ids text[] not null default '{}',
  score numeric(7,3) not null,
  explanation_codes text[] not null default '{}',
  score_version integer not null check (score_version > 0),
  scored_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, article_id, score_version)
);

create table public.user_article_states (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  saved boolean not null default false,
  hidden boolean not null default false,
  opened_at timestamptz,
  completed_at timestamptz,
  progress jsonb not null default '{}'::jsonb,
  feedback text check (feedback is null or feedback in ('too-easy', 'good-fit', 'too-hard', 'not-interested')),
  last_interaction_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, article_id)
);

create table public.feed_fetch_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  feed_source_id uuid not null references public.feed_sources(id) on delete cascade,
  status text not null check (status in ('running', 'updated', 'not-modified', 'failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_code text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index subscriptions_user_enabled_idx on public.user_feed_subscriptions (user_id, enabled);
create index articles_source_published_idx on public.articles (feed_source_id, published_at desc);
create index article_scores_user_score_idx on public.user_article_scores (user_id, score desc);
create index article_states_user_interaction_idx on public.user_article_states (user_id, last_interaction_at desc);
create index feed_fetch_runs_source_started_idx on public.feed_fetch_runs (feed_source_id, started_at desc);

create trigger feed_sources_set_updated_at before update on public.feed_sources for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.user_feed_subscriptions for each row execute function public.set_updated_at();
create trigger articles_set_updated_at before update on public.articles for each row execute function public.set_updated_at();
create trigger article_analyses_set_updated_at before update on public.article_analyses for each row execute function public.set_updated_at();
create trigger article_scores_set_updated_at before update on public.user_article_scores for each row execute function public.set_updated_at();
create trigger article_states_set_updated_at before update on public.user_article_states for each row execute function public.set_updated_at();
create trigger feed_fetch_runs_set_updated_at before update on public.feed_fetch_runs for each row execute function public.set_updated_at();

alter table public.feed_sources enable row level security;
alter table public.articles enable row level security;
alter table public.article_analyses enable row level security;
alter table public.feed_fetch_runs enable row level security;

revoke all on table public.feed_sources, public.articles, public.article_analyses, public.feed_fetch_runs from anon, authenticated;
grant select on table public.feed_sources, public.article_analyses to authenticated;
grant select (id, feed_source_id, external_id, canonical_url, publisher_url, title, author, published_at, summary, language, content_fingerprint, extraction_status, analysis_version, created_at, updated_at) on public.articles to authenticated;

create policy feed_sources_authenticated_read on public.feed_sources for select to authenticated using (true);
create policy articles_authenticated_read on public.articles for select to authenticated using (true);
create policy article_analyses_authenticated_read on public.article_analyses for select to authenticated using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['user_feed_subscriptions', 'user_article_scores', 'user_article_states'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

create view public.article_catalog with (security_invoker = true) as
select
  a.id,
  a.feed_source_id,
  a.canonical_url,
  a.publisher_url,
  a.title,
  a.author,
  a.published_at,
  a.summary,
  a.language,
  a.extraction_status,
  aa.word_count,
  aa.estimated_minutes,
  aa.vocabulary_version
from public.articles a
left join public.article_analyses aa on aa.article_id = a.id;

revoke all on table public.article_catalog from anon, authenticated;
grant select on table public.article_catalog to authenticated;


-- ---------- 202609170003_today_reading ----------
create or replace function public.create_today_plan(
  p_user_id uuid,
  p_plan_id uuid,
  p_learning_date date,
  p_version integer,
  p_status text,
  p_estimated_minutes integer,
  p_selected_article_id uuid,
  p_degradation_reason text,
  p_plan_snapshot jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  inserted_plan_id uuid;
  stored_snapshot jsonb;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'Today plan owner mismatch';
  end if;

  insert into public.today_plans (
    id, user_id, learning_date, generation_version, status, estimated_minutes,
    selected_article_id, degradation_reason, plan_snapshot
  ) values (
    p_plan_id, p_user_id, p_learning_date, p_version, p_status, p_estimated_minutes,
    p_selected_article_id, p_degradation_reason, p_plan_snapshot
  )
  on conflict (user_id, learning_date, generation_version) do nothing
  returning id into inserted_plan_id;

  if inserted_plan_id is not null then
    insert into public.today_plan_items (user_id, plan_id, item_type, position, content_id, payload)
    select
      p_user_id,
      inserted_plan_id,
      item->>'type',
      ordinality - 1,
      item->>'contentId',
      coalesce(item->'payload', '{}'::jsonb)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entries(item, ordinality);
  end if;

  select plan_snapshot into stored_snapshot
  from public.today_plans
  where user_id = p_user_id
    and learning_date = p_learning_date
    and generation_version = p_version;

  return stored_snapshot;
end;
$$;

revoke all on function public.create_today_plan(uuid, uuid, date, integer, text, integer, uuid, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_today_plan(uuid, uuid, date, integer, text, integer, uuid, text, jsonb, jsonb) to authenticated, service_role;

create or replace function public.record_today_event(
  p_user_id uuid,
  p_operation_id text,
  p_plan_id uuid,
  p_event jsonb,
  p_session jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  inserted_operation uuid;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'Today event owner mismatch';
  end if;
  if not exists (select 1 from public.today_plans where id = p_plan_id and user_id = p_user_id) then
    raise exception 'Today plan not found';
  end if;

  insert into public.sync_operations (user_id, operation_id, operation_kind, entity_id, entity_version)
  values (p_user_id, p_operation_id, 'today-event', p_plan_id::text, 1)
  on conflict (user_id, operation_id) do nothing
  returning id into inserted_operation;

  if inserted_operation is not null then
    insert into public.today_sessions (user_id, plan_id, status, current_stage, outcomes, completed_at)
    values (
      p_user_id,
      p_plan_id,
      p_session->>'status',
      p_session->>'currentStage',
      jsonb_build_object(
        'completedQuestionIds', coalesce(p_session->'completedQuestionIds', '[]'::jsonb),
        'lastEvent', p_event
      ),
      case when p_session->>'status' = 'complete' then timezone('utc', now()) else null end
    )
    on conflict (plan_id) do update set
      status = excluded.status,
      current_stage = excluded.current_stage,
      outcomes = excluded.outcomes,
      completed_at = excluded.completed_at;

    update public.today_plans set
      status = p_session->>'status',
      started_at = coalesce(started_at, timezone('utc', now())),
      completed_at = case when p_session->>'status' = 'complete' then timezone('utc', now()) else completed_at end
    where id = p_plan_id and user_id = p_user_id;
  end if;

  return p_session;
end;
$$;

revoke all on function public.record_today_event(uuid, text, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.record_today_event(uuid, text, uuid, jsonb, jsonb) to authenticated, service_role;

alter table public.sync_operations drop constraint if exists sync_operations_operation_kind_check;
alter table public.sync_operations add constraint sync_operations_operation_kind_check check (
  operation_kind in (
    'word-state', 'learning-event', 'learner-auxiliary', 'reading-document',
    'reading-progress', 'personal-sentence', 'today-plan', 'today-event', 'reading-encounter'
  )
);

create or replace function public.record_article_encounter(
  p_user_id uuid,
  p_operation_id text,
  p_word_id text,
  p_article_id text,
  p_source_key text,
  p_occurrence_count integer,
  p_first_encountered_at timestamptz,
  p_last_encountered_at timestamptz
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted_operation uuid;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'Article encounter owner mismatch';
  end if;

  insert into public.sync_operations (user_id, operation_id, operation_kind, entity_id, entity_version)
  values (p_user_id, p_operation_id, 'reading-encounter', p_word_id || ':' || p_article_id, 1)
  on conflict (user_id, operation_id) do nothing
  returning id into inserted_operation;

  if inserted_operation is null then return false; end if;

  insert into public.vocabulary_encounters (
    user_id, word_id, document_kind, document_id, source_key, occurrence_count,
    first_encountered_at, last_encountered_at
  ) values (
    p_user_id, p_word_id, 'article', p_article_id, p_source_key, p_occurrence_count,
    p_first_encountered_at, p_last_encountered_at
  )
  on conflict (user_id, word_id, document_kind, document_id) do update set
    source_key = excluded.source_key,
    occurrence_count = greatest(public.vocabulary_encounters.occurrence_count, excluded.occurrence_count),
    first_encountered_at = least(public.vocabulary_encounters.first_encountered_at, excluded.first_encountered_at),
    last_encountered_at = greatest(public.vocabulary_encounters.last_encountered_at, excluded.last_encountered_at);

  return true;
end;
$$;

revoke all on function public.record_article_encounter(uuid, text, text, text, text, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.record_article_encounter(uuid, text, text, text, text, integer, timestamptz, timestamptz) to authenticated, service_role;


-- ---------- 202609180001_vocabulary_core ----------
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


-- ---------- 202609180002_adaptive_learning ----------
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


-- ---------- 202609180003_root_learning ----------
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

