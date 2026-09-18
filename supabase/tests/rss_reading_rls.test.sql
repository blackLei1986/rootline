begin;

select plan(8);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'rss-owner@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', 'rss-other@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.feed_sources (id, normalized_feed_url, title)
values ('10000000-0000-0000-0000-000000000001', 'https://example.com/feed.xml', 'Example');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.user_feed_subscriptions (user_id, feed_source_id)
     values ('00000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001') $$,
  'owner can create a subscription'
);

select results_eq(
  $$ select count(*) from public.user_feed_subscriptions $$,
  array[1::bigint],
  'owner sees their subscription'
);

select results_eq(
  $$ select count(*) from public.feed_sources $$,
  array[1::bigint],
  'authenticated users can read shared source metadata'
);

select throws_ok(
  $$ insert into public.feed_sources (normalized_feed_url, title)
     values ('https://attacker.example/feed', 'Forbidden') $$,
  '42501', null,
  'authenticated users cannot write shared sources'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000012","role":"authenticated"}', true);

select results_eq(
  $$ select count(*) from public.user_feed_subscriptions $$,
  array[0::bigint],
  'another user cannot see the owner subscription'
);

select throws_ok(
  $$ insert into public.user_feed_subscriptions (user_id, feed_source_id)
     values ('00000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'another user cannot create a subscription for the owner'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select results_eq(
  $$ select count(*) from public.user_feed_subscriptions $$,
  array[0::bigint],
  'anonymous users cannot read private subscriptions'
);

reset role;
set local role service_role;
select lives_ok(
  $$ insert into public.feed_sources (normalized_feed_url, title)
     values ('https://service.example/feed', 'Service source') $$,
  'service role can write shared sources'
);

select * from finish();
rollback;
