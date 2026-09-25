-- Existing client word snapshots carry no server CAS base. Protect Reading
-- answer revisions without giving unrelated sync kinds service-role powers.
revoke insert, update, delete on table public.word_learning_states from anon, authenticated;
grant select on table public.word_learning_states to authenticated;

create or replace function public.apply_guarded_word_state(
  p_user_id uuid,
  p_operation_id text,
  p_entity_id text,
  p_version integer,
  p_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_operation_id uuid;
  v_word_id uuid;
  v_reading_revision integer;
begin
  if current_user <> 'service_role' then
    raise insufficient_privilege using message = 'server-only word-state sync';
  end if;
  if p_version < 1 or p_operation_id is null or length(p_operation_id) > 300
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload ->> 'wordId' is distinct from p_entity_id
    or p_entity_id is null or length(p_entity_id) > 500
  then
    raise exception 'invalid word-state sync payload' using errcode = '22023';
  end if;
  v_reading_revision := coalesce((p_payload ->> 'readingRevision')::integer, 0);
  if v_reading_revision < 0 then
    raise exception 'invalid reading revision' using errcode = '22023';
  end if;

  insert into public.sync_operations (
    user_id, operation_id, operation_kind, entity_id, entity_version
  ) values (p_user_id, p_operation_id, 'word-state', p_entity_id, p_version)
  on conflict (user_id, operation_id) do nothing
  returning id into v_operation_id;
  if v_operation_id is null then return false; end if;

  insert into public.word_learning_states (
    user_id, word_id, state, version, client_updated_at
  ) values (
    p_user_id, p_entity_id, p_payload, p_version, now()
  )
  on conflict (user_id, word_id) do update set
    state = excluded.state,
    version = excluded.version,
    client_updated_at = excluded.client_updated_at
  where coalesce((public.word_learning_states.state ->> 'readingRevision')::integer, 0) = v_reading_revision
  returning id into v_word_id;

  if v_word_id is null then
    raise exception using errcode = 'P0001', message = 'READING_REVISION_CONFLICT';
  end if;
  return true;
end;
$$;

revoke all on function public.apply_guarded_word_state(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_guarded_word_state(uuid, text, text, integer, jsonb)
  to service_role;
