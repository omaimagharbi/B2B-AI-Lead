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
