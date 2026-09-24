begin;

select plan(19);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated', 'reading-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000022', 'authenticated', 'authenticated', 'reading-other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_reading_recommendation_sets'::regclass),
  'recommendation snapshots have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.daily_reading_recommendation_sets', 'select,insert,update,delete'),
  'anonymous role has no table privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.daily_reading_recommendation_sets', 'select'),
  'authenticated role can read through its owner policy'
);
select ok(
  not has_table_privilege('authenticated', 'public.daily_reading_recommendation_sets', 'insert,update,delete'),
  'authenticated role cannot write snapshots'
);
select is(
  to_regclass('public.curated_reading_sources')::text,
  null::text,
  'curated source registry is code-managed, not a client-writable table'
);

set local role service_role;
select lives_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, generated_at, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-24', 'daily-3-v1',
       '2026-09-24T12:00:00Z',
       '[{"articleId":"article-1","title":"Science report","publisherUrl":"https://example.org/report","summary":"Short summary","matchedTodayWordIds":["word-1"],"matchedRecentWordIds":["word-2"],"scores":{"total":75},"reasonCodes":["today-target-match"]}]'::jsonb
     ) $$,
  'server role can persist a non-empty recommendation snapshot'
);
select ok(
  not exists (
    select 1 from public.daily_reading_recommendation_sets
    where recommendations::text ilike '%extracted_text%'
  ),
  'persisted recommendation snapshots contain no extracted full-text field'
);
select throws_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-25', 'daily-3-v1', '[]'::jsonb
     ) $$,
  '23514', null,
  'empty recommendation sets cannot be frozen'
);
select throws_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-25', 'daily-3-v1', '[{}, {}, {}, {}]'::jsonb
     ) $$,
  '23514', null,
  'recommendation sets are capped at three items'
);
select lives_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-24', 'daily-3-v2', '[{"articleId":"replacement"}]'::jsonb
     ) on conflict (user_id, learning_date) do nothing $$,
  'same-date first-writer-wins insert is idempotent under conflict'
);
select results_eq(
  $$ select algorithm_version from public.daily_reading_recommendation_sets
     where user_id = '00000000-0000-0000-0000-000000000021' and learning_date = '2026-09-24' $$,
  array['daily-3-v1'::text],
  'same-date conflict leaves the first snapshot unchanged'
);
select lives_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-25', 'daily-3-v1', '[{"articleId":"next-day"}]'::jsonb
     ) $$,
  'new learning date can receive a distinct snapshot'
);
select results_eq(
  $$ select count(*) from public.daily_reading_recommendation_sets
     where user_id = '00000000-0000-0000-0000-000000000021' $$,
  array[2::bigint],
  'snapshots are unique per user and learning date'
);
select throws_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-24', 'daily-3-v2', '[{"articleId":"duplicate"}]'::jsonb
     ) $$,
  '23505', null,
  'duplicate user/date keys are rejected without an explicit conflict action'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000021","role":"authenticated"}', true);
select results_eq(
  $$ select count(*) from public.daily_reading_recommendation_sets $$,
  array[2::bigint],
  'owner can read both of their date snapshots'
);
select throws_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-26', 'daily-3-v1', '[{"articleId":"client"}]'::jsonb
     ) $$,
  '42501', null,
  'owner cannot write snapshots from an authenticated client'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000022","role":"authenticated"}', true);
select results_eq(
  $$ select count(*) from public.daily_reading_recommendation_sets $$,
  array[0::bigint],
  'another user cannot see the owner''s snapshots'
);
select throws_ok(
  $$ insert into public.daily_reading_recommendation_sets (
       user_id, learning_date, algorithm_version, recommendations
     ) values (
       '00000000-0000-0000-0000-000000000021', '2026-09-26', 'daily-3-v1', '[{"articleId":"cross-user"}]'::jsonb
     ) $$,
  '42501', null,
  'another user cannot write for the owner'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.daily_reading_recommendation_sets $$,
  '42501', null,
  'anonymous role cannot read private recommendation snapshots'
);

select * from finish();
rollback;
