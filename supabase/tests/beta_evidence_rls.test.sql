begin;

select plan(9);
select has_table('public', 'beta_validation_events', 'append-only Beta evidence table exists');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.beta_validation_events'::regclass), 'Beta evidence has RLS enabled');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000051', 'authenticated', 'authenticated', 'beta-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000052', 'authenticated', 'authenticated', 'beta-other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role service_role;
insert into public.beta_validation_events (user_id, event_key, learning_date, event_type, payload, deployment_commit) values
  ('00000000-0000-0000-0000-000000000051', 'event:550e8400-e29b-41d4-a716-446655440051', '2026-10-04', 'today-open', '{"type":"today-open"}'::jsonb, 'test-commit'),
  ('00000000-0000-0000-0000-000000000052', 'event:550e8400-e29b-41d4-a716-446655440052', '2026-10-04', 'journal', '{"type":"journal","note":"private"}'::jsonb, 'test-commit');
insert into public.beta_validation_events (user_id, event_key, learning_date, event_type, payload, deployment_commit)
values ('00000000-0000-0000-0000-000000000051', 'event:550e8400-e29b-41d4-a716-446655440051', '2026-10-04', 'today-open', '{"type":"today-open"}'::jsonb, 'test-commit')
on conflict (user_id, event_key) do nothing;
select is((select count(*) from public.beta_validation_events where user_id = '00000000-0000-0000-0000-000000000051'), 1::bigint, 'retries do not duplicate an event');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000051","role":"authenticated"}', true);
select is((select count(*) from public.beta_validation_events), 1::bigint, 'owner reads only own evidence');
select throws_ok($$ insert into public.beta_validation_events (user_id, event_key, learning_date, event_type, payload, deployment_commit)
  values ('00000000-0000-0000-0000-000000000051', 'event:550e8400-e29b-41d4-a716-446655440053', '2026-10-04', 'today-open', '{}'::jsonb, 'spoof') $$,
  '42501', null, 'browser role cannot bypass server validation by direct insert');
select throws_ok($$ update public.beta_validation_events set payload = '{}'::jsonb $$,
  '42501', null, 'browser role cannot overwrite evidence');
select throws_ok($$ delete from public.beta_validation_events $$,
  '42501', null, 'browser role cannot delete evidence');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000052","role":"authenticated"}', true);
select is((select count(*) from public.beta_validation_events), 1::bigint, 'second account sees only its own Journal');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select count(*) from public.beta_validation_events $$, '42501', null, 'anonymous role cannot read Beta evidence');

select * from finish();
rollback;
