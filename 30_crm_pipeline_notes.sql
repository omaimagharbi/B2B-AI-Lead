-- =====================================================================
-- Enrichit les cibles avec un vrai pipeline commercial (au-dela de
-- nouveau/contacte) et des notes libres par prospect.
-- =====================================================================

alter table targets add column if not exists etape_pipeline text not null default 'nouveau'
  check (etape_pipeline in ('nouveau', 'contacte', 'qualifie', 'proposition', 'negociation', 'gagne', 'perdu'));

create table if not exists notes_cibles (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references targets(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  auteur_id uuid references client_users(id) on delete set null,
  contenu text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notes_cibles_target on notes_cibles(target_id, created_at desc);

alter table notes_cibles enable row level security;

drop policy if exists "notes_cibles_select" on notes_cibles;
create policy "notes_cibles_select" on notes_cibles
  for select using (client_id = public.get_my_client_id());

drop policy if exists "notes_cibles_insert" on notes_cibles;
create policy "notes_cibles_insert" on notes_cibles
  for insert with check (client_id = public.get_my_client_id());

drop policy if exists "notes_cibles_delete" on notes_cibles;
create policy "notes_cibles_delete" on notes_cibles
  for delete using (client_id = public.get_my_client_id());
