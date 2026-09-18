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
