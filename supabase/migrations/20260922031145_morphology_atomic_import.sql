alter table public.word_morphology_records
  add column word text not null default '',
  add column morphology_expression text not null default '',
  add column literal_meaning text not null default '';

alter table public.word_morphology_segments
  add column normalized_form text not null default '',
  add column provenance jsonb not null default '{}'::jsonb;

create index idx_morphology_families_primary_root_id
  on public.morphology_families (primary_root_id);

create index idx_word_morphology_records_family_id
  on public.word_morphology_records (family_id);

create index idx_word_morphology_records_legacy_word_uuid
  on public.word_morphology_records (legacy_word_uuid);

create index idx_word_morphology_records_primary_root_id
  on public.word_morphology_records (primary_root_id);

alter table public.morphology_review_events
  alter column record_id drop not null,
  add column entity_type text not null default 'word-record',
  add column entity_id text,
  add column word_id text,
  add column dataset_version text,
  add column source text,
  add column actor text,
  add column metadata jsonb not null default '{}'::jsonb,
  add column idempotency_key text;

update public.morphology_review_events event
set
  entity_id = event.record_id::text,
  word_id = record.catalog_word_id,
  dataset_version = dataset.version,
  source = record.source,
  actor = event.actor_id::text
from public.word_morphology_records record
join public.morphology_datasets dataset on dataset.id = record.dataset_id
where record.id = event.record_id;

alter table public.morphology_review_events
  alter column entity_id set not null,
  alter column dataset_version set not null,
  alter column source set not null,
  drop constraint if exists morphology_review_events_action_check,
  add constraint morphology_review_events_action_check check (
    action in ('gold-import', 'derived-create', 'approve', 'edit', 'reject', 're-import', 'version-change', 'reopen', 'import')
  ),
  add constraint morphology_review_events_entity_type_check check (
    entity_type in ('dataset', 'word-record')
  );

create unique index idx_morphology_review_events_idempotency
  on public.morphology_review_events (idempotency_key)
  where idempotency_key is not null;

create function public.prevent_morphology_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Morphology audit history is append-only';
end;
$$;

create trigger morphology_review_events_append_only
  before update or delete on public.morphology_review_events
  for each row execute function public.prevent_morphology_audit_mutation();

revoke execute on function public.prevent_morphology_audit_mutation()
  from public, anon, authenticated;

create or replace function public.apply_morphology_review(
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
  current_dataset_version text;
  previous_segments jsonb;
  result_segments jsonb;
  previous_snapshot jsonb;
  result_snapshot jsonb;
begin
  if p_action not in ('approve', 'edit', 'reject') then
    raise exception using errcode = '22023', message = 'Unsupported morphology review action';
  end if;

  select record.*
  into current_record
  from public.word_morphology_records record
  where record.id = p_record_id
  for update of record;

  if not found then
    raise exception using errcode = 'P0002', message = 'Morphology record not found';
  end if;

  select dataset.version
  into current_dataset_version
  from public.morphology_datasets dataset
  where dataset.id = current_record.dataset_id;
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
      word_morphology_record_id, position, kind, surface_form, normalized_form,
      root_id, meaning, explanation, provenance
    )
    select
      p_record_id,
      segment.position,
      segment.kind,
      segment.surface_form,
      lower(trim(segment.surface_form)),
      segment.root_id,
      segment.meaning,
      segment.explanation,
      jsonb_build_object('reviewAction', 'edit', 'actorId', p_actor_id)
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
    record_id, entity_type, entity_id, word_id, action, actor_id, actor,
    previous_snapshot, result_snapshot, reason, dataset_version, source,
    metadata, idempotency_key
  ) values (
    p_record_id, 'word-record', p_record_id::text, current_record.catalog_word_id,
    p_action, p_actor_id, p_actor_id::text, previous_snapshot, result_snapshot,
    p_reason, current_dataset_version, current_record.source,
    jsonb_build_object('revision', updated_record.revision),
    format('review:%s:%s:%s', p_record_id, updated_record.revision, p_action)
  );

  return result_snapshot;
end;
$$;

