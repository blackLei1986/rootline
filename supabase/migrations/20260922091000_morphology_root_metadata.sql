create or replace function public.apply_morphology_import(p_plan jsonb, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
  dataset_version text := p_plan->'dataset'->>'version';
  dataset_source text := p_plan->'dataset'->>'source';
  target_dataset_id uuid;
  target_root_id uuid;
  target_variant_id uuid;
  item jsonb;
  previous_snapshot jsonb;
  result_snapshot jsonb;
  variant_events_created integer := 0;
begin
  if jsonb_typeof(coalesce(p_plan->'variants', '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'Import variants must be an array';
  end if;

  result := public.apply_morphology_import_base(p_plan - 'variants', p_actor);

  select id into target_dataset_id
  from public.morphology_datasets where version = dataset_version;

  for item in select value from jsonb_array_elements(p_plan->'roots') loop
    update public.morphology_roots root
    set provenance = jsonb_build_object(
      'datasetVersion', dataset_version,
      'contentHash', item->>'contentHash',
      'source', dataset_source,
      'rootProvenance', coalesce(item->'provenance', '[]'::jsonb),
      'rootMetadata', jsonb_strip_nulls(jsonb_build_object(
        'etymologyConfidence', item->>'etymologyConfidence',
        'pedagogicalConfidence', item->'pedagogicalConfidence',
        'riskNotes', item->>'riskNotes'
      ))
    )
    where root.dataset_id = target_dataset_id and root.root_key = item->>'rootKey';
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_plan->'variants', '[]'::jsonb)) loop
    if coalesce(item->>'rootKey', '') = ''
       or coalesce(item->>'form', '') = ''
       or coalesce(item->>'contentHash', '') = ''
       or item->>'relation' not in ('historical', 'pedagogical') then
      raise exception using errcode = '22023', message = 'Every variant requires rootKey, form, relation, and contentHash';
    end if;

    select root.id into target_root_id
    from public.morphology_roots root
    where root.dataset_id = target_dataset_id and root.root_key = item->>'rootKey';
    if target_root_id is null then
      raise exception using errcode = '22023', message = format('Unknown variant root %s', item->>'rootKey');
    end if;

    select to_jsonb(variant) into previous_snapshot
    from public.morphology_root_variants variant
    where variant.dataset_id = target_dataset_id
      and variant.canonical_root_id = target_root_id
      and variant.variant_form = item->>'form'
    for update;

    insert into public.morphology_root_variants (
      dataset_id, canonical_root_id, variant_form, relation, explanation, provenance
    ) values (
      target_dataset_id, target_root_id, item->>'form', item->>'relation', item->>'explanation',
      jsonb_build_object(
        'datasetVersion', dataset_version,
        'contentHash', item->>'contentHash',
        'source', dataset_source,
        'variantProvenance', coalesce(item->'provenance', '{}'::jsonb)
      )
    )
    on conflict (dataset_id, canonical_root_id, variant_form) do update set
      relation = excluded.relation,
      explanation = excluded.explanation,
      provenance = excluded.provenance
    where public.morphology_root_variants.provenance->>'contentHash'
      is distinct from excluded.provenance->>'contentHash'
    returning id into target_variant_id;

    if target_variant_id is null then
      select id into target_variant_id
      from public.morphology_root_variants variant
      where variant.dataset_id = target_dataset_id
        and variant.canonical_root_id = target_root_id
        and variant.variant_form = item->>'form';
    end if;

    select to_jsonb(variant) into result_snapshot
    from public.morphology_root_variants variant where variant.id = target_variant_id;

    insert into public.morphology_review_events (
      entity_type, entity_id, action, actor, previous_snapshot, result_snapshot,
      dataset_version, source, metadata, idempotency_key
    ) values (
      'root-variant', target_variant_id::text, 'root-variant-import', p_actor,
      previous_snapshot, result_snapshot, dataset_version, dataset_source,
      jsonb_build_object('contentHash', item->>'contentHash', 'canonicalRootKey', item->>'rootKey'),
      format('root-variant-import:%s:%s:%s:%s', dataset_version, item->>'rootKey', item->>'form', item->>'contentHash')
    ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
    if found then variant_events_created := variant_events_created + 1; end if;
  end loop;

  return result || jsonb_build_object(
    'auditEventsCreated', coalesce((result->>'auditEventsCreated')::integer, 0) + variant_events_created
  );
end;
$$;

revoke execute on function public.apply_morphology_import(jsonb, text)
  from public, anon, authenticated;
grant execute on function public.apply_morphology_import(jsonb, text)
  to service_role;
