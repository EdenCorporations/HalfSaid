-- HalfSaid PCG — Row Level Security (SPEC §6, PRD §13.4).
--
-- Privacy tiers are enforced at the storage layer, not in application code.
-- THERE IS NO ADMIN ROLE THAT CAN READ ANOTHER USER'S DATA. A logged-in
-- principal (`authenticated`) can only ever see their OWN PCG rows — every tier
-- of it, none of anyone else's. `anon` sees nothing.
--
-- The only principal that bypasses RLS is Supabase's `service_role`
-- (BYPASSRLS) — the infrastructure credential. It is server-only and must never
-- be exposed to a client or used to serve cross-user reads (SPEC §6). Proven by
-- the RLS test suite (packages/pcg).
--
-- MVP scope: owner-only visibility. Cross-user sharing for Tier 2 (family) and
-- Tier 3 (clinician) requires a grants/relationship model and is post-MVP
-- (recorded as a Known Deviation). privacy_tier is stored and ready for it.

-- Schema usage.
grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.users force row level security;
grant select, update on public.users to authenticated;

create policy users_select_own on public.users
  for select to authenticated using (id = auth.uid());
create policy users_update_own on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- pcg_nodes — owner-only, all tiers of your own data, nothing of anyone else's.
-- ---------------------------------------------------------------------------
alter table public.pcg_nodes enable row level security;
alter table public.pcg_nodes force row level security;
grant select, insert, update, delete on public.pcg_nodes to authenticated;

create policy pcg_nodes_select_own on public.pcg_nodes
  for select to authenticated using (user_id = auth.uid());
create policy pcg_nodes_insert_own on public.pcg_nodes
  for insert to authenticated with check (user_id = auth.uid());
create policy pcg_nodes_update_own on public.pcg_nodes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pcg_nodes_delete_own on public.pcg_nodes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- pcg_edges — owner-only.
-- ---------------------------------------------------------------------------
alter table public.pcg_edges enable row level security;
alter table public.pcg_edges force row level security;
grant select, insert, update, delete on public.pcg_edges to authenticated;

create policy pcg_edges_select_own on public.pcg_edges
  for select to authenticated using (user_id = auth.uid());
create policy pcg_edges_insert_own on public.pcg_edges
  for insert to authenticated with check (user_id = auth.uid());
create policy pcg_edges_update_own on public.pcg_edges
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pcg_edges_delete_own on public.pcg_edges
  for delete to authenticated using (user_id = auth.uid());

-- NOTE: `anon` is intentionally granted NO table privileges — it cannot read the
-- PCG at all. No policy references any tier in a way that exposes another user's
-- data; there is deliberately no admin/clinician read path in the MVP.
