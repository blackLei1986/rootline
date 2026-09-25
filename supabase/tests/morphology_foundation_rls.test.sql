begin;

select plan(17);

select has_table('public', 'morphology_datasets', 'versioned morphology datasets exist');
select has_table('public', 'word_morphology_records', 'word morphology records exist');
select has_table('public', 'morphology_root_variants', 'root variants are persisted structurally');

select has_index(
  'public',
  'morphology_families',
  'idx_morphology_families_primary_root_id',
  'morphology family root foreign keys are indexed'
);
select has_index(
  'public',
  'morphology_root_variants',
  'idx_morphology_root_variants_canonical_root_id',
  'root variant foreign keys are indexed'
);
select has_index(
  'public',
  'word_morphology_records',
  'idx_word_morphology_records_family_id',
  'word morphology family foreign keys are indexed'
);
select has_index(
  'public',
  'word_morphology_records',
  'idx_word_morphology_records_legacy_word_uuid',
  'legacy word foreign keys are indexed'
);
select has_index(
  'public',
  'word_morphology_records',
  'idx_word_morphology_records_primary_root_id',
  'word morphology root foreign keys are indexed'
);

insert into public.morphology_datasets (version, kind, status, source, provenance)
values ('test-gold-v1', 'gold', 'published', 'test', '{}'::jsonb);

insert into public.morphology_roots (dataset_id, root_key, meaning_en, meaning_zh, educational_content, provenance)
values (
  (select id from public.morphology_datasets where version = 'test-gold-v1'),
  'spect', '["look"]'::jsonb, '["看"]'::jsonb, '{}'::jsonb, '{}'::jsonb
);

insert into public.morphology_root_variants (dataset_id, canonical_root_id, variant_form, relation, explanation, provenance)
values (
  (select id from public.morphology_datasets where version = 'test-gold-v1'),
  (
    select root.id
    from public.morphology_roots root
    join public.morphology_datasets dataset on dataset.id = root.dataset_id
    where root.root_key = 'spect' and dataset.version = 'test-gold-v1'
  ),
  'specto', 'historical', 'test variant', '{}'::jsonb
);

set local role anon;
select results_eq(
  $$ select count(*) from public.morphology_datasets where version = 'test-gold-v1' $$,
  array[1::bigint],
  'anonymous users can read published datasets'
);
select results_eq(
  $$ select count(*) from public.morphology_root_variants variant join public.morphology_datasets dataset on dataset.id = variant.dataset_id where dataset.version = 'test-gold-v1' $$,
  array[1::bigint],
  'anonymous users can read variants of published datasets'
);
select throws_ok(
  $$ insert into public.morphology_datasets (version, kind, status, source, provenance)
     values ('forbidden', 'gold', 'draft', 'test', '{}'::jsonb) $$,
  '42501', null, 'anonymous users cannot insert datasets'
);

reset role;
set local role authenticated;
select throws_ok(
  $$ insert into public.word_morphology_records (
       dataset_id, catalog_word_id, lemma, confidence, morphology_score, source, provenance, review_status
     ) values (
       (select id from public.morphology_datasets where version = 'test-gold-v1'),
       'inspect', 'inspect', 'derived', 100, 'test', '{}'::jsonb, 'pending'
     ) $$,
  '42501', null, 'authenticated users cannot insert morphology records'
);

reset role;
select lives_ok(
  $$ insert into public.word_morphology_records (
       dataset_id, catalog_word_id, lemma, confidence, morphology_score, source, provenance, review_status, legacy_word_uuid
     ) values (
       (select id from public.morphology_datasets where version = 'test-gold-v1'),
       'catalog-only-inspect', 'inspect', 'derived', 100, 'test', '{}'::jsonb, 'pending', null
     ) $$,
  'catalog-only word IDs do not require legacy UUID rows'
);
select throws_ok(
  $$ insert into public.word_morphology_records (
       dataset_id, catalog_word_id, lemma, confidence, morphology_score, source, provenance, review_status
     ) values (
       (select id from public.morphology_datasets where version = 'test-gold-v1'),
       'bad-score', 'inspect', 'derived', 101, 'test', '{}'::jsonb, 'pending'
     ) $$,
  '23514', null, 'scores above 100 are rejected'
);
select throws_ok(
  $$ insert into public.word_morphology_records (
       dataset_id, catalog_word_id, lemma, confidence, morphology_score, source, provenance, review_status
     ) values (
       (select id from public.morphology_datasets where version = 'test-gold-v1'),
       'bad-confidence', 'inspect', 'high', 100, 'test', '{}'::jsonb, 'pending'
     ) $$,
  '23514', null, 'legacy confidence labels are rejected'
);

select has_function(
  'public',
  'apply_morphology_review',
  array['uuid', 'integer', 'text', 'uuid', 'text', 'jsonb'],
  'review mutations use one database-side transaction function'
);
select function_privs_are(
  'public',
  'apply_morphology_review',
  array['uuid', 'integer', 'text', 'uuid', 'text', 'jsonb'],
  'service_role',
  array['EXECUTE'],
  'only the server service role can execute review mutations'
);

select * from finish();
rollback;
