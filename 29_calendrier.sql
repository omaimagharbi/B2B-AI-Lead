-- =====================================================================
-- Calendrier manuel du cabinet : rendez-vous clients, evenements choisis,
-- appels d'offres reperes manuellement. Aucune automatisation, aucun lien
-- avec les cibles.
-- =====================================================================

create table if not exists calendrier_entrees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titre text not null,
  description text,
  date_evenement date not null,
  type text not null default 'autre' check (type in ('rdv', 'evenement', 'appel_offre', 'autre')),
  lien text,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendrier_entrees_client
  on calendrier_entrees(client_id, date_evenement);

alter table calendrier_entrees enable row level security;

drop policy if exists "calendrier_entrees_select" on calendrier_entrees;
create policy "calendrier_entrees_select" on calendrier_entrees
  for select using (client_id = public.get_my_client_id());

drop policy if exists "calendrier_entrees_insert" on calendrier_entrees;
create policy "calendrier_entrees_insert" on calendrier_entrees
  for insert with check (client_id = public.get_my_client_id());

drop policy if exists "calendrier_entrees_delete" on calendrier_entrees;
create policy "calendrier_entrees_delete" on calendrier_entrees
  for delete using (client_id = public.get_my_client_id());
