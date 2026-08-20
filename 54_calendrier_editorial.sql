-- =====================================================================
-- Marketing (doc "Strategie Marketing sur-mesure") : le calendrier
-- editorial mensuel et la matrice de contre-objection etaient decrits
-- comme des livrables structures mais n'existaient que sous forme d'une
-- ligne de contexte dans le prompt de /api/strategie/generer. On en fait
-- de vrais livrables persistes et affichables.
-- =====================================================================

create table if not exists calendrier_editorial (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  semaine int not null check (semaine between 1 and 4),
  theme text not null,
  format_suggere text,
  angle_accroche text,
  statut text not null default 'a_faire' check (statut in ('a_faire', 'publie')),
  created_at timestamptz not null default now()
);

create table if not exists matrice_contre_objection (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  objection text not null,
  angle_contenu text not null,
  format_suggere text,
  created_at timestamptz not null default now()
);

create index if not exists idx_calendrier_editorial_client on calendrier_editorial(client_id);
create index if not exists idx_matrice_contre_objection_client on matrice_contre_objection(client_id);
