-- A Reading answer is computed from a complete word snapshot outside the RPC.
-- readingRevision alone does not detect a concurrent non-Reading word edit.
alter table public.word_learning_states
  add column state_revision integer not null default 0 check (state_revision >= 0);

create or replace function public.advance_word_state_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_reading_revision integer;
  v_new_reading_revision integer;
  v_expected text;
begin
  v_old_reading_revision := coalesce((old.state ->> 'readingRevision')::integer, 0);
  v_new_reading_revision := coalesce((new.state ->> 'readingRevision')::integer, 0);
  if v_new_reading_revision <> v_old_reading_revision then
    v_expected := current_setting('rootline.expected_word_revision', true);
    if v_expected is null or v_expected = '' or v_expected::integer <> old.state_revision then
      raise exception using errcode = 'P0001', message = 'WORD_STATE_REVISION_CONFLICT';
    end if;
  end if;
  new.state_revision := old.state_revision + 1;
  return new;
end;
$$;

create trigger word_states_advance_revision
  before update on public.word_learning_states
  for each row execute function public.advance_word_state_revision();

-- Preserve the existing atomic answer implementation, but only invoke it
-- through a wrapper that supplies the server row revision read with the state.
alter function public.apply_reading_answer(uuid, uuid, text, integer, text, integer, text, text, boolean, text, jsonb, jsonb)
  rename to apply_reading_answer_internal;

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
  p_next_state jsonb,
  p_expected_word_revision integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
  v_session public.reading_reinforcement_sessions%rowtype;
  v_actual_word_revision integer;
  v_cas_revision integer;
  v_created_word_id uuid;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using message = 'server-only reading answer';
  end if;
  if p_expected_word_revision < -1 or p_expected_word_revision is null then
    raise exception 'invalid word state revision' using errcode = '22023';
  end if;

  -- Lock in the same session-then-word order as the internal transaction.
  -- An already saved answer must remain idempotent even with a stale word base.
  select * into v_session from public.reading_reinforcement_sessions
    where id = p_session_id and user_id = p_user_id for update;
  if not found then
    raise exception 'reading session not found' using errcode = 'P0002';
  end if;
  if v_session.revision <> p_expected_session_revision or exists (
    select 1 from jsonb_array_elements(v_session.outcomes) as item
    where item ->> 'questionId' = p_question_id
  ) then
    return public.apply_reading_answer_internal(
      p_user_id, p_session_id, p_question_id, p_expected_session_revision,
      p_word_id, p_expected_reading_revision, p_event_id, p_submitted_answer,
      p_correct, p_event_type, p_event_payload, p_next_state
    );
  end if;

  if p_expected_word_revision = -1 then
    -- The caller saw no row. Claim that absence with the unique key; a
    -- concurrent first sync wins the insert and forces a recomputation.
    insert into public.word_learning_states (user_id, word_id, state)
    values (p_user_id, p_word_id,
      jsonb_build_object('wordId', p_word_id, 'readingRevision', 0))
    on conflict (user_id, word_id) do nothing
    returning id into v_created_word_id;
    if v_created_word_id is null then
      return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
    end if;
    v_cas_revision := 0;
  else
    select state_revision into v_actual_word_revision
    from public.word_learning_states
    where user_id = p_user_id and word_id = p_word_id for update;
    if not found or v_actual_word_revision <> p_expected_word_revision then
      return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
    end if;
    v_cas_revision := p_expected_word_revision;
  end if;

  perform set_config('rootline.expected_word_revision', v_cas_revision::text, true);
  begin
    v_result := public.apply_reading_answer_internal(
      p_user_id, p_session_id, p_question_id, p_expected_session_revision,
      p_word_id, p_expected_reading_revision, p_event_id, p_submitted_answer,
      p_correct, p_event_type, p_event_payload, p_next_state
    );
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'WORD_STATE_REVISION_CONFLICT' then raise; end if;
    -- The nested exception block rolls back the internal answer's event and
    -- word writes, so the caller can recompute against a fresh snapshot.
    perform set_config('rootline.expected_word_revision', '', true);
    if v_created_word_id is not null then
      delete from public.word_learning_states where id = v_created_word_id;
    end if;
    return jsonb_build_object('kind', 'conflict', 'row', to_jsonb(v_session));
  end;
  perform set_config('rootline.expected_word_revision', '', true);
  if v_created_word_id is not null and v_result ->> 'kind' <> 'accepted' then
    delete from public.word_learning_states where id = v_created_word_id;
  end if;
  return v_result;
end;
$$;

revoke all on function public.apply_reading_answer(uuid, uuid, text, integer, text, integer, text, text, boolean, text, jsonb, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.apply_reading_answer(uuid, uuid, text, integer, text, integer, text, text, boolean, text, jsonb, jsonb, integer)
  to service_role;
