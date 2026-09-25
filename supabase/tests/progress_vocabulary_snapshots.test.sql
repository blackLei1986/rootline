begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

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

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1',
   'authenticated', 'authenticated', 'progress-owner@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2',
   'authenticated', 'authenticated', 'progress-other@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role service_role;
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
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select results_eq($$ select stable_count from public.progress_vocabulary_snapshots $$,
  array[5], 'owner reads only the owner snapshot');
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
