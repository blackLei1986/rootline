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
