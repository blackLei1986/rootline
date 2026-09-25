begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);
select has_function('public', 'apply_guarded_word_state',
  array['uuid','text','text','integer','jsonb'],
  'server-only guarded word-state function exists');
select ok(not has_table_privilege('authenticated', 'public.word_learning_states', 'insert,update,delete'),
  'authenticated clients cannot bypass the revision guard');
select ok(not has_function_privilege('authenticated',
  'public.apply_guarded_word_state(uuid,text,text,integer,jsonb)', 'execute'),
  'authenticated clients cannot call the server-only word-state function');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000081',
  'authenticated', 'authenticated', 'revision-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local role service_role;
select is(public.apply_guarded_word_state(
  '00000000-0000-0000-0000-000000000081', 'initial', 'adapt', 1,
  '{"wordId":"adapt","readingRevision":0,"reviewCount":0}'::jsonb), true,
  'initial legacy revision-zero state can sync');
select is(public.apply_guarded_word_state(
  '00000000-0000-0000-0000-000000000081', 'initial', 'adapt', 1,
  '{"wordId":"adapt","readingRevision":0,"reviewCount":0}'::jsonb), false,
  'same operation ID is idempotent');
do $$ begin perform set_config('rootline.expected_word_revision', '0', true); end $$;
update public.word_learning_states
set state = '{"wordId":"adapt","readingRevision":1,"reviewCount":1}'::jsonb
where user_id = '00000000-0000-0000-0000-000000000081' and word_id = 'adapt';
do $$ begin perform set_config('rootline.expected_word_revision', '', true); end $$;
select throws_ok($$
  select public.apply_guarded_word_state(
    '00000000-0000-0000-0000-000000000081', 'stale', 'adapt', 2,
    '{"wordId":"adapt","readingRevision":0,"reviewCount":0}'::jsonb)
$$, 'P0001', 'READING_REVISION_CONFLICT', 'stale whole-state upload is rejected');
select results_eq($$
  select count(*) from public.sync_operations
  where user_id = '00000000-0000-0000-0000-000000000081' and operation_id = 'stale'
$$, array[0::bigint], 'rejected snapshot leaves no applied-operation receipt');
select results_eq($$
  select (state ->> 'readingRevision')::integer from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000081' and word_id = 'adapt'
$$, array[1], 'rejected snapshot leaves Reading credit intact');

select * from finish();
rollback;
