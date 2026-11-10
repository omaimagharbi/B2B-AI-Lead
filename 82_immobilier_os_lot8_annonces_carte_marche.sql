-- 82 : Real Estate OS - lot 8 : carte (n°12), video du bien (n°11 / n°71), publication Instagram / Facebook (n°45 / n°75),
--      performance des annonces (n°46), import de donnees de marche par fichier (n°74).
-- Idempotent. Les jetons Meta ne sont JAMAIS stockes ici (variable d'environnement META_PAGE_ACCESS_TOKEN) ; seuls les identifiants publics de page / compte le sont.

alter table re_properties add column if not exists lat double precision check (lat is null or (lat between -90 and 90));
alter table re_properties add column if not exists lng double precision check (lng is null or (lng between -180 and 180));
alter table re_properties add column if not exists video_url text;

alter table re_ads add column if not exists published_at timestamptz;
alter table re_ads add column if not exists fb_post_id text;
alter table re_ads add column if not exists ig_media_id text;
alter table re_ads add column if not exists publish_error text;
alter table re_ads add column if not exists reach int;
alter table re_ads add column if not exists likes int;
alter table re_ads add column if not exists comments int;
alter table re_ads add column if not exists clicks int;
alter table re_ads add column if not exists metrics_at timestamptz;

create table if not exists re_social_accounts (
  client_id uuid primary key references clients(id) on delete cascade,
  fb_page_id text,                       -- identifiant de la page Facebook de l'agence
  ig_account_id text,                    -- identifiant du compte Instagram professionnel lie a la page
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table re_social_accounts enable row level security;

-- n°74 : donnees de marche importees depuis un fichier ; la SOURCE est obligatoire et affichee partout
create table if not exists re_market_data (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  import_id uuid not null,
  source text not null check (length(trim(source)) > 1),
  source_url text,
  as_of date,                            -- date a laquelle les donnees sont valables
  area text, type text, listing text,
  price numeric, size_m2 numeric, beds int, txn_date date,
  imported_by text,
  created_at timestamptz not null default now()
);
alter table re_market_data enable row level security;
create index if not exists idx_re_market_import on re_market_data(client_id, import_id);
create index if not exists idx_re_market_area on re_market_data(client_id, area, type);

-- n°11 / n°71 : videos des biens (50 Mo maximum, MP4 / WebM / MOV), bucket public (dossier = agence + UUID)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('immo-video', 'immo-video', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
