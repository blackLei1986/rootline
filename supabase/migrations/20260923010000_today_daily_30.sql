create table public.today_target_progress (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.today_plans(id) on delete cascade,
  target_id text not null,
  block smallint not null check (block between 1 and 3),
  status text not null default 'not-started' check (status in ('not-started', 'active', 'complete')),
  current_activity text check (current_activity in ('recognition', 'learning-card', 'association', 'cloze', 'recall')),
  recognition_state text check (recognition_state in ('known', 'fuzzy', 'unknown')),
  outcomes jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, target_id)
);

alter table public.today_sessions
  add column current_block smallint not null default 1 check (current_block between 1 and 3),
  add column event_revision integer not null default 0 check (event_revision >= 0);

create index today_target_progress_user_plan_block_idx
  on public.today_target_progress (user_id, plan_id, block, target_id);

create trigger today_target_progress_set_updated_at
  before update on public.today_target_progress
  for each row execute function public.set_updated_at();

alter table public.today_target_progress enable row level security;
revoke all on table public.today_target_progress from anon, authenticated;
grant select on table public.today_target_progress to authenticated;
grant all on table public.today_target_progress to service_role;

create policy today_target_progress_select_own
  on public.today_target_progress for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.today_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );

create or replace function public.prevent_today_plan_snapshot_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.plan_snapshot is distinct from new.plan_snapshot
    or old.learning_date is distinct from new.learning_date
    or old.generation_version is distinct from new.generation_version then
    raise exception 'Today plan snapshots are immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_today_plan_snapshot_mutation() from public, anon, authenticated;

create trigger today_plans_freeze_snapshot
  before update on public.today_plans
  for each row execute function public.prevent_today_plan_snapshot_mutation();

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
security invoker
set search_path = ''
as $$
declare
  inserted_plan_id uuid;
  stored_snapshot jsonb;
  target_count integer;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'Today plan owner mismatch';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_learning_date::text, 0)
  );

  select plan_snapshot into stored_snapshot
  from public.today_plans
  where user_id = p_user_id and learning_date = p_learning_date
  order by generation_version desc, created_at desc
  limit 1;
  if stored_snapshot is not null then
    return stored_snapshot;
  end if;

  target_count := pg_catalog.jsonb_array_length(coalesce(p_plan_snapshot->'dailyTargets', '[]'::jsonb));
  if target_count > 30 then raise exception 'Today plan exceeds the 30 target limit'; end if;
  if (
    select pg_catalog.count(*) <> pg_catalog.count(distinct target->>'wordId')
    from pg_catalog.jsonb_array_elements(coalesce(p_plan_snapshot->'dailyTargets', '[]'::jsonb)) as entry(target)
  ) then raise exception 'Today plan contains duplicate target IDs'; end if;

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
    from pg_catalog.jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as entries(item, ordinality);

    insert into public.today_target_progress (user_id, plan_id, target_id, block)
    select p_user_id, inserted_plan_id, target->>'wordId', (target->>'block')::smallint
    from pg_catalog.jsonb_array_elements(coalesce(p_plan_snapshot->'dailyTargets', '[]'::jsonb)) as targets(target);
  end if;

  select plan_snapshot into stored_snapshot
  from public.today_plans
  where user_id = p_user_id and learning_date = p_learning_date
  order by generation_version desc, created_at desc
  limit 1;
  return stored_snapshot;
end;
$$;

