create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  timezone text not null default 'Asia/Shanghai',
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'active', 'complete')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  target_exams text[] not null default '{}',
  daily_time_budget integer not null default 20 check (daily_time_budget in (10, 20, 30)),
  preferred_topics text[] not null default '{}',
  difficulty_preference text not null default 'balanced' check (difficulty_preference in ('comfortable', 'balanced', 'challenging')),
  recommendation_controls jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.word_learning_states (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, word_id)
);

create table public.review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null,
  event_type text not null,
  word_id text,
  session_id text,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, client_event_id)
);

create table public.learner_auxiliary_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  root_progress jsonb not null default '{}'::jsonb,
  daily_stats jsonb not null default '{}'::jsonb,
  calibration jsonb,
  learning_settings jsonb not null default '{}'::jsonb,
  transfer_stats jsonb not null default '{}'::jsonb,
  storage_version integer not null default 2 check (storage_version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.vocabulary_encounters (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  document_kind text not null check (document_kind in ('reading-document', 'article')),
  document_id text not null,
  source_key text,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_encountered_at timestamptz not null,
  last_encountered_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, word_id, document_kind, document_id)
);

create table public.personal_sentences (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text,
  text text not null check (char_length(text) between 1 and 5000),
  target_word_ids text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.today_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  learning_date date not null,
  generation_version integer not null default 1 check (generation_version > 0),
  status text not null default 'not-started' check (status in ('not-started', 'active', 'complete')),
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes <= 180),
  selected_article_id uuid,
  degradation_reason text,
  plan_snapshot jsonb not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, learning_date, generation_version)
);

create table public.today_plan_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.today_plans(id) on delete cascade,
  item_type text not null check (item_type in ('review', 'rapid-scan', 'focus-word', 'reading', 'context-question')),
  position integer not null check (position >= 0),
  content_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id, position)
);

create table public.today_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.today_plans(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'complete')),
  current_stage text not null,
  actual_seconds integer not null default 0 check (actual_seconds >= 0),
  outcomes jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plan_id)
);

create table public.reading_documents (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  source_type text not null,
  document_text text not null,
  analysis jsonb not null,
  analysis_version text not null,
  document_created_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table public.reading_progress (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  progress jsonb not null,
  version integer not null default 1 check (version > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, document_id),
  foreign key (user_id, document_id) references public.reading_documents(user_id, id) on delete cascade
);

create table public.migration_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_installation_id text not null,
  schema_version integer not null check (schema_version > 0),
  status text not null default 'pending' check (status in ('pending', 'running', 'partial', 'complete', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  entity_counts jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_installation_id, schema_version)
);

create table public.migration_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.migration_batches(id) on delete cascade,
  entity_type text not null,
  legacy_id text not null,
  content_hash text not null,
  result text not null check (result in ('imported', 'skipped', 'failed')),
  error_category text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (batch_id, entity_type, legacy_id)
);

create table public.sync_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null,
  operation_kind text not null check (operation_kind in ('word-state', 'learning-event', 'learner-auxiliary', 'reading-document', 'reading-progress', 'personal-sentence', 'today-plan', 'today-event')),
  entity_id text not null,
  entity_version integer not null check (entity_version > 0),
  applied_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, operation_id)
);

create index review_events_user_occurred_idx on public.review_events (user_id, occurred_at desc);
create index vocabulary_encounters_user_word_idx on public.vocabulary_encounters (user_id, word_id);
create index today_plans_user_date_idx on public.today_plans (user_id, learning_date desc);
create index reading_documents_user_created_idx on public.reading_documents (user_id, document_created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();
create trigger word_states_set_updated_at before update on public.word_learning_states for each row execute function public.set_updated_at();
create trigger learner_auxiliary_set_updated_at before update on public.learner_auxiliary_state for each row execute function public.set_updated_at();
create trigger encounters_set_updated_at before update on public.vocabulary_encounters for each row execute function public.set_updated_at();
create trigger personal_sentences_set_updated_at before update on public.personal_sentences for each row execute function public.set_updated_at();
create trigger today_plans_set_updated_at before update on public.today_plans for each row execute function public.set_updated_at();
create trigger today_items_set_updated_at before update on public.today_plan_items for each row execute function public.set_updated_at();
create trigger today_sessions_set_updated_at before update on public.today_sessions for each row execute function public.set_updated_at();
create trigger reading_documents_set_updated_at before update on public.reading_documents for each row execute function public.set_updated_at();
create trigger reading_progress_set_updated_at before update on public.reading_progress for each row execute function public.set_updated_at();
create trigger migration_batches_set_updated_at before update on public.migration_batches for each row execute function public.set_updated_at();
create trigger migration_items_set_updated_at before update on public.migration_items for each row execute function public.set_updated_at();
create trigger sync_operations_set_updated_at before update on public.sync_operations for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_preferences', 'word_learning_states', 'learner_auxiliary_state', 'vocabulary_encounters',
    'personal_sentences', 'today_plans', 'today_plan_items', 'today_sessions',
    'reading_documents', 'reading_progress', 'migration_batches', 'migration_items'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name || '_delete_own', table_name);
  end loop;

  foreach table_name in array array['review_events', 'sync_operations'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name || '_insert_own', table_name);
  end loop;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;

