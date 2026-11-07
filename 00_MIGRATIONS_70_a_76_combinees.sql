-- =====================================================================
-- PiloBrain Real Estate : migrations 70 a 76 COMBINEES, dans le bon ordre.
-- A coller UNE SEULE FOIS dans Supabase > SQL Editor > Run. Idempotent (peut etre relance).
-- Deja execute 70 a 74 ? Lancer uniquement 75 et 76 (ou ce fichier, sans risque).
-- (Erreur 'relation re_messages does not exist' = le 71 a ete lance avant le 70 : ce fichier regle ca.)
-- =====================================================================

-- ########## 70 : tables ##########
-- =====================================================================
-- 70 : Real Estate OS (espace /immo) - biens, proprietaires, clients,
-- leads, deals, messages WhatsApp, annonces. Chaque ligne appartient a un
-- cabinet (client_id). Acces uniquement via les routes API (service_role) :
-- RLS activee sans policy publique = rien n'est lisible directement depuis le navigateur.
-- Idempotent : peut etre relance sans risque.
-- =====================================================================

create table if not exists re_owners (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists re_properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  type text not null default 'apartment',          -- apartment|villa|townhouse|office|shop|land
  listing text not null default 'sale',            -- sale|rent
  status text not null default 'available',        -- available|reserved|sold|rented
  area text, price numeric not null default 0,
  beds int default 0, baths int default 0, size_m2 numeric default 0,
  owner_id uuid references re_owners(id) on delete set null,
  image_url text, description text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists re_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text, nationality text,
  kind text not null default 'buyer',              -- buyer|seller|tenant|investor
  budget numeric default 0, preferred_areas text, notes text, agent text,
  created_at timestamptz not null default now()
);

create table if not exists re_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text,
  interest text, property_id uuid references re_properties(id) on delete set null,
  budget numeric default 0,
  status text not null default 'new',              -- new|qualified|viewing|negotiation|won|lost
  source text not null default 'whatsapp',         -- whatsapp|website|referral|portal|walk_in
  agent text, score int default 50, notes text,
  last_contact timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists re_deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  property_id uuid references re_properties(id) on delete set null,
  party_name text,
  kind text not null default 'sale',               -- sale|rent
  value numeric not null default 0,
  commission_pct numeric not null default 2,
  status text not null default 'negotiation',      -- negotiation|offer|contract|closed|cancelled
  agent text, closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists re_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_name text not null, contact_phone text,
  direction text not null default 'in',            -- in|out
  body text not null,
  unread boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists re_ads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  property_id uuid references re_properties(id) on delete set null,
  channel text not null default 'instagram',
  language text not null default 'en',
  tone text default 'luxury',
  content text not null,
  status text not null default 'draft',            -- draft|published
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['re_owners','re_properties','re_clients','re_leads','re_deals','re_messages','re_ads'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create index if not exists idx_%s_client on %I(client_id)', t, t);
  end loop;
end $$;

-- ########## 71 : reception WhatsApp (anti-doublons) ##########
-- 71 : reception WhatsApp pour le Real Estate OS.
-- external_id = idMessage GreenAPI : evite les doublons quand GreenAPI renvoie le meme webhook.
-- Idempotent.
alter table re_messages add column if not exists external_id text;
create unique index if not exists uq_re_messages_external
  on re_messages(client_id, external_id) where external_id is not null;

-- ########## 72 : visites, quota IA, rappels, import prospects, photos ##########
-- 72 : Real Estate OS - suite (idempotent)
--  * visites (re_visits) liees a Google Calendar
--  * suivi usage IA par source + quota mensuel par agence
--  * rappels de leads (reminded_at) et import depuis la prospection B2B (origin_target_id)
--  * bucket Storage public pour les photos de biens

create table if not exists re_visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  property_id uuid references re_properties(id) on delete set null,
  lead_id uuid references re_leads(id) on delete set null,
  contact_name text not null, contact_phone text,
  agent text,
  starts_at timestamptz not null,
  duration_min int not null default 45,
  status text not null default 'scheduled',          -- scheduled|done|cancelled|no_show
  notes text,
  calendar_event_id text,
  created_at timestamptz not null default now()
);
alter table re_visits enable row level security;
create index if not exists idx_re_visits_client_start on re_visits(client_id, starts_at);

alter table usage_ia add column if not exists source text;
create index if not exists idx_usage_ia_source on usage_ia(client_id, source, created_at desc);
alter table clients add column if not exists quota_ia_immo_mensuel int;   -- NULL = limite par defaut (variable IMMO_AI_MONTHLY_LIMIT, 300)

alter table re_leads add column if not exists reminded_at timestamptz;
alter table re_leads add column if not exists origin_target_id uuid references targets(id) on delete set null;
create index if not exists idx_re_leads_origin on re_leads(client_id, origin_target_id);

insert into storage.buckets (id, name, public) values ('immo-photos', 'immo-photos', true)
on conflict (id) do nothing;

