-- =====================================================================
-- Catalogue des formations/services reels du cabinet. Utilise pour que
-- l'IA propose de vraies offres dans le diagnostic (au lieu d'en inventer)
-- et pour que la Strategie recommande des offres precises.
-- =====================================================================

create table if not exists catalogue_offres (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  nom text not null,
  description text,
  prix numeric,
  duree text,
  public_cible text,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalogue_offres_client on catalogue_offres(client_id);

alter table catalogue_offres enable row level security;

drop policy if exists "catalogue_offres_select" on catalogue_offres;
create policy "catalogue_offres_select" on catalogue_offres
  for select using (client_id = public.get_my_client_id());

drop policy if exists "catalogue_offres_insert" on catalogue_offres;
create policy "catalogue_offres_insert" on catalogue_offres
  for insert with check (client_id = public.get_my_client_id());

drop policy if exists "catalogue_offres_update" on catalogue_offres;
create policy "catalogue_offres_update" on catalogue_offres
  for update using (client_id = public.get_my_client_id());

drop policy if exists "catalogue_offres_delete" on catalogue_offres;
create policy "catalogue_offres_delete" on catalogue_offres
  for delete using (client_id = public.get_my_client_id());
