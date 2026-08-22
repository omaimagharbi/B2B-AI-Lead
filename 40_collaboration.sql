-- =====================================================================
-- Changement 4 (cadrage) : espace de collaboration pour l'equipe —
-- messages et attribution de taches. Meme pattern RLS que notes_cibles
-- (30_crm_pipeline_notes.sql) : scope strict par client_id.
-- =====================================================================

create table if not exists messages_equipe (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  auteur_id uuid references client_users(id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_equipe_client on messages_equipe(client_id, created_at desc);

alter table messages_equipe enable row level security;

drop policy if exists "messages_equipe_select" on messages_equipe;
create policy "messages_equipe_select" on messages_equipe
  for select using (client_id = public.get_my_client_id());

drop policy if exists "messages_equipe_insert" on messages_equipe;
create policy "messages_equipe_insert" on messages_equipe
  for insert with check (client_id = public.get_my_client_id());

create table if not exists taches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  titre text not null,
  description text,
  assigne_a uuid references client_users(id) on delete set null,
  cree_par uuid references client_users(id) on delete set null,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'en_cours', 'terminee')),
  echeance date,
  created_at timestamptz not null default now()
);

create index if not exists idx_taches_client on taches(client_id, statut, created_at desc);

alter table taches enable row level security;

drop policy if exists "taches_select" on taches;
create policy "taches_select" on taches
  for select using (client_id = public.get_my_client_id());

drop policy if exists "taches_insert" on taches;
create policy "taches_insert" on taches
  for insert with check (client_id = public.get_my_client_id());

drop policy if exists "taches_update" on taches;
create policy "taches_update" on taches
  for update using (client_id = public.get_my_client_id());

drop policy if exists "taches_delete" on taches;
create policy "taches_delete" on taches
  for delete using (client_id = public.get_my_client_id());