-- ########## 73 : categories d'agenda ##########
-- 73 : categories d'agenda pour les visites / rendez-vous (idempotent).
-- Sans cette migration, l'agenda fonctionne mais les categories ne sont pas enregistrees.
alter table re_visits add column if not exists category text not null default 'viewing';

-- ########## 74 : photos, regime de propriete, responsable proprietaire, zones ##########
-- 74 : Real Estate OS - plusieurs photos, regime de propriete (freehold / usufruct),
--      responsable + dernier contact du proprietaire, zones configurables (municipalite > zone > projet > unite).
-- Idempotent : peut etre relance sans risque. Sans cette migration l'espace /immo continue de marcher
-- (les nouveaux champs ne sont simplement pas enregistres).

-- Biens : photos multiples, regime de propriete, rattachement a la hierarchie, numero d'unite
alter table re_properties add column if not exists photos jsonb not null default '[]'::jsonb;   -- liste d'URLs (la 1ere = photo de couverture = image_url)
alter table re_properties add column if not exists tenure text;                                 -- freehold | usufruct (NULL = non precise)
alter table re_properties add column if not exists usufruct_years int;                          -- duree du droit d'usufruit (annees), si tenure = usufruct
alter table re_properties add column if not exists unit_no text;                                -- numero d'unite / appartement
alter table re_properties drop constraint if exists re_properties_tenure_check;
alter table re_properties add constraint re_properties_tenure_check check (tenure is null or tenure in ('freehold','usufruct'));

-- Proprietaires : responsable (membre de l'equipe) et date du dernier contact
alter table re_owners add column if not exists responsible text;
alter table re_owners add column if not exists last_contact timestamptz;

-- Hierarchie configurable : municipalite > zone > projet (l'unite = le bien dans re_properties)
create table if not exists re_zones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  level text not null default 'zone',                       -- municipality | zone | project
  name text not null,
  name_ar text,
  parent_id uuid references re_zones(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table re_zones drop constraint if exists re_zones_level_check;
alter table re_zones add constraint re_zones_level_check check (level in ('municipality','zone','project'));
alter table re_zones enable row level security;
create index if not exists idx_re_zones_client on re_zones(client_id, level);

alter table re_properties add column if not exists zone_id uuid references re_zones(id) on delete set null;   -- noeud le plus precis (projet ou zone)
create index if not exists idx_re_properties_zone on re_properties(client_id, zone_id);
create index if not exists idx_re_properties_tenure on re_properties(client_id, tenure);

-- ########## 75 : corrections lot 1 (chambres souhaitees, commission du bien) ##########
-- 75 : Real Estate OS - corrections du lot 1 : chambres souhaitees (lead + client), commission sur le bien.
-- Idempotent. Sans cette migration l'espace /immo marche toujours (les champs ne sont simplement pas enregistres).
alter table re_leads add column if not exists beds_wanted int;
alter table re_clients add column if not exists beds_wanted int;
alter table re_properties add column if not exists commission_pct numeric(5,2);

-- ########## 76 : journal d'activite, historique d'affectation, hierarchie d'equipe ##########
-- 76 : Real Estate OS - lot 2 : journal d'activite, historique des affectations de leads, hierarchie d'equipe (chef d'equipe).
-- Idempotent. Les ecritures du journal/historique sont faites par le serveur (service role) ; RLS active sans politique = aucun acces direct depuis le navigateur.

create table if not exists re_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  actor_id uuid,                       -- client_users.id de l'auteur (pas de FK : le journal survit au retrait du membre)
  actor_name text not null default '',
  actor_role text,
  action text not null,                -- create | update | delete | assign | reassign_bulk | team_invite | team_remove | team_update
  entity text,                         -- leads, properties, owners...
  record_id uuid,
  label text,                          -- nom / titre de la fiche (jamais de coordonnees)
  details jsonb not null default '{}'::jsonb,   -- noms des champs modifies, ancien/nouvel agent... (pas les valeurs sensibles)
  created_at timestamptz not null default now()
);
alter table re_activity enable row level security;
create index if not exists idx_re_activity_client_date on re_activity(client_id, created_at desc);
create index if not exists idx_re_activity_actor on re_activity(client_id, actor_name, created_at desc);

create table if not exists re_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  lead_id uuid not null references re_leads(id) on delete cascade,
  lead_name text,
  from_agent text,                     -- NULL = sans agent
  to_agent text,                       -- NULL = sans agent
  by_name text,                        -- qui a fait le changement
  reason text,                         -- creation | manual | bulk | agent_removed
  created_at timestamptz not null default now()
);
alter table re_assignments enable row level security;
create index if not exists idx_re_assignments_lead on re_assignments(client_id, lead_id, created_at desc);

create table if not exists re_hierarchy (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  member_id uuid not null references client_users(id) on delete cascade,
  is_lead boolean not null default false,                       -- chef d'equipe
  reports_to uuid references client_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, member_id)
);
alter table re_hierarchy enable row level security;
