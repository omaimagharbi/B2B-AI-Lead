-- =====================================================================
-- Page "Mon profil" complete (retour terrain, doc changement_plateforme,
-- point 6) : au-dela de nom/telephone/photo deja existants, on ajoute les
-- infos generales (email gere par auth.users, pas duplique ici) + pays,
-- genre, date de naissance, et 3 sections a entrees multiples
-- (Experiences, Formation, Missions) sur le modele des captures fournies.
-- =====================================================================

alter table client_users add column if not exists pays text;
alter table client_users add column if not exists genre text
  check (genre in ('homme', 'femme', 'autre'));
alter table client_users add column if not exists date_naissance date;

create table if not exists client_users_experiences (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references client_users(id) on delete cascade,
  intitule text not null,
  entreprise text,
  date_debut date,
  date_fin date,
  en_cours boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists client_users_formations (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references client_users(id) on delete cascade,
  diplome text not null,
  etablissement text,
  date_debut date,
  date_fin date,
  en_cours boolean not null default false,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists client_users_missions (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references client_users(id) on delete cascade,
  titre text not null,
  description text,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'terminee')),
  created_at timestamptz not null default now()
);

create index if not exists idx_client_users_experiences_user on client_users_experiences(client_user_id);
create index if not exists idx_client_users_formations_user on client_users_formations(client_user_id);
create index if not exists idx_client_users_missions_user on client_users_missions(client_user_id);
