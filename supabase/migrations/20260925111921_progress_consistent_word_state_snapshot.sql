-- One database statement gives all of a learner's word states the same MVCC
-- view and a timestamp from that view. Separate PostgREST pages cannot do so.
create function public.progress_word_state_snapshot(p_user_id uuid)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'observedAt', pg_catalog.statement_timestamp(),
    'states', coalesce(pg_catalog.jsonb_object_agg(state.word_id, state.state), '{}'::jsonb)
  )
  from public.word_learning_states state
  where current_user = 'service_role' and state.user_id = p_user_id
$$;

revoke all on function public.progress_word_state_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.progress_word_state_snapshot(uuid) to service_role;
