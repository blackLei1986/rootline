create function public.apply_morphology_review(
  p_record_id uuid,
  p_expected_revision integer,
  p_action text,
  p_actor_id uuid,
  p_reason text,
  p_segments jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_record public.word_morphology_records%rowtype;
  updated_record public.word_morphology_records%rowtype;
  previous_segments jsonb;
  result_segments jsonb;
  previous_snapshot jsonb;
  result_snapshot jsonb;
begin
  if p_action not in ('approve', 'edit', 'reject') then
    raise exception using errcode = '22023', message = 'Unsupported morphology review action';
  end if;

  select * into current_record
  from public.word_morphology_records
  where id = p_record_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Morphology record not found';
  end if;

  if current_record.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'Stale morphology review revision';
  end if;

  if p_action = 'reject' and current_record.confidence = 'verified' then
    raise exception using errcode = '22023', message = 'Verified morphology records cannot be weakened';
  end if;

  if p_action = 'edit' and (p_segments is null or jsonb_typeof(p_segments) <> 'array') then
    raise exception using errcode = '22023', message = 'Edited morphology segments are required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(segment) order by segment.position), '[]'::jsonb)
  into previous_segments
  from public.word_morphology_segments segment
  where segment.word_morphology_record_id = p_record_id;

  previous_snapshot := to_jsonb(current_record) || jsonb_build_object('segments', previous_segments);

  if p_action = 'edit' then
    delete from public.word_morphology_segments
    where word_morphology_record_id = p_record_id;

    insert into public.word_morphology_segments (
      word_morphology_record_id, position, kind, surface_form, root_id, meaning, explanation
    )
    select
      p_record_id,
      segment.position,
      segment.kind,
      segment.surface_form,
      segment.root_id,
      segment.meaning,
      segment.explanation
    from jsonb_to_recordset(p_segments) as segment(
      position integer,
      kind text,
      surface_form text,
      root_id uuid,
      meaning text,
      explanation text
    );
  end if;

  update public.word_morphology_records
  set
    confidence = case when p_action = 'reject' then 'none' else 'verified' end,
    review_status = case when p_action = 'reject' then 'rejected' else 'approved' end,
    primary_root_id = case
      when p_action = 'edit' then (
        select segment.root_id
        from public.word_morphology_segments segment
        where segment.word_morphology_record_id = p_record_id and segment.kind = 'root'
        order by segment.position
        limit 1
      )
      else current_record.primary_root_id
    end,
    revision = current_record.revision + 1,
    reviewed_at = now(),
    reviewed_by = p_actor_id
  where id = p_record_id
  returning * into updated_record;

  select coalesce(jsonb_agg(to_jsonb(segment) order by segment.position), '[]'::jsonb)
  into result_segments
  from public.word_morphology_segments segment
  where segment.word_morphology_record_id = p_record_id;

  result_snapshot := to_jsonb(updated_record) || jsonb_build_object('segments', result_segments);

  insert into public.morphology_review_events (
    record_id, action, actor_id, previous_snapshot, result_snapshot, reason
  ) values (
    p_record_id, p_action, p_actor_id, previous_snapshot, result_snapshot, p_reason
  );

  return result_snapshot;
end;
$$;

revoke execute on function public.apply_morphology_review(uuid, integer, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_morphology_review(uuid, integer, text, uuid, text, jsonb)
  to service_role;
