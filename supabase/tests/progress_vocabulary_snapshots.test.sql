begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

select has_table('public', 'progress_vocabulary_snapshots', 'observed growth has a private daily snapshot table');
select ok((select relrowsecurity from pg_class
  where oid = 'public.progress_vocabulary_snapshots'::regclass), 'snapshot RLS is enabled');
select ok(has_table_privilege('authenticated', 'public.progress_vocabulary_snapshots', 'select'),
  'authenticated users can read their own snapshots');
select ok(not has_table_privilege('authenticated', 'public.progress_vocabulary_snapshots', 'insert'),
  'authenticated users cannot write snapshots');
select ok(not has_table_privilege('authenticated', 'public.progress_vocabulary_snapshots', 'update'),
  'authenticated users cannot change snapshots');
select ok(not has_table_privilege('anon', 'public.progress_vocabulary_snapshots', 'select'),
  'anonymous users cannot read snapshots');
select ok(has_table_privilege('service_role', 'public.progress_vocabulary_snapshots', 'select,insert,update'),
  'server role can read and upsert snapshots');
select ok(not has_function_privilege('authenticated', 'public.progress_passive_word_ids(uuid)', 'execute'),
  'authenticated users cannot call lifetime evidence helper');
select ok(has_function_privilege('service_role', 'public.progress_passive_word_ids(uuid)', 'execute'),
  'server role can call lifetime evidence helper');
select ok(not has_function_privilege('authenticated',
  'public.progress_record_stable_snapshot(uuid,date,integer,text,timestamptz)', 'execute'),
  'authenticated users cannot write through the snapshot helper');
select ok(has_function_privilege('service_role',
  'public.progress_record_stable_snapshot(uuid,date,integer,text,timestamptz)', 'execute'),
  'server role can atomically record observed stable count');
select ok(not has_function_privilege('authenticated', 'public.progress_word_state_snapshot(uuid)', 'execute'),
  'authenticated users cannot fetch the entire word-state snapshot');
select ok(has_function_privilege('service_role', 'public.progress_word_state_snapshot(uuid)', 'execute'),
  'server role can fetch a consistent word-state snapshot');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1',
   'authenticated', 'authenticated', 'progress-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2',
   'authenticated', 'authenticated', 'progress-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role service_role;
insert into public.word_learning_states (user_id,word_id,state)
select '00000000-0000-0000-0000-0000000000a1', 'progress-state-' || n, '{}'::jsonb
from generate_series(1,1001) as n;
insert into public.word_learning_states (user_id,word_id,state)
values ('00000000-0000-0000-0000-0000000000a2','other-state','{}'::jsonb);
select is((select count(*) from jsonb_object_keys(public.progress_word_state_snapshot(
  '00000000-0000-0000-0000-0000000000a1')->'states')), 1001::bigint,
  'single statement returns beyond the PostgREST thousand-row boundary');
select ok((public.progress_word_state_snapshot(
  '00000000-0000-0000-0000-0000000000a1')->>'observedAt')::timestamptz is not null,
  'word-state snapshot carries its database observation timestamp');
insert into public.progress_vocabulary_snapshots (user_id, learning_date, stable_count, catalog_version)
values
  ('00000000-0000-0000-0000-0000000000a1', '2026-09-25', 4, 'test-catalog'),
  ('00000000-0000-0000-0000-0000000000a2', '2026-09-25', 9, 'test-catalog');
insert into public.progress_vocabulary_snapshots (user_id, learning_date, stable_count, catalog_version)
values ('00000000-0000-0000-0000-0000000000a1', '2026-09-25', 5, 'test-catalog')
on conflict (user_id, learning_date) do update set stable_count = excluded.stable_count,
  catalog_version = excluded.catalog_version, captured_at = now();
select results_eq($$ select stable_count from public.progress_vocabulary_snapshots
  where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  array[5], 'daily upsert replaces one owner observation');
select throws_ok($$ insert into public.progress_vocabulary_snapshots
  (user_id, learning_date, stable_count, catalog_version)
  values ('00000000-0000-0000-0000-0000000000a1', '2026-09-26', -1, 'test-catalog') $$,
  '23514', null, 'negative stable count is rejected');
insert into public.review_events (user_id, client_event_id, event_type, word_id, occurred_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'progress-a-seen', 'reading_encounter', 'adapt', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'progress-a-lookup', 'reading_lookup', 'adapt', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'progress-a-answer', 'quiz_correct', 'inspect', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'progress-b-seen', 'reading_encounter', 'secret', now());
select results_eq($$ select word_id from public.progress_passive_word_ids(
  '00000000-0000-0000-0000-0000000000a1') $$, array['adapt'::text],
  'server sees distinct passive IDs for the requested account only');
select results_eq($$ select word_id from public.progress_passive_word_ids(
  '00000000-0000-0000-0000-0000000000a2') $$, array['secret'::text],
  'second account receives only its own passive ID');
insert into public.vocabulary_encounters
  (user_id,word_id,document_kind,document_id,first_encountered_at,last_encountered_at)
values
  ('00000000-0000-0000-0000-0000000000a1','article-only','article','article-a',now(),now()),
  ('00000000-0000-0000-0000-0000000000a1','adapt','article','article-a',now(),now()),
  ('00000000-0000-0000-0000-0000000000a2','other-article','article','article-b',now(),now());
select results_eq($$ select word_id from public.progress_passive_word_ids(
  '00000000-0000-0000-0000-0000000000a1') order by word_id $$,
  array['adapt'::text,'article-only'::text],
  'completed article encounter is counted once alongside event evidence');
select is(public.progress_record_stable_snapshot(
  '00000000-0000-0000-0000-0000000000a1','2026-09-26',7,'test-catalog','2026-09-26T12:00:00Z'),
  true, 'newer stable observation is stored');
select is(public.progress_record_stable_snapshot(
  '00000000-0000-0000-0000-0000000000a1','2026-09-26',3,'test-catalog','2026-09-26T11:00:00Z'),
  false, 'stale concurrent observation is ignored');
select results_eq($$ select stable_count from public.progress_vocabulary_snapshots
  where user_id='00000000-0000-0000-0000-0000000000a1' and learning_date='2026-09-26' $$,
  array[7], 'stale request cannot overwrite the newer stable count');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select results_eq($$ select stable_count from public.progress_vocabulary_snapshots order by learning_date $$,
  array[5,7], 'owner reads only the owner snapshots');
select throws_ok($$ insert into public.progress_vocabulary_snapshots
  (user_id, learning_date, stable_count, catalog_version)
  values ('00000000-0000-0000-0000-0000000000a1', '2026-09-26', 1, 'forged') $$,
  '42501', null, 'authenticated owner cannot insert');
select throws_ok($$ update public.progress_vocabulary_snapshots set stable_count = 999
  where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null, 'authenticated owner cannot update');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select results_eq($$ select stable_count from public.progress_vocabulary_snapshots $$,
  array[9], 'second account cannot read the first account snapshot');
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select count(*) from public.progress_vocabulary_snapshots $$,
  '42501', null, 'anonymous user cannot query snapshots');
reset role;

select is((select count(*) from public.today_plans
  where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  0::bigint, 'snapshot tests never alter Today plans');
select is((select count(*) from public.today_sessions
  where user_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  0::bigint, 'snapshot tests never alter Today sessions');

select * from finish();
rollback;
