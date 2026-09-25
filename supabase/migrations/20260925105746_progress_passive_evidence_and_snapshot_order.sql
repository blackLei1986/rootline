-- The original helper covered event evidence, but completed article bundles
-- persist their exposure in vocabulary_encounters without a review event.
create or replace function public.progress_passive_word_ids(p_user_id uuid)
returns table(word_id text)
language sql stable security invoker
set search_path = ''
as $$
  select evidence.word_id
  from (
    select e.word_id
    from public.review_events e
    where e.user_id = p_user_id
      and e.word_id is not null
      and e.event_type in (
        'word_seen', 'recognition_known', 'recognition_fuzzy', 'recognition_unknown',
        'reading_encounter', 'reading_lookup'
      )
    union
    select encounter.word_id
    from public.vocabulary_encounters encounter
    where encounter.user_id = p_user_id
  ) evidence
  where current_user = 'service_role'
  order by evidence.word_id
$$;

revoke all on function public.progress_passive_word_ids(uuid) from public, anon, authenticated;
grant execute on function public.progress_passive_word_ids(uuid) to service_role;

-- captured_at is the request's observation start, not the eventual write time.
-- An older request cannot replace a newer same-day stable count if it finishes last.
create function public.progress_record_stable_snapshot(
  p_user_id uuid,
  p_learning_date date,
  p_stable_count integer,
  p_catalog_version text,
  p_observed_at timestamptz
)
returns boolean
language plpgsql security invoker
set search_path = ''
as $$
declare
  stored boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'Progress snapshot write requires service role' using errcode = '42501';
  end if;

  insert into public.progress_vocabulary_snapshots
    (user_id, learning_date, stable_count, catalog_version, captured_at)
  values (p_user_id, p_learning_date, p_stable_count, p_catalog_version, p_observed_at)
  on conflict (user_id, learning_date) do update set
    stable_count = excluded.stable_count,
    catalog_version = excluded.catalog_version,
    captured_at = excluded.captured_at
  where public.progress_vocabulary_snapshots.captured_at < excluded.captured_at
  returning true into stored;

  return coalesce(stored, false);
end;
$$;

revoke all on function public.progress_record_stable_snapshot(uuid,date,integer,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.progress_record_stable_snapshot(uuid,date,integer,text,timestamptz)
  to service_role;
