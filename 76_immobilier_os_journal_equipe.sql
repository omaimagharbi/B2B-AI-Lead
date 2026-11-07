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