create function public.apply_morphology_import(
  p_plan jsonb,
  p_actor text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  dataset_input jsonb := p_plan->'dataset';
  dataset_version text := dataset_input->>'version';
  dataset_source text := dataset_input->>'source';
  dataset_hash text := dataset_input->'provenance'->>'contentHash';
  target_dataset_id uuid;
  dataset_was_present boolean := false;
  prior_gold_dataset_exists boolean := false;
  item jsonb;
  segment_input jsonb;
  target_root_id uuid;
  target_family_id uuid;
  target_record_id uuid;
  existing_record public.word_morphology_records%rowtype;
  previous_snapshot jsonb;
  result_snapshot jsonb;
  action_name text;
  records_inserted integer := 0;
  records_updated integer := 0;
  records_unchanged integer := 0;
  skipped_verified integer := 0;
  skipped_rejected integer := 0;
  events_created integer := 0;
begin
  if coalesce(dataset_version, '') = '' or coalesce(dataset_hash, '') = '' or coalesce(p_actor, '') = '' then
    raise exception using errcode = '22023', message = 'Dataset version, content hash, and actor are required';
  end if;
  if jsonb_typeof(coalesce(p_plan->'roots', 'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_plan->'families', 'null'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_plan->'records', 'null'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Import roots, families, and records must be arrays';
  end if;

  select exists (
    select 1 from public.morphology_datasets where kind = 'gold'
  ) into prior_gold_dataset_exists;

  select dataset.id
  into target_dataset_id
  from public.morphology_datasets dataset
  where dataset.version = dataset_version
  for update;

  if found then
    dataset_was_present := true;
    if coalesce((select dataset.provenance->>'contentHash' from public.morphology_datasets dataset where dataset.id = target_dataset_id), '') <> dataset_hash then
      raise exception using
        errcode = '22023',
        message = format('Dataset version %s already exists with a different content hash', dataset_version);
    end if;
  else
    insert into public.morphology_datasets (
      version, kind, status, source, provenance, published_at
    ) values (
      dataset_version,
      'gold',
      'published',
      dataset_source,
      dataset_input->'provenance',
      now()
    ) returning id into target_dataset_id;

    action_name := case when prior_gold_dataset_exists then 'version-change' else 'gold-import' end;
    insert into public.morphology_review_events (
      entity_type, entity_id, action, actor, previous_snapshot, result_snapshot,
      dataset_version, source, metadata, idempotency_key
    ) values (
      'dataset', target_dataset_id::text, action_name, p_actor, null,
      jsonb_build_object('id', target_dataset_id, 'version', dataset_version, 'contentHash', dataset_hash),
      dataset_version, dataset_source,
      jsonb_build_object('importKind', 'dataset'),
      format('dataset:%s:%s', dataset_version, dataset_hash)
    ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
    events_created := events_created + 1;
  end if;

  for item in select value from jsonb_array_elements(p_plan->'roots') loop
    if coalesce(item->>'rootKey', '') = '' or coalesce(item->>'contentHash', '') = '' then
      raise exception using errcode = '22023', message = 'Every root requires rootKey and contentHash';
    end if;

    insert into public.morphology_roots (
      dataset_id, root_key, meaning_en, meaning_zh, educational_content, provenance
    ) values (
      target_dataset_id,
      item->>'rootKey',
      coalesce(item->'meaningEn', '[]'::jsonb),
      coalesce(item->'meaningZh', '[]'::jsonb),
      coalesce(item->'educationalContent', '{}'::jsonb),
      jsonb_build_object(
        'datasetVersion', dataset_version,
        'contentHash', item->>'contentHash',
        'source', dataset_source
      )
    )
    on conflict (dataset_id, root_key) do update set
      meaning_en = excluded.meaning_en,
      meaning_zh = excluded.meaning_zh,
      educational_content = excluded.educational_content,
      provenance = excluded.provenance
    where public.morphology_roots.provenance->>'contentHash' is distinct from excluded.provenance->>'contentHash';
  end loop;

  for item in select value from jsonb_array_elements(p_plan->'families') loop
    target_root_id := null;
    if item->>'primaryRootKey' is not null then
      select id into target_root_id
      from public.morphology_roots
      where morphology_roots.dataset_id = target_dataset_id
        and root_key = item->>'primaryRootKey';
      if target_root_id is null then
        raise exception using errcode = '22023', message = format('Unknown family root %s', item->>'primaryRootKey');
      end if;
    end if;

    insert into public.morphology_families (
      dataset_id, primary_root_id, family_key, display_name,
      formation_explanation, source, provenance
    ) values (
      target_dataset_id,
      target_root_id,
      item->>'familyKey',
      item->>'displayName',
      item->>'formationExplanation',
      item->>'source',
      coalesce(item->'provenance', '{}'::jsonb)
        || jsonb_build_object('contentHash', item->>'contentHash')
    )
    on conflict (dataset_id, family_key) do update set
      primary_root_id = excluded.primary_root_id,
      display_name = excluded.display_name,
      formation_explanation = excluded.formation_explanation,
      source = excluded.source,
      provenance = excluded.provenance
    where public.morphology_families.provenance->>'contentHash' is distinct from excluded.provenance->>'contentHash';
  end loop;

  for item in select value from jsonb_array_elements(p_plan->'records') loop
    if coalesce(item->>'catalogWordId', '') = '' or coalesce(item->>'contentHash', '') = '' then
      raise exception using errcode = '22023', message = 'Every record requires catalogWordId and contentHash';
    end if;
    if jsonb_typeof(coalesce(item->'segments', 'null'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'Every record requires a segment array';
    end if;

    if item->>'source' = 'gold-dataset-exact-lemma' and exists (
      select 1
      from public.word_morphology_records record
      where record.catalog_word_id = item->>'catalogWordId'
        and record.confidence = 'verified'
    ) then
      skipped_verified := skipped_verified + 1;
      continue;
    end if;
    if item->>'source' = 'gold-dataset-exact-lemma' and exists (
      select 1
      from public.word_morphology_records record
      where record.dataset_id = target_dataset_id
        and record.catalog_word_id = item->>'catalogWordId'
        and record.source = 'gold-dataset-exact-lemma'
        and record.review_status = 'rejected'
    ) then
      skipped_rejected := skipped_rejected + 1;
      continue;
    end if;

    target_root_id := null;
    if item->>'primaryRootKey' is not null then
      select id into target_root_id
      from public.morphology_roots
      where morphology_roots.dataset_id = target_dataset_id
        and root_key = item->>'primaryRootKey';
      if target_root_id is null then
        raise exception using errcode = '22023', message = format('Unknown primary root %s', item->>'primaryRootKey');
      end if;
    end if;

    target_family_id := null;
    if item->>'familyKey' is not null then
      select id into target_family_id
      from public.morphology_families
      where morphology_families.dataset_id = target_dataset_id
        and family_key = item->>'familyKey';
      if target_family_id is null then
        raise exception using errcode = '22023', message = format('Unknown morphology family %s', item->>'familyKey');
      end if;
    end if;

    select * into existing_record
    from public.word_morphology_records record
    where record.dataset_id = target_dataset_id
      and record.catalog_word_id = item->>'catalogWordId'
    for update;

    if found
       and existing_record.provenance->>'contentHash' = item->>'contentHash'
       and (select count(*) from public.word_morphology_segments segment where segment.word_morphology_record_id = existing_record.id)
           = jsonb_array_length(item->'segments')
       and existing_record.family_id is not distinct from target_family_id
       and existing_record.primary_root_id is not distinct from target_root_id then
      records_unchanged := records_unchanged + 1;
      continue;
    end if;

    if found then
      previous_snapshot := to_jsonb(existing_record);
      update public.word_morphology_records
      set
        word = item->>'word',
        lemma = item->>'lemma',
        family_id = target_family_id,
        primary_root_id = target_root_id,
        confidence = item->>'confidence',
        morphology_score = (item->>'morphologyScore')::numeric,
        source = item->>'source',
        provenance = coalesce(item->'provenance', '{}'::jsonb)
          || jsonb_build_object('contentHash', item->>'contentHash'),
        morphology_expression = item->>'morphologyExpression',
        literal_meaning = item->>'literalMeaning',
        formation_explanation = item->>'formationExplanation',
        review_status = item->>'reviewStatus',
        revision = existing_record.revision + 1
      where id = existing_record.id
      returning id into target_record_id;
      records_updated := records_updated + 1;
      action_name := 're-import';
    else
      previous_snapshot := null;
      insert into public.word_morphology_records (
        dataset_id, catalog_word_id, word, lemma, family_id, primary_root_id,
        confidence, morphology_score, source, provenance, morphology_expression,
        literal_meaning, formation_explanation, review_status
      ) values (
        target_dataset_id,
        item->>'catalogWordId',
        item->>'word',
        item->>'lemma',
        target_family_id,
        target_root_id,
        item->>'confidence',
        (item->>'morphologyScore')::numeric,
        item->>'source',
        coalesce(item->'provenance', '{}'::jsonb)
          || jsonb_build_object('contentHash', item->>'contentHash'),
        item->>'morphologyExpression',
        item->>'literalMeaning',
        item->>'formationExplanation',
        item->>'reviewStatus'
      ) returning id into target_record_id;
      records_inserted := records_inserted + 1;
      action_name := case
        when item->>'source' = 'gold-dataset-exact-lemma' then 'derived-create'
        when dataset_was_present then 're-import'
        else 'gold-import'
      end;
    end if;

    delete from public.word_morphology_segments
    where word_morphology_record_id = target_record_id;

    for segment_input in select value from jsonb_array_elements(item->'segments') loop
      target_root_id := null;
      if segment_input->>'rootKey' is not null then
        select id into target_root_id
        from public.morphology_roots
        where morphology_roots.dataset_id = target_dataset_id
          and root_key = segment_input->>'rootKey';
        if target_root_id is null then
          raise exception using errcode = '22023', message = format('Unknown segment root %s', segment_input->>'rootKey');
        end if;
      end if;

      insert into public.word_morphology_segments (
        word_morphology_record_id, position, kind, surface_form, normalized_form,
        root_id, meaning, explanation, provenance
      ) values (
        target_record_id,
        (segment_input->>'position')::integer,
        segment_input->>'kind',
        segment_input->>'surfaceForm',
        segment_input->>'normalizedForm',
        target_root_id,
        segment_input->>'meaning',
        segment_input->>'explanation',
        coalesce(segment_input->'provenance', '{}'::jsonb)
      );
    end loop;

    select to_jsonb(record) || jsonb_build_object(
      'segments', coalesce((
        select jsonb_agg(to_jsonb(segment) order by segment.position)
        from public.word_morphology_segments segment
        where segment.word_morphology_record_id = record.id
      ), '[]'::jsonb)
    ) into result_snapshot
    from public.word_morphology_records record
    where record.id = target_record_id;

    insert into public.morphology_review_events (
      record_id, entity_type, entity_id, word_id, action, actor,
      previous_snapshot, result_snapshot, dataset_version, source,
      metadata, idempotency_key
    ) values (
      target_record_id,
      'word-record',
      target_record_id::text,
      item->>'catalogWordId',
      action_name,
      p_actor,
      previous_snapshot,
      result_snapshot,
      dataset_version,
      item->>'source',
      jsonb_build_object('contentHash', item->>'contentHash'),
      format('%s:%s:%s:%s', action_name, dataset_version, item->>'catalogWordId', item->>'contentHash')
    ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
    if found then events_created := events_created + 1; end if;
  end loop;

  return jsonb_build_object(
    'datasetVersion', dataset_version,
    'recordsInserted', records_inserted,
    'recordsUpdated', records_updated,
    'recordsUnchanged', records_unchanged,
    'skippedVerified', skipped_verified,
    'skippedRejected', skipped_rejected,
    'auditEventsCreated', events_created
  );
end;
$$;

revoke execute on function public.apply_morphology_import(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.apply_morphology_import(jsonb, text)
  to service_role;
