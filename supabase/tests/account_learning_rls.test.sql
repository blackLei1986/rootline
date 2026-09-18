begin;

select plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.word_learning_states (user_id, word_id, state)
     values ('00000000-0000-0000-0000-000000000001', 'inspect', '{}'::jsonb) $$,
  'owner can insert a word state'
);

select results_eq(
  $$ select count(*) from public.word_learning_states $$,
  array[1::bigint],
  'owner sees their word state'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select results_eq(
  $$ select count(*) from public.word_learning_states $$,
  array[0::bigint],
  'another user cannot see the owner row'
);

select throws_ok(
  $$ insert into public.word_learning_states (user_id, word_id, state)
     values ('00000000-0000-0000-0000-000000000001', 'analyze', '{}'::jsonb) $$,
  '42501',
  null,
  'another user cannot insert for the owner'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$ select count(*) from public.word_learning_states $$,
  array[0::bigint],
  'anonymous users cannot see private rows'
);

select * from finish();
rollback;
