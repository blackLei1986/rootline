begin;

select plan(24);

select has_function(
  'public',
  'apply_morphology_import',
  array['jsonb', 'text'],
  'morphology import uses one database-side transaction function'
);

select function_privs_are(
  'public',
  'apply_morphology_import',
  array['jsonb', 'text'],
  'service_role',
  array['EXECUTE'],
  'only the server service role can execute morphology imports'
);

select lives_ok(
  $$ select public.apply_morphology_import(
    '{
      "dataset": {
        "version": "test-atomic-v1",
        "source": "test-gold",
        "provenance": {"contentHash": "hash-v1", "sourcePaths": ["fixture"]}
      },
      "roots": [{
        "rootKey": "spect",
        "root": "spect",
        "meaningEn": ["look"],
        "meaningZh": ["看"],
        "educationalContent": {"description": "look", "learningRationale": "test"},
        "contentHash": "root-hash"
      }],
      "families": [{
        "familyKey": "gold:inspect",
        "displayName": "inspect morphology family",
        "primaryRootKey": "spect",
        "formationExplanation": "look into",
        "source": "gold-dataset",
        "provenance": {"datasetVersion": "test-atomic-v1"},
        "contentHash": "family-hash"
      }],
      "records": [
        {
          "catalogWordId": "gold:inspect",
          "word": "inspect",
          "lemma": "inspect",
          "familyKey": "gold:inspect",
          "primaryRootKey": "spect",
          "segments": [
            {"position": 0, "kind": "prefix", "surfaceForm": "in-", "normalizedForm": "in-", "rootKey": null, "meaning": "into", "explanation": "look into", "provenance": {"source": "gold-dataset"}},
            {"position": 1, "kind": "root", "surfaceForm": "spect", "normalizedForm": "spect", "rootKey": "spect", "meaning": "look", "explanation": "look into", "provenance": {"source": "gold-dataset"}}
          ],
          "confidence": "verified",
          "morphologyScore": 100,
          "source": "gold-dataset",
          "provenance": {"sourceLemma": "inspect", "datasetVersion": "test-atomic-v1"},
          "morphologyExpression": "in + spect",
          "literalMeaning": "look into",
          "formationExplanation": "look into",
          "reviewStatus": "approved",
          "contentHash": "gold-record-hash"
        },
        {
          "catalogWordId": "catalog-inspect",
          "word": "inspect",
          "lemma": "inspect",
          "familyKey": "gold:inspect",
          "primaryRootKey": "spect",
          "segments": [
            {"position": 0, "kind": "prefix", "surfaceForm": "in-", "normalizedForm": "in-", "rootKey": null, "meaning": "into", "explanation": "look into", "provenance": {"source": "gold-dataset-exact-lemma"}},
            {"position": 1, "kind": "root", "surfaceForm": "spect", "normalizedForm": "spect", "rootKey": "spect", "meaning": "look", "explanation": "look into", "provenance": {"source": "gold-dataset-exact-lemma"}}
          ],
          "confidence": "derived",
          "morphologyScore": 100,
          "source": "gold-dataset-exact-lemma",
          "provenance": {"sourceLemma": "inspect", "datasetVersion": "test-atomic-v1", "matchingRule": "exact-lemma"},
          "morphologyExpression": "in + spect",
          "literalMeaning": "look into",
          "formationExplanation": "look into",
          "reviewStatus": "pending",
          "contentHash": "derived-record-hash"
        }
      ]
    }'::jsonb,
    'integration-test'
  ) $$,
  'first import succeeds atomically'
);

select results_eq(
  $$ select count(*) from public.morphology_datasets where version = 'test-atomic-v1' $$,
  array[1::bigint],
  'dataset is persisted once'
);
select results_eq(
  $$ select count(*) from public.morphology_roots root join public.morphology_datasets dataset on dataset.id = root.dataset_id where dataset.version = 'test-atomic-v1' $$,
  array[1::bigint],
  'Gold root is persisted'
);
select results_eq(
  $$ select count(*) from public.morphology_families family join public.morphology_datasets dataset on dataset.id = family.dataset_id where dataset.version = 'test-atomic-v1' $$,
  array[1::bigint],
  'morphology family relation is persisted'
);
select results_eq(
  $$ select count(*) from public.word_morphology_records record join public.morphology_datasets dataset on dataset.id = record.dataset_id where dataset.version = 'test-atomic-v1' $$,
  array[2::bigint],
  'Gold word and derived candidate are persisted separately'
);
select results_eq(
  $$ select count(*) from public.word_morphology_segments segment join public.word_morphology_records record on record.id = segment.word_morphology_record_id join public.morphology_datasets dataset on dataset.id = record.dataset_id where dataset.version = 'test-atomic-v1' $$,
  array[4::bigint],
  'ordered structured segments are persisted for both records'
);
select results_eq(
  $$ select count(*) from public.morphology_review_events event join public.morphology_datasets dataset on dataset.version = event.dataset_version where dataset.version = 'test-atomic-v1' $$,
  array[3::bigint],
  'dataset, Gold import, and derived creation audit events are appended'
);

