begin;

select plan(11);

select has_table('public', 'today_target_progress', 'Daily 30 target progress table exists');
select has_column('public', 'today_sessions', 'current_block', 'Today sessions persist the current block');
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.today_target_progress'::regclass),
  'target progress has row-level security enabled'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000031', 'authenticated', 'authenticated', 'today-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000032', 'authenticated', 'authenticated', 'today-other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

reset role;
set local role service_role;
insert into public.today_plans (
  id, user_id, learning_date, generation_version, status, estimated_minutes, plan_snapshot
) values (
  '20000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000031',
  '2026-09-23', 1, 'not-started', 20,
  '{"dailyTargets":[{"wordId":"target-1","block":1}],"stable":"snapshot"}'::jsonb
);
insert into public.today_target_progress (user_id, plan_id, target_id, block)
values ('00000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000031', 'target-1', 1);

select is(
  public.create_today_plan(
    '00000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000032', '2026-09-23', 2,
    'not-started', 20, null, null, '{"dailyTargets":[],"stable":"replacement"}'::jsonb, '[]'::jsonb
  ),
  '{"dailyTargets":[{"wordId":"target-1","block":1}],"stable":"snapshot"}'::jsonb,
  'same local date returns its frozen plan instead of a new generation'
);

select lives_ok(
  $$ select public.record_today_event(
    '00000000-0000-0000-0000-000000000031', 'today-start-op', '20000000-0000-0000-0000-000000000031',
    '{"type":"today_started","stage":"learn","expectedRevision":0}'::jsonb,
    '{"planId":"20000000-0000-0000-0000-000000000031","status":"active","currentStage":"learn","currentBlock":1,"completedQuestionIds":[],"completedTargetIds":[],"completedMiniReviewBlocks":[],"finalReviewComplete":false,"reviewAccuracy":{"correct":0,"total":0},"reviewAnswers":{},"targetProgress":{}}'::jsonb
  ) $$,
  'session starts before target activity'
);
select lives_ok(
  $$ select public.record_today_event(
    '00000000-0000-0000-0000-000000000031', 'today-target-op-1', '20000000-0000-0000-0000-000000000031',
    '{"type":"target_recognized","targetId":"target-1","block":1,"expectedRevision":1}'::jsonb,
    '{"planId":"20000000-0000-0000-0000-000000000031","status":"active","currentStage":"learn","currentBlock":1,"completedQuestionIds":[],"completedTargetIds":[],"completedMiniReviewBlocks":[],"finalReviewComplete":false,"reviewAccuracy":{"correct":0,"total":0},"reviewAnswers":{},"targetProgress":{"target-1":{"targetId":"target-1","block":1,"status":"active","currentActivity":"learning-card","recognitionState":"fuzzy","outcomes":{}}}}'::jsonb
  ) $$,
  'service transaction persists valid target progress'
);
select public.record_today_event(
  '00000000-0000-0000-0000-000000000031', 'today-target-op-1', '20000000-0000-0000-0000-000000000031',
  '{"type":"target_recognized","targetId":"target-1","block":1,"expectedRevision":1}'::jsonb,
  '{"planId":"20000000-0000-0000-0000-000000000031","status":"active","currentStage":"learn","currentBlock":1,"completedQuestionIds":[],"completedTargetIds":[],"completedMiniReviewBlocks":[],"finalReviewComplete":false,"reviewAccuracy":{"correct":0,"total":0},"targetProgress":{"target-1":{"targetId":"target-1","block":1,"status":"active","currentActivity":"learning-card","recognitionState":"known","outcomes":{}}}}'::jsonb
);
select is(
  (select recognition_state from public.today_target_progress where plan_id = '20000000-0000-0000-0000-000000000031' and target_id = 'target-1'),
  'fuzzy',
  'replayed operation does not overwrite target outcome'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated"}', true);
select results_eq(
  $$ select target_id from public.today_target_progress $$,
  $$ values ('target-1'::text) $$,
  'owner can read their target progress'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000032","role":"authenticated"}', true);
select is(
  (select count(*) from public.today_target_progress),
  0::bigint,
  'another user cannot read target progress'
);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.today_target_progress $$,
  '42501', null,
  'anonymous users have no table grant'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000031","role":"authenticated"}', true);
select throws_ok(
  $$ update public.today_plans set plan_snapshot = '{"changed":true}'::jsonb where id = '20000000-0000-0000-0000-000000000031' $$,
  'P0001', 'Today plan snapshots are immutable',
  'owner cannot mutate a frozen plan snapshot'
);

select * from finish();
rollback;
