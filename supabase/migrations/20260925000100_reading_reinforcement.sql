create table public.reading_reinforcement_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  learning_date date not null,
  status text not null default 'active' check (status in ('active', 'complete')),
  revision integer not null default 0 check (revision >= 0),
  cursor integer not null default 0 check (cursor between 0 and 5),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 5),
  outcomes jsonb not null default '[]'::jsonb check (jsonb_typeof(outcomes) = 'array' and jsonb_array_length(outcomes) <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint reading_reinforcement_owner_article_uq unique (user_id, article_id),
  constraint reading_reinforcement_cursor_matches_outcomes check (cursor = jsonb_array_length(outcomes)),
  constraint reading_reinforcement_completed_consistent check (
    (status = 'complete' and completed_at is not null and cursor = jsonb_array_length(questions))
    or (status = 'active' and completed_at is null and cursor < jsonb_array_length(questions))
  )
);

create index reading_reinforcement_active_owner_idx
  on public.reading_reinforcement_sessions (user_id, updated_at desc)
  where status = 'active';

alter table public.reading_reinforcement_sessions enable row level security;
revoke all on table public.reading_reinforcement_sessions from public, anon, authenticated;
grant select, insert, update on table public.reading_reinforcement_sessions to service_role;

create trigger reading_reinforcement_set_updated_at
  before update on public.reading_reinforcement_sessions
  for each row execute function public.set_updated_at();

-- The existing permissive owner policy is not enough to reserve server-owned
-- Reading evidence. A restrictive policy intersects with it instead of ORing.
create policy review_events_no_direct_reading_evidence
  on public.review_events as restrictive for insert to authenticated
  with check (client_event_id not like 'reading-%');

create or replace function public.apply_reading_answer(
  p_user_id uuid,
  p_session_id uuid,
  p_question_id text,
  p_expected_session_revision integer,
  p_word_id text,
  p_expected_reading_revision integer,
  p_event_id text,
  p_submitted_answer text,
  p_correct boolean,
  p_event_type text,
  p_event_payload jsonb,
  p_next_state jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.reading_reinforcement_sessions%rowtype;
  v_word public.word_learning_states%rowtype;
  v_question jsonb;
  v_previous jsonb;
  v_current_revision integer;
  v_answered_at timestamptz := now();
  v_inserted uuid;
begin
  select * into v_session
  from public.reading_reinforcement_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'reading session not found' using errcode = 'P0002';
  end if;

  select item into v_previous
  from jsonb_array_elements(v_session.outcomes) as item
  where item ->> 'questionId' = p_question_id
  limit 1;
  if v_previous is not null then
    return jsonb_build_object('kind', 'duplicate', 'row', to_jsonb(v_session));
  end if;

  if v_session.revision <> p_expected_session_revision then
    return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
  end if;
  if v_session.status <> 'active' or v_session.cursor >= jsonb_array_length(v_session.questions) then
    raise exception 'reading session is complete' using errcode = '22023';
  end if;
  v_question := v_session.questions -> v_session.cursor;
  if v_question ->> 'id' is distinct from p_question_id
     or v_question ->> 'wordId' is distinct from p_word_id
     or p_event_id is distinct from ('reading-answer:' || p_session_id::text || ':' || p_question_id)
     or p_event_type is distinct from (case when p_correct then 'quiz_correct' else 'quiz_wrong' end)
     or p_submitted_answer is null or length(p_submitted_answer) > 300
     or p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object'
  then
    raise exception 'invalid reading answer' using errcode = '22023';
  end if;

  if p_expected_reading_revision < 0 then
    raise exception 'invalid reading revision' using errcode = '22023';
  end if;
  select * into v_word from public.word_learning_states
    where user_id = p_user_id and word_id = p_word_id for update;
  if not found then
    if p_expected_reading_revision <> 0 then
      return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
    end if;
    insert into public.word_learning_states (user_id, word_id, state)
    values (p_user_id, p_word_id, jsonb_build_object('wordId', p_word_id, 'readingRevision', 0))
    on conflict (user_id, word_id) do nothing;
    select * into v_word from public.word_learning_states
      where user_id = p_user_id and word_id = p_word_id for update;
  end if;
  v_current_revision := coalesce((v_word.state ->> 'readingRevision')::integer, 0);
  if v_current_revision <> p_expected_reading_revision then
    return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
  end if;
  if p_next_state ->> 'wordId' is distinct from p_word_id
     or coalesce((p_next_state ->> 'readingRevision')::integer, -1) <> v_current_revision + 1
  then
    raise exception 'invalid next reading word state' using errcode = '22023';
  end if;

  insert into public.review_events (
    user_id, client_event_id, event_type, word_id, session_id, occurred_at, payload
  ) values (
    p_user_id, p_event_id, p_event_type, p_word_id, p_session_id::text, v_answered_at, p_event_payload
  ) on conflict (user_id, client_event_id) do nothing returning id into v_inserted;
  if v_inserted is null then
    raise exception 'reading event identity already claimed' using errcode = '23505';
  end if;

  update public.word_learning_states
  set state = p_next_state, version = greatest(version + 1, 1)
  where id = v_word.id;

  update public.reading_reinforcement_sessions
  set outcomes = outcomes || jsonb_build_array(jsonb_build_object(
        'questionId', p_question_id,
        'wordId', p_word_id,
        'submittedAnswer', p_submitted_answer,
        'correct', p_correct,
        'correctDisplay', v_question ->> 'correctDisplay',
        'answeredAt', v_answered_at
      )),
      cursor = cursor + 1,
      revision = revision + 1,
      status = case when cursor + 1 = jsonb_array_length(questions) then 'complete' else 'active' end,
      completed_at = case when cursor + 1 = jsonb_array_length(questions) then v_answered_at else null end
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object('kind', 'accepted', 'row', to_jsonb(v_session), 'wordState', p_next_state);
end;
$$;

revoke all on function public.apply_reading_answer(uuid, uuid, text, integer, text, integer, text, text, boolean, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_reading_answer(uuid, uuid, text, integer, text, integer, text, text, boolean, text, jsonb, jsonb)
  to service_role;