select lives_ok(
  $$ select public.apply_morphology_import(
    jsonb_build_object(
      'dataset', jsonb_build_object('version', 'test-atomic-v1', 'source', 'test-gold', 'provenance', jsonb_build_object('contentHash', 'hash-v1', 'sourcePaths', jsonb_build_array('fixture'))),
      'roots', (select jsonb_agg(jsonb_build_object('rootKey', root.root_key, 'root', root.root_key, 'meaningEn', root.meaning_en, 'meaningZh', root.meaning_zh, 'educationalContent', root.educational_content, 'contentHash', root.provenance->>'contentHash')) from public.morphology_roots root join public.morphology_datasets dataset on dataset.id = root.dataset_id where dataset.version = 'test-atomic-v1'),
      'families', (select jsonb_agg(jsonb_build_object('familyKey', family.family_key, 'displayName', family.display_name, 'primaryRootKey', 'spect', 'formationExplanation', family.formation_explanation, 'source', family.source, 'provenance', family.provenance - 'contentHash', 'contentHash', family.provenance->>'contentHash')) from public.morphology_families family join public.morphology_datasets dataset on dataset.id = family.dataset_id where dataset.version = 'test-atomic-v1'),
      'records', (select jsonb_agg(jsonb_build_object('catalogWordId', record.catalog_word_id, 'word', record.word, 'lemma', record.lemma, 'familyKey', 'gold:inspect', 'primaryRootKey', 'spect', 'segments', (select jsonb_agg(jsonb_build_object('position', segment.position, 'kind', segment.kind, 'surfaceForm', segment.surface_form, 'normalizedForm', segment.normalized_form, 'rootKey', case when segment.kind = 'root' then 'spect' else null end, 'meaning', segment.meaning, 'explanation', segment.explanation, 'provenance', segment.provenance) order by segment.position) from public.word_morphology_segments segment where segment.word_morphology_record_id = record.id), 'confidence', record.confidence, 'morphologyScore', record.morphology_score, 'source', record.source, 'provenance', record.provenance - 'contentHash', 'morphologyExpression', record.morphology_expression, 'literalMeaning', record.literal_meaning, 'formationExplanation', record.formation_explanation, 'reviewStatus', record.review_status, 'contentHash', record.provenance->>'contentHash')) from public.word_morphology_records record join public.morphology_datasets dataset on dataset.id = record.dataset_id where dataset.version = 'test-atomic-v1')
    ),
    'integration-test'
  ) $$,
  'second identical import succeeds'
);
select results_eq(
  $$ select count(*) from public.morphology_review_events where dataset_version = 'test-atomic-v1' $$,
  array[3::bigint],
  'second identical import creates no duplicate audit events'
);

update public.word_morphology_records
set confidence = 'verified', review_status = 'approved', revision = revision + 1
where catalog_word_id = 'catalog-inspect';

select lives_ok(
  $$ select public.apply_morphology_import(
    jsonb_build_object(
      'dataset', jsonb_build_object('version', 'test-atomic-v1', 'source', 'test-gold', 'provenance', jsonb_build_object('contentHash', 'hash-v1')),
      'roots', '[]'::jsonb,
      'families', '[]'::jsonb,
      'records', jsonb_build_array(jsonb_build_object('catalogWordId', 'catalog-inspect', 'word', 'inspect', 'lemma', 'inspect', 'familyKey', null, 'primaryRootKey', null, 'segments', '[]'::jsonb, 'confidence', 'derived', 'morphologyScore', 100, 'source', 'gold-dataset-exact-lemma', 'provenance', jsonb_build_object('datasetVersion', 'test-atomic-v1'), 'morphologyExpression', 'in + spect', 'literalMeaning', 'look into', 'formationExplanation', 'look into', 'reviewStatus', 'pending', 'contentHash', 'changed-derived'))
    ),
    'integration-test'
  ) $$,
  're-import does not fail on a verified conflict'
);
select results_eq(
  $$ select confidence from public.word_morphology_records where catalog_word_id = 'catalog-inspect' $$,
  array['verified'::text],
  'verified remains stronger than derived'
);