revoke all on function public.create_today_plan(uuid, uuid, date, integer, text, integer, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_today_plan(uuid, uuid, date, integer, text, integer, uuid, text, jsonb, jsonb) to service_role;

create or replace function public.record_today_event(
  p_user_id uuid,
  p_operation_id text,
  p_plan_id uuid,
  p_event jsonb,
  p_session jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_operation uuid;
  stored_plan jsonb;
  existing_session public.today_sessions%rowtype;
  target_progress jsonb;
begin
  if (select auth.uid()) is not null and (select auth.uid()) <> p_user_id then
    raise exception 'Today event owner mismatch';
  end if;

  select plan_snapshot into stored_plan
  from public.today_plans
  where id = p_plan_id and user_id = p_user_id
  for update;
  if stored_plan is null then raise exception 'Today plan not found'; end if;

  select * into existing_session from public.today_sessions
  where user_id = p_user_id and plan_id = p_plan_id
  for update;

  insert into public.sync_operations (user_id, operation_id, operation_kind, entity_id, entity_version)
  values (p_user_id, p_operation_id, 'today-event', p_plan_id::text, 1)
  on conflict (user_id, operation_id) do nothing
  returning id into inserted_operation;
  if inserted_operation is null then
    if existing_session.id is null then return p_session; end if;
    return pg_catalog.jsonb_build_object(
      'planId', p_plan_id, 'status', existing_session.status, 'currentStage', existing_session.current_stage,
      'completedQuestionIds', coalesce(existing_session.outcomes->'completedQuestionIds', '[]'::jsonb),
      'currentBlock', existing_session.current_block,
      'completedTargetIds', coalesce(existing_session.outcomes->'completedTargetIds', '[]'::jsonb),
      'completedMiniReviewBlocks', coalesce(existing_session.outcomes->'completedMiniReviewBlocks', '[]'::jsonb),
      'finalReviewComplete', coalesce(existing_session.outcomes->'finalReviewComplete', 'false'::jsonb),
      'reviewAccuracy', coalesce(existing_session.outcomes->'reviewAccuracy', '{"correct":0,"total":0}'::jsonb),
      'reviewAnswers', coalesce(existing_session.outcomes->'reviewAnswers', '{}'::jsonb),
      'eventRevision', existing_session.event_revision,
      'targetProgress', coalesce((select pg_catalog.jsonb_object_agg(progress.target_id, pg_catalog.jsonb_build_object(
        'targetId', progress.target_id, 'block', progress.block, 'status', progress.status,
        'currentActivity', progress.current_activity, 'recognitionState', progress.recognition_state,
        'outcomes', progress.outcomes
      )) from public.today_target_progress progress where progress.plan_id = p_plan_id), '{}'::jsonb)
    );
  end if;

  if coalesce(stored_plan->'dailyTargets', '[]'::jsonb) <> '[]'::jsonb
     and p_event->>'expectedRevision' is distinct from coalesce(existing_session.event_revision, 0)::text then
    raise exception using errcode = '40001', message = 'Today session changed on another device; reload progress';
  end if;

  if p_event->>'type' = 'today_started' and existing_session.id is not null then
    raise exception 'Today session has already started';
  end if;
  if p_event->>'type' <> 'today_started' and existing_session.id is null then
    raise exception 'Today session has not started';
  end if;
  if existing_session.id is not null and existing_session.status <> 'active'
     and p_event->>'type' <> 'today_completed' then
    raise exception 'Today session is not active';
  end if;

  if p_event->>'type' in ('target_recognized', 'target_activity_completed', 'review_answered') then
    if not exists (
      select 1 from pg_catalog.jsonb_array_elements(coalesce(stored_plan->'dailyTargets', '[]'::jsonb)) as targets(target)
      where target->>'wordId' = p_event->>'targetId'
        and (target->>'block')::smallint = (p_event->>'block')::smallint
    ) then raise exception 'Today target does not belong to this frozen plan block'; end if;
  end if;

  if p_event->>'type' = 'target_recognized' then
    if existing_session.current_stage <> 'learn'
       or (existing_session.current_block is not null and existing_session.current_block <> (p_event->>'block')::smallint)
       or exists (select 1 from public.today_target_progress progress
         where progress.plan_id = p_plan_id and progress.target_id = p_event->>'targetId'
           and progress.status <> 'not-started') then
      raise exception 'Today target recognition is out of sequence';
    end if;
  elsif p_event->>'type' = 'target_activity_completed' then
    if not exists (select 1 from public.today_target_progress progress
      where progress.plan_id = p_plan_id and progress.target_id = p_event->>'targetId'
        and progress.status = 'active' and progress.current_activity = p_event->>'activity'
        and progress.block = (p_event->>'block')::smallint
        and progress.block = existing_session.current_block) then
      raise exception 'Today target activity is out of sequence';
    end if;
  elsif p_event->>'type' = 'mini_review_completed' then
    if (p_event->>'block')::smallint <> existing_session.current_block
       or exists (select 1 from public.today_target_progress progress
         where progress.plan_id = p_plan_id and progress.block = (p_event->>'block')::smallint
           and progress.status <> 'complete') then
      raise exception 'Mini Review requires the current block to be complete';
    end if;
  elsif p_event->>'type' = 'final_review_completed' then
    if exists (select 1 from public.today_target_progress progress
      where progress.plan_id = p_plan_id and progress.status <> 'complete')
       or (select count(distinct (item->>'block')::smallint)
           from pg_catalog.jsonb_array_elements(coalesce(stored_plan->'dailyTargets', '[]'::jsonb)) as items(item))
          <> pg_catalog.jsonb_array_length(coalesce(existing_session.outcomes->'completedMiniReviewBlocks', '[]'::jsonb)) then
      raise exception 'Final Review requires all targets and Mini Reviews';
    end if;
  elsif p_event->>'type' = 'today_completed' then
    if coalesce(existing_session.outcomes->>'finalReviewComplete', 'false') <> 'true' then
      raise exception 'Today completion requires Final Review';
    end if;
  end if;

  for target_progress in select value from pg_catalog.jsonb_each(coalesce(p_session->'targetProgress', '{}'::jsonb))
  loop
    insert into public.today_target_progress (
      user_id, plan_id, target_id, block, status, current_activity, recognition_state, outcomes, completed_at
    ) values (
      p_user_id, p_plan_id,
      target_progress->>'targetId',
      (target_progress->>'block')::smallint,
      target_progress->>'status',
      target_progress->>'currentActivity',
      target_progress->>'recognitionState',
      coalesce(target_progress->'outcomes', '{}'::jsonb),
      case when target_progress->>'status' = 'complete' then timezone('utc', now()) else null end
    )
    on conflict (plan_id, target_id) do update set
      status = excluded.status,
      current_activity = excluded.current_activity,
      recognition_state = excluded.recognition_state,
      outcomes = excluded.outcomes,
      completed_at = coalesce(excluded.completed_at, public.today_target_progress.completed_at);
  end loop;

  insert into public.today_sessions (
    user_id, plan_id, status, current_stage, current_block, event_revision, outcomes, completed_at
  ) values (
    p_user_id, p_plan_id, p_session->>'status', p_session->>'currentStage',
    coalesce((p_session->>'currentBlock')::smallint, 1),
    coalesce(existing_session.event_revision, 0) + 1,
    pg_catalog.jsonb_build_object(
      'completedQuestionIds', coalesce(p_session->'completedQuestionIds', '[]'::jsonb),
      'completedTargetIds', coalesce(p_session->'completedTargetIds', '[]'::jsonb),
      'completedMiniReviewBlocks', coalesce(p_session->'completedMiniReviewBlocks', '[]'::jsonb),
      'finalReviewComplete', coalesce(p_session->'finalReviewComplete', 'false'::jsonb),
      'reviewAccuracy', coalesce(p_session->'reviewAccuracy', '{"correct":0,"total":0}'::jsonb),
      'reviewAnswers', coalesce(p_session->'reviewAnswers', '{}'::jsonb),
      'lastEvent', p_event
    ),
    case when p_session->>'status' = 'complete' then timezone('utc', now()) else null end
  )
  on conflict (plan_id) do update set
    status = excluded.status,
    current_stage = excluded.current_stage,
    current_block = excluded.current_block,
    event_revision = excluded.event_revision,
    outcomes = excluded.outcomes,
    completed_at = excluded.completed_at;

  update public.today_plans set
    status = p_session->>'status',
    started_at = coalesce(started_at, timezone('utc', now())),
    completed_at = case when p_session->>'status' = 'complete' then timezone('utc', now()) else completed_at end
  where id = p_plan_id and user_id = p_user_id;

  return p_session || pg_catalog.jsonb_build_object('eventRevision', coalesce(existing_session.event_revision, 0) + 1);
end;
$$;

revoke all on function public.record_today_event(uuid, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_today_event(uuid, text, uuid, jsonb, jsonb) to service_role;
