-- ============================================================
-- Rootline seed: "spect" word family
-- Validates: root relations, senses (polysemy), word forms
--            (derivation/inflection), and the tag system.
--
-- Idempotent: ON CONFLICT DO NOTHING (or WHERE NOT EXISTS for
-- word_senses, which has no business unique constraint).
-- ============================================================

-- ---------- tags (exams / priority / CEFR) ----------
insert into public.tags (code, name, category, description) values
  ('ielts',          'IELTS',        'exam',     '雅思考试词汇'),
  ('toefl',          'TOEFL',        'exam',     '托福考试词汇'),
  ('cet4',           'CET-4',        'exam',     '大学英语四级词汇'),
  ('cet6',           'CET-6',        'exam',     '大学英语六级词汇'),
  ('gre',            'GRE',          'exam',     'GRE 考试词汇'),
  ('high_frequency', '高频词',       'priority', '高频优先词汇'),
  ('cefr_b1',        'CEFR B1',      'cefr',     'CEFR B1 级别'),
  ('cefr_b2',        'CEFR B2',      'cefr',     'CEFR B2 级别')
on conflict (code) do nothing;

-- ---------- root: spect ----------
insert into public.roots (
  root, normalized_root, root_type, meaning_zh, meaning_en,
  language_origin, etymology, explanation, memory_tip,
  frequency_rank, productivity_score
) values (
  'spect', 'spect', 'root', '看，观察', 'to look, to see',
  'Latin', 'from Latin specere "to look at"',
  '表示"看、观察"的核心词根',
  '联想：spect 像"眼镜"(spectacles)，帮助看得更清楚',
  500, 0.85
)
on conflict (normalized_root) do nothing;

-- ---------- words: inspect / inspection / respect / perspective / spectator ----------
insert into public.words (
  word, lemma, normalized_word, phonetic_uk, phonetic_us,
  frequency_rank, frequency_score, cefr_level, difficulty_score,
  word_family, status, source
) values
  ('inspect',     'inspect',     'inspect',     '/ɪnˈspekt/',   '/ɪnˈspekt/',   1800, 0.72, 'B2', 0.55, 'spect', 'published', 'seed'),
  ('inspection',  'inspection',  'inspection',  '/ɪnˈspekʃn/',  '/ɪnˈspekʃn/',  2400, 0.61, 'B2', 0.52, 'spect', 'published', 'seed'),
  ('respect',     'respect',     'respect',     '/rɪˈspekt/',   '/rɪˈspekt/',    900, 0.88, 'B1', 0.40, 'spect', 'published', 'seed'),
  ('perspective', 'perspective', 'perspective', '/pəˈspektɪv/', '/pɚˈspektɪv/', 2100, 0.68, 'B2', 0.58, 'spect', 'published', 'seed'),
  ('spectator',   'spectator',   'spectator',   '/spekˈteɪtə/', '/ˈspekteɪtər/',5200, 0.38, 'B2', 0.62, 'spect', 'published', 'seed')
on conflict (normalized_word) do nothing;

-- ---------- word_roots: all five words share the "spect" root ----------
insert into public.word_roots (
  word_id, root_id, sequence, surface_form, role, explanation, confidence, source
)
select w.id, r.id, 1, 'spect', 'root', '核心词根，表示"看"', 1.0, 'seed'
from public.words w
cross join public.roots r
where w.normalized_word in ('inspect', 'inspection', 'respect', 'perspective', 'spectator')
  and r.normalized_root = 'spect'
on conflict (word_id, root_id, sequence) do nothing;

-- ---------- word_senses: 一词多义 / 多词性 ----------
-- inspect: verb 检查
insert into public.word_senses (
  word_id, part_of_speech, sense_order, meaning_zh, definition_en, is_common, cefr_level
)
select w.id, 'verb', 1, '检查；视察', 'to look at something carefully in order to check it', true, 'B2'
from public.words w
where w.normalized_word = 'inspect'
  and not exists (
    select 1 from public.word_senses s
    where s.word_id = w.id and s.part_of_speech = 'verb' and s.sense_order = 1
  );

-- inspection: noun 检查
insert into public.word_senses (
  word_id, part_of_speech, sense_order, meaning_zh, definition_en, is_common, cefr_level
)
select w.id, 'noun', 1, '检查；视察', 'the act of looking at something carefully', true, 'B2'
from public.words w
where w.normalized_word = 'inspection'
  and not exists (
    select 1 from public.word_senses s
    where s.word_id = w.id and s.part_of_speech = 'noun' and s.sense_order = 1
  );

