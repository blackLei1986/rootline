begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

select has_table(
  'public',
  'reading_reinforcement_sessions',
  'reading practice has a durable private session table'
);

select ok((select relrowsecurity from pg_class where oid = 'public.reading_reinforcement_sessions'::regclass),
  'raw exercise sessions have RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.reading_reinforcement_sessions', 'select,insert,update,delete'),
  'authenticated clients have no raw answer-key access');
select ok(not has_table_privilege('anon', 'public.reading_reinforcement_sessions', 'select,insert,update,delete'),
  'anonymous clients have no raw answer-key access');
select ok(not has_function_privilege('authenticated',
  'public.apply_reading_answer(uuid,uuid,text,integer,text,integer,text,text,boolean,text,jsonb,jsonb,integer)', 'execute'),
  'authenticated clients cannot call the answer transaction');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000091',
  'authenticated', 'authenticated', 'reinforcement-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.articles (id, canonical_url, publisher_url, title, summary)
values ('00000000-0000-0000-0000-000000000092', 'https://example.org/reading-2c',
  'https://example.org/reading-2c', 'Article', 'They adapted quickly.');

set local role service_role;
select lives_ok($$
  insert into public.reading_reinforcement_sessions
    (id, user_id, article_id, learning_date, questions)
  values
    ('00000000-0000-0000-0000-000000000093', '00000000-0000-0000-0000-000000000091',
     '00000000-0000-0000-0000-000000000092', '2026-09-25',
     '[{"id":"q1","wordId":"adapt","type":"cloze","correctDisplay":"adapted"}]'::jsonb)
$$, 'server can create a private frozen set');
select throws_ok($$
  insert into public.reading_reinforcement_sessions (user_id, article_id, learning_date, questions)
  values ('00000000-0000-0000-0000-000000000091',
    '00000000-0000-0000-0000-000000000092', '2026-09-26',
    '[{"id":"q2","wordId":"adapt"}]'::jsonb)
$$, '23505', null, 'one article cannot mint a second credit set');

select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000093',
    'q1', 0, 'adapt', 0,
    'reading-answer:00000000-0000-0000-0000-000000000093:q1',
    'adapted', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"adapt","readingRevision":1,"reviewCount":1}'::jsonb, -1
  ) ->> 'kind'), 'accepted', 'first answer commits');
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000093',
    'q1', 0, 'adapt', 0,
    'reading-answer:00000000-0000-0000-0000-000000000093:q1',
    'adapted', true, 'quiz_correct', '{"mode":"reading-cloze"}'::jsonb,
    '{"wordId":"adapt","readingRevision":1,"reviewCount":1}'::jsonb, -1
  ) ->> 'kind'), 'duplicate', 'replayed answer returns saved result');
select results_eq($$
  select count(*) from public.review_events
  where client_event_id = 'reading-answer:00000000-0000-0000-0000-000000000093:q1'
$$, array[1::bigint], 'replay creates only one event');
select results_eq($$
  select (state ->> 'readingRevision')::integer from public.word_learning_states
  where user_id = '00000000-0000-0000-0000-000000000091' and word_id = 'adapt'
$$, array[1], 'replay advances word state only once');
insert into public.articles (id, canonical_url, publisher_url, title, summary)
values ('00000000-0000-0000-0000-000000000094', 'https://example.org/reading-2c-next',
  'https://example.org/reading-2c-next', 'Another article', 'They adapted again.');
insert into public.reading_reinforcement_sessions (id, user_id, article_id, learning_date, questions)
values ('00000000-0000-0000-0000-000000000095', '00000000-0000-0000-0000-000000000091',
  '00000000-0000-0000-0000-000000000094', '2026-09-26',
  '[{"id":"q2","wordId":"adapt","type":"recall","correctDisplay":"adapt"}]'::jsonb);
select is(
  (public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000095',
    'q2', 0, 'adapt', 0,
    'reading-answer:00000000-0000-0000-0000-000000000095:q2',
    'adapt', true, 'quiz_correct', '{"mode":"reading-recall"}'::jsonb,
    '{"wordId":"adapt","readingRevision":1,"reviewCount":1}'::jsonb, 0
  ) ->> 'kind'), 'conflict', 'stale word revision cannot claim a second session');
select results_eq($$
  select cursor from public.reading_reinforcement_sessions
  where id = '00000000-0000-0000-0000-000000000095'
$$, array[0], 'conflict does not advance the new cursor');
select results_eq($$
  select count(*) from public.review_events
  where client_event_id like 'reading-answer:%'
$$, array[1::bigint], 'conflict does not insert partial answer evidence');
select throws_ok($$
  select public.apply_reading_answer(
    '00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000093',
    'q1', 0, 'adapt', 0, 'reading-answer:forged', 'adapted', true,
    'quiz_correct', '{}'::jsonb, '{"wordId":"adapt","readingRevision":1}'::jsonb, 0)
$$, 'P0002', null, 'foreign owner cannot claim a session');
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000091","role":"authenticated"}', true);
select throws_ok($$ select count(*) from public.reading_reinforcement_sessions $$,
  '42501', null, 'owner cannot read raw keys with a client token');
select throws_ok($$
  insert into public.review_events
    (user_id, client_event_id, event_type, word_id, occurred_at)
  values ('00000000-0000-0000-0000-000000000091',
    'reading-forged', 'quiz_correct', 'adapt', now())
$$, '42501', null, 'authenticated client cannot forge server Reading evidence');

select * from finish();
rollback;
