create table public.daily_reading_recommendation_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  algorithm_version text not null check (length(btrim(algorithm_version)) between 1 and 64),
  generated_at timestamptz not null default now(),
  recommendations jsonb not null,
  constraint daily_reading_recommendation_sets_pkey primary key (user_id, learning_date),
  constraint daily_reading_recommendation_sets_nonempty_array check (
    case
      when jsonb_typeof(recommendations) = 'array'
        then jsonb_array_length(recommendations) between 1 and 3
      else false
    end
  ),
  constraint daily_reading_recommendation_sets_payload_size check (pg_column_size(recommendations) <= 65536)
);

alter table public.daily_reading_recommendation_sets enable row level security;

revoke all on table public.daily_reading_recommendation_sets from public, anon, authenticated;
grant select on table public.daily_reading_recommendation_sets to authenticated;
grant select, insert, update, delete on table public.daily_reading_recommendation_sets to service_role;

create policy "Users can read their daily reading recommendation snapshots"
  on public.daily_reading_recommendation_sets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