insert into public.word_morphology_records (
  dataset_id, catalog_word_id, word, lemma, confidence, morphology_score,
  source, provenance, morphology_expression, literal_meaning,
  formation_explanation, review_status
) values (
  (select id from public.morphology_datasets where version = 'test-atomic-v1'),
  'catalog-rejected', 'respect', 'respect', 'none', 100,
  'gold-dataset-exact-lemma', '{"contentHash":"rejected-record"}'::jsonb,
  're + spect', 'look back', 'look back', 'rejected'
);

select lives_ok(
  $$ select public.apply_morphology_import(
    jsonb_build_object(
      'dataset', jsonb_build_object('version', 'test-atomic-v1', 'source', 'test-gold', 'provenance', jsonb_build_object('contentHash', 'hash-v1')),
      'roots', '[]'::jsonb,
      'families', '[]'::jsonb,
      'records', jsonb_build_array(jsonb_build_object('catalogWordId', 'catalog-rejected', 'word', 'respect', 'lemma', 'respect', 'familyKey', null, 'primaryRootKey', null, 'segments', '[]'::jsonb, 'confidence', 'derived', 'morphologyScore', 100, 'source', 'gold-dataset-exact-lemma', 'provenance', jsonb_build_object('datasetVersion', 'test-atomic-v1'), 'morphologyExpression', 're + spect', 'literalMeaning', 'look back', 'formationExplanation', 'look back', 'reviewStatus', 'pending', 'contentHash', 'new-derived'))
    ),
    'integration-test'
  ) $$,
  're-import does not fail on a same-version rejected conflict'
);
select results_eq(
  $$ select review_status from public.word_morphology_records where catalog_word_id = 'catalog-rejected' $$,
  array['rejected'::text],
  'same-source and same-version rejection is preserved'
);

select lives_ok(
  $$ select public.apply_morphology_import(
    '{"dataset":{"version":"test-atomic-v2","source":"test-gold","provenance":{"contentHash":"hash-v2"}},"roots":[],"families":[],"records":[]}'::jsonb,
    'integration-test'
  ) $$,
  'a new dataset version can be imported'
);
select results_eq(
  $$ select action from public.morphology_review_events where dataset_version = 'test-atomic-v2' and entity_type = 'dataset' $$,
  array['version-change'::text],
  'dataset version changes are audited explicitly'
);

select throws_ok(
  $$ select public.apply_morphology_import(
    '{
      "dataset": {"version": "test-rollback-v1", "source": "test", "provenance": {"contentHash": "rollback-hash"}},
      "roots": [],
      "families": [],
      "records": [{
        "catalogWordId": "broken", "word": "broken", "lemma": "broken", "familyKey": null, "primaryRootKey": "missing",
        "segments": [{"position": 0, "kind": "root", "surfaceForm": "missing", "normalizedForm": "missing", "rootKey": "missing", "meaning": "missing", "explanation": null, "provenance": {}}],
        "confidence": "derived", "morphologyScore": 100, "source": "gold-dataset-exact-lemma", "provenance": {},
        "morphologyExpression": "missing", "literalMeaning": "missing", "formationExplanation": "missing", "reviewStatus": "pending", "contentHash": "broken"
      }]
    }'::jsonb,
    'integration-test'
  ) $$,
  '22023', null,
  'invalid relation aborts the entire import'
);
select results_eq(
  $$ select count(*) from public.morphology_datasets where version = 'test-rollback-v1' $$,
  array[0::bigint],
  'failed import rolls back the dataset insert'
);

select throws_ok(
  $$ update public.morphology_review_events set reason = 'tampered' where dataset_version = 'test-atomic-v1' $$,
  '55000', null,
  'audit history is append-only'
);
select throws_ok(
  $$ delete from public.morphology_review_events where dataset_version = 'test-atomic-v1' $$,
  '55000', null,
  'audit history cannot be deleted'
);

select results_eq(
  $$ select segment.normalized_form from public.word_morphology_segments segment join public.word_morphology_records record on record.id = segment.word_morphology_record_id join public.morphology_datasets dataset on dataset.id = record.dataset_id where dataset.version = 'test-atomic-v1' and record.catalog_word_id = 'gold:inspect' order by segment.position $$,
  array['in-'::text, 'spect'::text],
  'segment normalized forms retain stable order'
);
select results_eq(
  $$ select record.source from public.word_morphology_records record join public.morphology_datasets dataset on dataset.id = record.dataset_id where dataset.version = 'test-atomic-v1' and record.catalog_word_id = 'gold:inspect' $$,
  array['gold-dataset'::text],
  'the persistence layer identifies Gold words explicitly'
);
select results_eq(
  $$ select morphology_score::integer from public.word_morphology_records where catalog_word_id = 'catalog-inspect' $$,
  array[100],
  'derived candidates persist morphology score 100'
);

select * from finish();
rollback;