create or replace function public.apply_sync_operation(
  p_user_id uuid,
  p_operation_id text,
  p_kind text,
  p_entity_id text,
  p_version integer,
  p_payload jsonb
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  inserted_operation uuid;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise insufficient_privilege using message = 'sync owner mismatch';
  end if;

  insert into public.sync_operations (
    user_id, operation_id, operation_kind, entity_id, entity_version
  ) values (
    p_user_id, p_operation_id, p_kind, p_entity_id, p_version
  )
  on conflict (user_id, operation_id) do nothing
  returning id into inserted_operation;

  if inserted_operation is null then
    return false;
  end if;

  case p_kind
    when 'word-state' then
      insert into public.word_learning_states (
        user_id, word_id, state, version, client_updated_at
      ) values (
        p_user_id, p_entity_id, p_payload, p_version, timezone('utc', now())
      )
      on conflict (user_id, word_id) do update set
        state = excluded.state,
        version = excluded.version,
        client_updated_at = excluded.client_updated_at;
    when 'learning-event' then
      insert into public.review_events (
        user_id, client_event_id, event_type, word_id, session_id, occurred_at, payload
      ) values (
        p_user_id,
        p_payload ->> 'id',
        p_payload ->> 'type',
        p_payload ->> 'wordId',
        p_payload ->> 'sessionId',
        (p_payload ->> 'timestamp')::timestamptz,
        coalesce(p_payload -> 'metadata', '{}'::jsonb)
      )
      on conflict (user_id, client_event_id) do nothing;
    when 'learner-auxiliary' then
      insert into public.learner_auxiliary_state (
        user_id, root_progress, daily_stats, calibration, learning_settings,
        transfer_stats, storage_version, client_updated_at
      ) values (
        p_user_id,
        coalesce(p_payload -> 'roots', '{}'::jsonb),
        coalesce(p_payload -> 'dailyStats', '{}'::jsonb),
        p_payload -> 'calibration',
        coalesce(p_payload -> 'settings', '{}'::jsonb),
        coalesce(p_payload -> 'transferStats', '{}'::jsonb),
        coalesce((p_payload ->> 'version')::integer, 2),
        timezone('utc', now())
      )
      on conflict (user_id) do update set
        root_progress = excluded.root_progress,
        daily_stats = excluded.daily_stats,
        calibration = excluded.calibration,
        learning_settings = excluded.learning_settings,
        transfer_stats = excluded.transfer_stats,
        storage_version = excluded.storage_version,
        client_updated_at = excluded.client_updated_at;
    when 'reading-document' then
      insert into public.reading_documents (
        user_id, id, title, source_type, document_text, analysis,
        analysis_version, document_created_at
      ) values (
        p_user_id,
        p_entity_id,
        p_payload ->> 'title',
        p_payload ->> 'sourceType',
        p_payload ->> 'text',
        p_payload,
        p_payload ->> 'analysisVersion',
        (p_payload ->> 'createdAt')::timestamptz
      )
      on conflict (user_id, id) do update set
        title = excluded.title,
        source_type = excluded.source_type,
        document_text = excluded.document_text,
        analysis = excluded.analysis,
        analysis_version = excluded.analysis_version,
        document_created_at = excluded.document_created_at;
    when 'reading-progress' then
      insert into public.reading_progress (
        user_id, document_id, progress, version, client_updated_at
      ) values (
        p_user_id, p_entity_id, p_payload, p_version, timezone('utc', now())
      )
      on conflict (user_id, document_id) do update set
        progress = excluded.progress,
        version = excluded.version,
        client_updated_at = excluded.client_updated_at;
    when 'personal-sentence' then
      insert into public.personal_sentences (
        id, user_id, document_id, text, target_word_ids, created_at
      ) values (
        p_entity_id,
        p_user_id,
        p_payload ->> 'documentId',
        p_payload ->> 'text',
        coalesce(
          array(select jsonb_array_elements_text(p_payload -> 'targetWordIds')),
          '{}'::text[]
        ),
        (p_payload ->> 'createdAt')::timestamptz
      )
      on conflict (id) do update set
        text = excluded.text,
        target_word_ids = excluded.target_word_ids;
    else
      raise exception 'unsupported sync kind: %', p_kind;
  end case;

  return true;
end;
$$;

revoke all on function public.apply_sync_operation(uuid, text, text, text, integer, jsonb) from public;
grant execute on function public.apply_sync_operation(uuid, text, text, text, integer, jsonb) to authenticated;
