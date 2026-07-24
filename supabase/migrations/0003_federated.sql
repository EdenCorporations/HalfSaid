-- HalfSaid — Federated communication-model store (SPEC §F).
--
-- These tables hold ONLY the aggregate, global communication model and a round log.
-- No patient data, no PCG, no utterances ever land here — a clinic only ever submits
-- a masked, DP-noised weight delta, and only the aggregated result is stored.

create table public.federated_model (
  id         smallint primary key default 1 check (id = 1), -- singleton
  round      int not null default 0,
  weights    jsonb not null, -- the ranker weight vector (aggregate model)
  updated_at timestamptz not null default now()
);

comment on table public.federated_model is
  'Singleton global communication model (aggregate ranker weights). No patient data.';

create table public.federated_round_log (
  id            uuid primary key default gen_random_uuid(),
  round         int not null,
  clinics       int not null,       -- how many clinics contributed
  epsilon_spent real not null,      -- DP budget spent this round
  delta_spent   real not null,
  created_at    timestamptz not null default now()
);

-- Seed the initial model with the ranker's initial weights (PRD §17.2).
insert into public.federated_model (id, round, weights) values
  (1, 0, '{"relevance":0.35,"personalVoice":0.2,"safety":0.15,"recency":0.15,"variety":0.1,"contextMatch":0.05}'::jsonb);

-- RLS: aggregate model, readable by any authenticated clinician; the aggregator
-- (server) performs writes. Permissive for the MVP — there is no per-patient data to
-- scope, and nothing here can be traced to an individual.
alter table public.federated_model enable row level security;
alter table public.federated_model force row level security;
alter table public.federated_round_log enable row level security;
alter table public.federated_round_log force row level security;

grant select, update on public.federated_model to authenticated;
grant select, insert on public.federated_round_log to authenticated;

create policy fed_model_read on public.federated_model
  for select to authenticated using (true);
create policy fed_model_write on public.federated_model
  for update to authenticated using (true) with check (true);
create policy fed_log_read on public.federated_round_log
  for select to authenticated using (true);
create policy fed_log_write on public.federated_round_log
  for insert to authenticated with check (true);