-- respect: 一词多义 + 多词性 (noun x2, verb x1)
insert into public.word_senses (
  word_id, part_of_speech, sense_order, meaning_zh, definition_en, is_common, cefr_level
)
select w.id, v.pos, v.ord, v.zh, v.en, true, 'B1'
from public.words w
cross join (values
  ('noun', 1, '尊敬；敬重', 'admiration felt or shown for someone or something'),
  ('noun', 2, '方面；细节', 'a particular aspect or detail of something'),
  ('verb', 3, '尊敬；遵守', 'to admire someone, or to obey a rule or law')
) as v(pos, ord, zh, en)
where w.normalized_word = 'respect'
  and not exists (
    select 1 from public.word_senses s
    where s.word_id = w.id and s.part_of_speech = v.pos and s.sense_order = v.ord
  );

-- perspective: noun 视角 + noun 透视法
insert into public.word_senses (
  word_id, part_of_speech, sense_order, meaning_zh, definition_en, is_common, cefr_level
)
select w.id, v.pos, v.ord, v.zh, v.en, true, 'B2'
from public.words w
cross join (values
  ('noun', 1, '视角；观点', 'a particular way of viewing things'),
  ('noun', 2, '透视法', 'a technique of depicting depth on a flat surface')
) as v(pos, ord, zh, en)
where w.normalized_word = 'perspective'
  and not exists (
    select 1 from public.word_senses s
    where s.word_id = w.id and s.part_of_speech = v.pos and s.sense_order = v.ord
  );

-- spectator: noun 观众
insert into public.word_senses (
  word_id, part_of_speech, sense_order, meaning_zh, definition_en, is_common, cefr_level
)
select w.id, 'noun', 1, '观众；旁观者', 'a person who watches an event', true, 'B2'
from public.words w
where w.normalized_word = 'spectator'
  and not exists (
    select 1 from public.word_senses s
    where s.word_id = w.id and s.part_of_speech = 'noun' and s.sense_order = 1
  );

-- ---------- word_forms: inflections + derivation ----------
-- inspect: inflections + derived noun "inspection"
insert into public.word_forms (word_id, form, form_type)
select w.id, v.form, v.t
from public.words w
cross join (values
  ('inspects',    'third_person_singular'),
  ('inspected',   'past_tense'),
  ('inspecting',  'present_participle'),
  ('inspection',  'derived_noun')
) as v(form, t)
where w.normalized_word = 'inspect'
on conflict (word_id, form) do nothing;

-- respect: inflections
insert into public.word_forms (word_id, form, form_type)
select w.id, v.form, v.t
from public.words w
cross join (values
  ('respects',   'third_person_singular'),
  ('respected',  'past_tense'),
  ('respecting', 'present_participle')
) as v(form, t)
where w.normalized_word = 'respect'
on conflict (word_id, form) do nothing;

-- spectator / perspective: plurals
insert into public.word_forms (word_id, form, form_type)
select w.id, v.form, v.t
from public.words w
cross join (values
  ('spectator',   'spectators',   'plural'),
  ('perspective', 'perspectives', 'plural')
) as v(w, form, t)
where w.normalized_word = v.w
on conflict (word_id, form) do nothing;

-- ---------- word_tags: exam + priority + CEFR assignments ----------
insert into public.word_tags (word_id, tag_id, priority, source)
select w.id, t.id, 1, 'seed'
from public.words w
join public.tags t on t.code in ('ielts', 'toefl', 'cet4', 'cet6')
where w.normalized_word = 'inspect'
on conflict (word_id, tag_id) do nothing;

insert into public.word_tags (word_id, tag_id, priority, source)
select w.id, t.id, 1, 'seed'
from public.words w
join public.tags t on t.code in ('ielts', 'cet4', 'cet6')
where w.normalized_word = 'inspection'
on conflict (word_id, tag_id) do nothing;

insert into public.word_tags (word_id, tag_id, priority, source)
select w.id, t.id, 1, 'seed'
from public.words w
join public.tags t on t.code in ('cet4', 'cet6', 'high_frequency')
where w.normalized_word = 'respect'
on conflict (word_id, tag_id) do nothing;

insert into public.word_tags (word_id, tag_id, priority, source)
select w.id, t.id, 1, 'seed'
from public.words w
join public.tags t on t.code in ('toefl', 'gre')
where w.normalized_word = 'perspective'
on conflict (word_id, tag_id) do nothing;

insert into public.word_tags (word_id, tag_id, priority, source)
select w.id, t.id, 1, 'seed'
from public.words w
join public.tags t on t.code in ('toefl', 'gre')
where w.normalized_word = 'spectator'
on conflict (word_id, tag_id) do nothing;
