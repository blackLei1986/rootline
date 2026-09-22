begin;

select plan(10);

select has_table('public', 'morphology_datasets', 'versioned morphology datasets exist');
select has_table('public', 'word_morphology_records', 'word morphology records exist');

insert into public.morphology_datasets (version, kind, status, source, provenance)
values ('test-gold-v1', 'gold', 'published', 'test', '{}'::jsonb);

set local role anon;
select results_eq(
  $$ select count(*) from public.morphology_datasets where version = 'test-gold-v1' $$,
  array[1::bigint],
  'anonymous users can read published datasets'
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
