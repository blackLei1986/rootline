begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select has_column('public', 'word_learning_states', 'state_revision',
  'word rows have a server-owned revision');
select ok(not has_function_privilege('authenticated',
  'public.apply_reading_answer(uuid,uuid,text,integer,text,integer,text,text,boolean,text,jsonb,jsonb,integer)', 'execute'),
  'clients cannot forge an expected server revision');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000071',
  'authenticated', 'authenticated', 'cas-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.articles (id, canonical_url, publisher_url, title, summary)
values ('00000000-0000-0000-0000-000000000072', 'https://example.org/reading-cas',
  'https://example.org/reading-cas', 'Article', 'They adapted quickly.');

set local role service_role;
insert into public.reading_reinforcement_sessions
  (id, user_id, article_id, learning_date, questions)
values
  ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000071',
   '00000000-0000-0000-0000-000000000072', '2026-09-25',
   '[{"id":"q1","wordId":"adapt","type":"cloze","correctDisplay":"adapted"}]'::jsonb);
select is(public.apply_guarded_word_state(
  '00000000-0000-0000-0000-000000000071', 'initial-cas', 'adapt', 1,
  '{"wordId":"adapt","readingRevision":0,"reviewCount":0,"knownCount":0}'::jsonb), true,
  'initial snapshot syncs');
select is(public.apply_guarded_word_state(
  '00000000-0000-0000-0000-000000000071', 'ordinary-edit', 'adapt', 2,
  '{"wordId":"adapt","readingRevision":0,"reviewCount":0,"knownCount":4}'::jsonb), true,
  'ordinary word edit commits with the same Reading revision');
select results_eq($$
  select state_revision from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'adapt'
$$, array[1], 'ordinary edit increments the server revision');
select throws_ok($$
  update public.word_learning_states
  set state = '{"wordId":"adapt","readingRevision":1,"knownCount":0}'::jsonb
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'adapt'
$$, 'P0001', 'WORD_STATE_REVISION_CONFLICT',
  'a raw Reading revision increase cannot bypass the answer CAS');
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000073',
    'q1', 0, 'adapt', 0,
    'reading-answer:00000000-0000-0000-0000-000000000073:q1',
    'adapted', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"adapt","readingRevision":1,"reviewCount":1,"knownCount":0}'::jsonb, 0
  ) ->> 'kind'), 'conflict', 'stale computed answer cannot overwrite an ordinary edit');
select results_eq($$
  select (state ->> 'knownCount')::integer from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'adapt'
$$, array[4], 'conflict preserves the ordinary edit');
select results_eq($$
  select count(*) from public.review_events
  where client_event_id = 'reading-answer:00000000-0000-0000-0000-000000000073:q1'
$$, array[0::bigint], 'conflict leaves no answer event');
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000073',
    'q1', 0, 'adapt', 0,
    'reading-answer:00000000-0000-0000-0000-000000000073:q1',
    'adapted', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"adapt","readingRevision":1,"reviewCount":1,"knownCount":4}'::jsonb, 1
  ) ->> 'kind'), 'accepted', 'retry against the latest word revision succeeds');
select results_eq($$
  select state_revision from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'adapt'
$$, array[2], 'Reading answer increments the same server revision');
select throws_ok($$
  update public.word_learning_states
  set state = '{"wordId":"adapt","readingRevision":0,"knownCount":0}'::jsonb
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'adapt'
$$, 'P0001', 'WORD_STATE_REVISION_CONFLICT',
  'raw writes cannot downgrade saved Reading credit');

insert into public.articles (id, canonical_url, publisher_url, title, summary)
values ('00000000-0000-0000-0000-000000000074', 'https://example.org/reading-cas-new-row',
  'https://example.org/reading-cas-new-row', 'New word', 'They inspected carefully.');
insert into public.reading_reinforcement_sessions
  (id, user_id, article_id, learning_date, questions)
values
  ('00000000-0000-0000-0000-000000000075', '00000000-0000-0000-0000-000000000071',
   '00000000-0000-0000-0000-000000000074', '2026-09-25',
   '[{"id":"q2","wordId":"inspect","type":"cloze","correctDisplay":"inspected"}]'::jsonb);
select is(public.apply_guarded_word_state(
  '00000000-0000-0000-0000-000000000071', 'concurrent-first-insert', 'inspect', 1,
  '{"wordId":"inspect","readingRevision":0,"reviewCount":0,"knownCount":4}'::jsonb), true,
  'ordinary sync inserts a formerly absent word after an empty snapshot');
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000075',
    'q2', 0, 'inspect', 0,
    'reading-answer:00000000-0000-0000-0000-000000000075:q2',
    'inspected', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"inspect","readingRevision":1,"reviewCount":1,"knownCount":0}'::jsonb, -1
  ) ->> 'kind'), 'conflict', 'no-row snapshot cannot overwrite a concurrent first insert');
select results_eq($$
  select (state ->> 'knownCount')::integer from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000071' and word_id = 'inspect'
$$, array[4], 'first-insert conflict preserves the newly synced state');
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000075',
    'q2', 0, 'inspect', 0,
    'reading-answer:00000000-0000-0000-0000-000000000075:q2',
    'inspected', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"inspect","readingRevision":1,"reviewCount":1,"knownCount":4}'::jsonb, 0
  ) ->> 'kind'), 'accepted', 'fresh retry preserves the first insert and grants one Reading answer');

select * from finish();
rollback;
