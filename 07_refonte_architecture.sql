-- =====================================================================
-- REFONTE ARCHITECTURE : Sourcing par pays + Validation humaine + Packs
-- ⚠️ ATTENTION : ce script supprime et recree les tables targets, diagnostics
-- et leads. Toutes les donnees de test existantes dans ces 3 tables seront
-- perdues. client_users, verticals, outreach_campaigns et subscriptions
-- sont conserves.
-- A executer dans Supabase > SQL Editor
-- =====================================================================

-- =====================================================================
-- 1. NETTOYAGE DES ANCIENNES TABLES (dans l'ordre a cause des FK)
-- =====================================================================
drop table if exists leads cascade;
drop table if exists leads_packs cascade;
drop table if exists outreach_campaigns cascade;
drop table if exists diagnostics cascade;
drop table if exists targets cascade;
drop table if exists client_countries cascade;

-- =====================================================================
-- 2. CLIENTS : ajout du mode de ciblage (pour le vertical hybride Cabinet)
-- =====================================================================
alter table clients add column if not exists mode_ciblage text default 'entreprise'
  check (mode_ciblage in ('entreprise', 'particulier'));

-- On ne touche pas a zone_geographique (conservee par compatibilite),
-- le sourcing se basera desormais sur client_countries ci-dessous

-- =====================================================================
-- 3. CLIENT_COUNTRIES : pays cibles selectionnes par le cabinet
-- =====================================================================
create table client_countries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  country_code text not null check (
    country_code in ('TN', 'FR', 'BE', 'CA', 'MA', 'DZ', 'CI')
  ),
  created_at timestamptz default now(),
  unique (client_id, country_code)
);

-- =====================================================================
-- 4. TARGETS : structure adaptee Entreprise OU Particulier
-- =====================================================================
create table targets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  nom text not null,
  entreprise_ou_objectif text, -- nom entreprise (mode entreprise) OU objectif personnel (mode particulier)
  poste_ou_budget text,        -- poste occupe (mode entreprise) OU budget indicatif (mode particulier)
  telephone text,
  email text,
  linkedin_url text,           -- necessaire techniquement pour le sourcing/dedoublonnage
  country text,                -- code pays ou le prospect a ete trouve (TN, FR, etc.)
  source_scraping text,
  statut text not null default 'nouveau' check (statut in ('nouveau', 'contacte')),
  created_at timestamptz default now()
);

-- =====================================================================
-- 5. DIAGNOSTICS : workflow brouillon IA -> validation humaine
-- =====================================================================
create table diagnostics (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references targets(id) on delete cascade not null,
  client_id uuid references clients(id) on delete cascade not null,
  vertical_id uuid references verticals(id) not null,
  phrase_brute_prospect text,
  json_ia_brouillon jsonb,     -- genere par l'IA, jamais montre tel quel au prospect
  json_expert_valide jsonb,    -- version relue/ajustee par l'expert du cabinet
  token_acces text unique not null default encode(gen_random_bytes(16), 'hex'),
  statut_validation text not null default 'brouillon_ia' check (
    statut_validation in ('brouillon_ia', 'en_attente_validation', 'valide_par_expert', 'rejete')
  ),
  created_at timestamptz default now()
);

-- =====================================================================
-- 6. OUTREACH_CAMPAIGNS : recree (structure inchangee, juste re-liee)
-- =====================================================================
create table outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  target_id uuid references targets(id) on delete cascade not null,
  canal text not null check (canal in ('whatsapp', 'email', 'linkedin')),
  template_message text,
  statut text not null default 'planifie' check (statut in ('planifie', 'envoye', 'echoue')),
  date_envoi timestamptz,
  created_at timestamptz default now()
);

-- =====================================================================
-- 7. LEADS_PACKS : remplace l'ancienne table "leads" - vente par packs
-- =====================================================================
create table leads_packs (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid references diagnostics(id) on delete cascade not null,
  pack_propose_nom text,
  prix_pack numeric,
  statut_vente text not null default 'propose' check (
    statut_vente in ('propose', 'accepte', 'refuse')
  ),
  created_at timestamptz default now()
);

-- =====================================================================
-- 8. SECURITE : RLS + policies (le cabinet ne voit que ses propres donnees)
-- =====================================================================
alter table client_countries enable row level security;
alter table targets enable row level security;
alter table diagnostics enable row level security;
alter table outreach_campaigns enable row level security;
alter table leads_packs enable row level security;

-- La fonction get_my_client_id() existe deja depuis l'etape 2, on la reutilise

create policy "client_countries_select_own" on client_countries
  for select using (client_id = public.get_my_client_id());
create policy "client_countries_insert_own" on client_countries
  for insert with check (client_id = public.get_my_client_id());
create policy "client_countries_delete_own" on client_countries
  for delete using (client_id = public.get_my_client_id());

create policy "targets_select_own" on targets
  for select using (client_id = public.get_my_client_id());
create policy "targets_insert_own" on targets
  for insert with check (client_id = public.get_my_client_id());

create policy "diagnostics_select_own" on diagnostics
  for select using (client_id = public.get_my_client_id());
create policy "diagnostics_update_own" on diagnostics
  for update using (client_id = public.get_my_client_id());

create policy "campaigns_select_own" on outreach_campaigns
  for select using (client_id = public.get_my_client_id());

create policy "leads_packs_select_own" on leads_packs
  for select using (
    diagnostic_id in (select id from diagnostics where client_id = public.get_my_client_id())
  );
create policy "leads_packs_update_own" on leads_packs
  for update using (
    diagnostic_id in (select id from diagnostics where client_id = public.get_my_client_id())
  );

-- Verification finale
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
