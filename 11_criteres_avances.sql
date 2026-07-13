-- =====================================================
-- AJOUT : criteres de ciblage avances (profession, canal, profil particulier)
-- + assouplissement de la contrainte pays (liste elargie)
-- A executer dans Supabase > SQL Editor
-- =====================================================

-- 1. On assouplit la contrainte sur les pays (la liste geree cote app s'est elargie)
alter table client_countries drop constraint if exists client_countries_country_code_check;

-- 2. Professions/postes cibles par le cabinet (mode Entreprise) - meme logique que client_countries
create table if not exists client_professions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  profession text not null,
  created_at timestamptz default now(),
  unique (client_id, profession)
);

alter table client_professions enable row level security;

drop policy if exists "client_professions_select_own" on client_professions;
create policy "client_professions_select_own" on client_professions
  for select using (client_id = public.get_my_client_id());

drop policy if exists "client_professions_insert_own" on client_professions;
create policy "client_professions_insert_own" on client_professions
  for insert with check (client_id = public.get_my_client_id());

drop policy if exists "client_professions_delete_own" on client_professions;
create policy "client_professions_delete_own" on client_professions
  for delete using (client_id = public.get_my_client_id());

-- 3. Canal de sourcing prefere (LinkedIn / Facebook / Email / Tous)
alter table clients add column if not exists canal_sourcing text
  check (canal_sourcing in ('linkedin', 'facebook', 'email', 'tous'))
  default 'linkedin';

-- 4. Profil cible en mode Particulier (distinct de la profession en mode Entreprise)
alter table clients add column if not exists profil_particulier text;
