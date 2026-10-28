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
