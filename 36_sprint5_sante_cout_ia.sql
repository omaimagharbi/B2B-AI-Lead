-- =====================================================================
-- SPRINT 5 (partie 3) : Module 4 (console sante API) + suivi de cout reel
-- en tokens IA (calcul de marge par client).
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- 1. SANTE API : un log d'appels, pas juste un "dernier statut", pour
-- pouvoir aussi voir l'historique recent en cas de panne intermittente.
create table if not exists sante_api (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('ia_diagnostic', 'whatsapp', 'email', 'sourcing')),
  succes boolean not null,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sante_api_service_date on sante_api(service, created_at desc);

-- 2. USAGE IA : consommation reelle de tokens par appel IA, pour calculer
-- le cout serveur reel par client et la marge nette (vs l'abonnement paye,
-- deja suivi dans clients.montant_abonnement depuis le Sprint 5 partie 1).
create table if not exists usage_ia (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  fournisseur text not null check (fournisseur in ('anthropic', 'gemini')),
  tokens_entree integer not null default 0,
  tokens_sortie integer not null default 0,
  cout_estime_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_usage_ia_client_date on usage_ia(client_id, created_at desc);

alter table sante_api enable row level security;
alter table usage_ia enable row level security;
-- Pas de policy publique : ces deux tables ne sont lues/ecrites que via
-- supabaseAdmin (service role) cote serveur, jamais depuis le navigateur.
