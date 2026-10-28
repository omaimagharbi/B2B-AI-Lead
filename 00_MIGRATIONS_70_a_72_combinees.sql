-- =====================================================================
-- PiloBrain Real Estate : migrations 70 + 71 + 72 COMBINEES, dans le bon ordre.
-- A coller UNE SEULE FOIS dans Supabase > SQL Editor > Run. Idempotent (peut etre relance).
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
