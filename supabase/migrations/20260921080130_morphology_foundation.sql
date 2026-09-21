create table public.morphology_datasets (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  kind text not null check (kind in ('gold', 'candidate-source')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  source text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table public.morphology_roots (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.morphology_datasets (id) on delete restrict,
  root_key text not null,
  meaning_en jsonb not null default '[]'::jsonb,
  meaning_zh jsonb not null default '[]'::jsonb,
  educational_content jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, root_key)
);

create table public.morphology_families (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.morphology_datasets (id) on delete restrict,
  primary_root_id uuid references public.morphology_roots (id) on delete restrict,
  family_key text not null,
  display_name text not null,
  formation_explanation text,
  source text not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dataset_id, family_key)
);

create table public.word_morphology_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.morphology_datasets (id) on delete restrict,
  catalog_word_id text not null,
  lemma text not null,
  legacy_word_uuid uuid references public.words (id) on delete set null,
  family_id uuid references public.morphology_families (id) on delete set null,
  primary_root_id uuid references public.morphology_roots (id) on delete set null,
  confidence text not null check (confidence in ('verified', 'derived', 'none')),
  morphology_score numeric check (morphology_score between 0 and 100),
  source text not null,
  provenance jsonb not null default '{}'::jsonb,
  formation_explanation text,
  review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  unique (dataset_id, catalog_word_id),
  check ((review_status = 'rejected' and confidence = 'none') or review_status <> 'rejected')
);

create table public.word_morphology_segments (
  id uuid primary key default gen_random_uuid(),
  word_morphology_record_id uuid not null references public.word_morphology_records (id) on delete cascade,
  position integer not null check (position >= 0),
  kind text not null check (kind in ('prefix', 'root', 'suffix')),
  surface_form text not null,
  root_id uuid references public.morphology_roots (id) on delete set null,
  meaning text,
  explanation text,
  unique (word_morphology_record_id, position)
);

create table public.morphology_review_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.word_morphology_records (id) on delete restrict,
  action text not null check (action in ('approve', 'edit', 'reject', 'import')),
  actor_id uuid,
  previous_snapshot jsonb,
  result_snapshot jsonb not null,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_morphology_roots_dataset_key on public.morphology_roots (dataset_id, root_key);
create index idx_morphology_families_dataset_root on public.morphology_families (dataset_id, primary_root_id);
create index idx_word_morphology_records_dataset_root on public.word_morphology_records (dataset_id, primary_root_id);
create index idx_word_morphology_records_dataset_family on public.word_morphology_records (dataset_id, family_id);
create index idx_word_morphology_records_dataset_status on public.word_morphology_records (dataset_id, confidence, review_status);
create index idx_word_morphology_segments_record on public.word_morphology_segments (word_morphology_record_id);
create index idx_word_morphology_segments_root on public.word_morphology_segments (root_id);
create index idx_morphology_review_events_record on public.morphology_review_events (record_id);

create trigger set_updated_at_word_morphology_records
  before update on public.word_morphology_records
  for each row execute function public.set_updated_at();

alter table public.morphology_datasets enable row level security;
alter table public.morphology_roots enable row level security;
alter table public.morphology_families enable row level security;
alter table public.word_morphology_records enable row level security;
alter table public.word_morphology_segments enable row level security;
alter table public.morphology_review_events enable row level security;

create policy morphology_datasets_read_published on public.morphology_datasets for select using (status = 'published');
create policy morphology_roots_read_published on public.morphology_roots for select using (
  exists (select 1 from public.morphology_datasets dataset where dataset.id = dataset_id and dataset.status = 'published')
);
create policy morphology_families_read_published on public.morphology_families for select using (
  exists (select 1 from public.morphology_datasets dataset where dataset.id = dataset_id and dataset.status = 'published')
);
create policy word_morphology_records_read_published on public.word_morphology_records for select using (
  exists (select 1 from public.morphology_datasets dataset where dataset.id = dataset_id and dataset.status = 'published')
);
create policy word_morphology_segments_read_published on public.word_morphology_segments for select using (
  exists (
    select 1 from public.word_morphology_records record
    join public.morphology_datasets dataset on dataset.id = record.dataset_id
    where record.id = word_morphology_record_id and dataset.status = 'published'
  )
);
create policy morphology_review_events_read_published on public.morphology_review_events for select using (
  exists (
    select 1 from public.word_morphology_records record
    join public.morphology_datasets dataset on dataset.id = record.dataset_id
    where record.id = record_id and dataset.status = 'published'
  )
);
