create table public.progress_vocabulary_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  stable_count integer not null check (stable_count >= 0),
  catalog_version text not null check (length(catalog_version) > 0),
  captured_at timestamptz not null default now(),
  primary key (user_id, learning_date)
);

alter table public.progress_vocabulary_snapshots enable row level security;
revoke all on public.progress_vocabulary_snapshots from public, anon, authenticated;
grant select on public.progress_vocabulary_snapshots to authenticated;
grant select, insert, update on public.progress_vocabulary_snapshots to service_role;

create policy progress_snapshots_owner_read on public.progress_vocabulary_snapshots
  for select to authenticated
  using ((select auth.uid()) = user_id);

create index review_events_user_passive_word_idx
  on public.review_events (user_id, event_type, word_id)
  where word_id is not null and event_type in (
    'word_seen', 'recognition_known', 'recognition_fuzzy', 'recognition_unknown',
    'reading_encounter', 'reading_lookup'
  );

create function public.progress_passive_word_ids(p_user_id uuid)
returns table(word_id text)
language sql stable security invoker
set search_path = ''
as $$
  select distinct e.word_id
  from public.review_events e
  where current_user = 'service_role'
    and e.user_id = p_user_id
    and e.word_id is not null
    and e.event_type in (
      'word_seen', 'recognition_known', 'recognition_fuzzy', 'recognition_unknown',
      'reading_encounter', 'reading_lookup'
    )
$$;

revoke all on function public.progress_passive_word_ids(uuid) from public, anon, authenticated;
grant execute on function public.progress_passive_word_ids(uuid) to service_role;
