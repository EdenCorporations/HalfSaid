-- HalfSaid PCG — bi-temporal schema (SPEC §4.3, PRD §13.3).
-- Migrations are the ONLY source of truth for schema (SPEC §4.3, PRD §24.4).
--
-- Every node and edge carries BOTH event_time and ingestion_time plus a
-- superseded_by self-reference. Corrections supersede (new row); the original is
-- retained. Never collapse to one timestamp, never overwrite (enforced by the
-- append-only trigger below).

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- users — the HalfSaid user (in production, id mirrors auth.users.id).
-- ---------------------------------------------------------------------------
create table public.users (
  id              uuid primary key,
  name            text,
  dob             date,
  languages       text[] not null default '{}',
  conditions      text[] not null default '{}',
  ability_profile jsonb  not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.users is 'HalfSaid users. id mirrors auth.users.id in production.';

-- ---------------------------------------------------------------------------
-- pcg_nodes — 11 node types (SPEC §4.1). Common columns here; type-specific
-- fields live in attributes JSONB.
-- ---------------------------------------------------------------------------
create table public.pcg_nodes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  node_type      text not null check (node_type in (
                   'User','Person','Place','Object','Routine','Episode',
                   'Utterance','Emotion','Intent','Topic','CulturalContext')),
  attributes     jsonb not null default '{}'::jsonb,
  event_time     timestamptz not null,                 -- when it happened in the world
  ingestion_time timestamptz not null default now(),   -- when HalfSaid learned it
  superseded_by  uuid references public.pcg_nodes(id), -- correction target; original retained
  privacy_tier   smallint not null default 1 check (privacy_tier between 0 and 3),
  salience       real not null default 0.5,
  embedding      vector(1024)                          -- backfilled by the embedder (Phase 3)
);

comment on column public.pcg_nodes.event_time is 'When the event occurred in the real world (SPEC §4.4).';
comment on column public.pcg_nodes.ingestion_time is 'When HalfSaid learned about it (SPEC §4.4).';
comment on column public.pcg_nodes.superseded_by is 'Points to the correcting row; this (original) row is retained, never overwritten.';

-- ---------------------------------------------------------------------------
-- pcg_edges — 15 edge types (SPEC §4.2).
-- ---------------------------------------------------------------------------
create table public.pcg_edges (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  edge_type      text not null check (edge_type in (
                   'spoke_to','mentioned','participates_in','occurs_in','precedes',
                   'evokes','expresses','about','replaces','refined_by','generates',
                   'has_culture','preferred_lang','supersedes','known_at')),
  from_id        uuid not null references public.pcg_nodes(id) on delete cascade,
  to_id          uuid not null references public.pcg_nodes(id) on delete cascade,
  attributes     jsonb,
  event_time     timestamptz not null,
  ingestion_time timestamptz not null default now(),
  superseded_by  uuid references public.pcg_edges(id),
  weight         real not null default 1.0
);

-- ---------------------------------------------------------------------------
-- Indexes.
-- ---------------------------------------------------------------------------
create index pcg_nodes_user_idx        on public.pcg_nodes (user_id);
create index pcg_nodes_user_type_idx   on public.pcg_nodes (user_id, node_type);
-- "active" (non-superseded) rows are what default queries want (SPEC §4.5).
create index pcg_nodes_active_idx       on public.pcg_nodes (user_id) where superseded_by is null;
create index pcg_nodes_attributes_gin   on public.pcg_nodes using gin (attributes);
-- ANN over the 1024-d embedding (SPEC §4.3). HNSW / cosine distance.
create index pcg_nodes_embedding_hnsw   on public.pcg_nodes using hnsw (embedding vector_cosine_ops);

-- Conversation-context access pattern (PRD §13.6 lists this as a GIN index; a
-- btree composite is the correct shape for these scalar equality/range lookups).
create index pcg_edges_from_to_time_idx on public.pcg_edges (from_id, to_id, event_time);
create index pcg_edges_user_type_idx    on public.pcg_edges (user_id, edge_type);

-- ---------------------------------------------------------------------------
-- Append-only invariant (SPEC §4.4): corrections supersede, never overwrite.
-- Content columns are immutable once written; only superseded_by / salience /
-- weight may change. embedding is write-once (NULL -> value) so the Phase 3
-- backfill is allowed, but a set embedding cannot be silently rewritten.
-- ---------------------------------------------------------------------------
create or replace function public.pcg_nodes_append_only() returns trigger
  language plpgsql as $$
begin
  if new.user_id      is distinct from old.user_id
     or new.node_type is distinct from old.node_type
     or new.attributes is distinct from old.attributes
     or new.event_time is distinct from old.event_time
     or new.ingestion_time is distinct from old.ingestion_time
     or new.privacy_tier is distinct from old.privacy_tier
     or (old.embedding is not null and new.embedding is distinct from old.embedding)
  then
    raise exception
      'pcg_nodes is append-only: corrections must supersede via a new row, not overwrite (SPEC 4.4)';
  end if;
  return new;
end;
$$;

create trigger pcg_nodes_no_overwrite
  before update on public.pcg_nodes
  for each row execute function public.pcg_nodes_append_only();

create or replace function public.pcg_edges_append_only() returns trigger
  language plpgsql as $$
begin
  if new.user_id      is distinct from old.user_id
     or new.edge_type is distinct from old.edge_type
     or new.from_id   is distinct from old.from_id
     or new.to_id     is distinct from old.to_id
     or new.attributes is distinct from old.attributes
     or new.event_time is distinct from old.event_time
     or new.ingestion_time is distinct from old.ingestion_time
  then
    raise exception
      'pcg_edges is append-only: corrections must supersede via a new row, not overwrite (SPEC 4.4)';
  end if;
  return new;
end;
$$;

create trigger pcg_edges_no_overwrite
  before update on public.pcg_edges
  for each row execute function public.pcg_edges_append_only();
