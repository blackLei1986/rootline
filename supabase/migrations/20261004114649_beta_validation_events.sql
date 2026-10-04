-- Beta evidence is append-only from the authenticated server route. Browser roles may read
-- only their own rows; they cannot insert unchecked data or rewrite prior learning days.
create table public.beta_validation_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check (length(event_key) between 1 and 80),
  learning_date date not null,
  event_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4096),
  deployment_commit text not null check (length(deployment_commit) between 1 and 80),
  recorded_at timestamptz not null default now(),
  primary key (user_id, event_key),
  constraint beta_validation_event_type_matches check (event_type = payload->>'type')
);

create index beta_validation_events_user_date_idx
  on public.beta_validation_events (user_id, learning_date, recorded_at);

alter table public.beta_validation_events enable row level security;
revoke all on public.beta_validation_events from anon, authenticated;
grant select on public.beta_validation_events to authenticated;
grant select, insert on public.beta_validation_events to service_role;

create policy beta_validation_events_select_own on public.beta_validation_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
