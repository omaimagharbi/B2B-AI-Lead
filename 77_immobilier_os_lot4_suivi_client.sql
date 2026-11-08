-- 77 : Real Estate OS - lot 4 : fiche client complete, resultat du contact, bien detecte dans un message,
--      biens envoyes au client, suivi pas a pas des leads/deals (etapes), alerte lead chaud (anti-doublon).
-- Idempotent. Les ecritures de re_stages / re_sends / re_hot_alerts sont faites par le serveur (service role) ;
-- RLS active sans politique = aucun acces direct depuis le navigateur (meme principe que la migration 76).
-- Sans cette migration l'espace continue de fonctionner : les nouvelles fonctions sont simplement inactives.

-- n°105 / n°89 : bien auquel un message se rapporte (detecte automatiquement ou choisi a la main)
alter table re_messages add column if not exists property_id uuid references re_properties(id) on delete set null;
alter table re_messages add column if not exists property_auto boolean not null default false;
create index if not exists idx_re_messages_property on re_messages(client_id, property_id);

-- n°99 : resultat du contact enregistre sur une conversation (historique : le dernier fait foi)
create table if not exists re_outcomes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_name text not null,
  contact_phone text,
  outcome text not null,               -- callback | viewing_booked | offer_made | info_sent | no_answer | not_interested | wrong_number | other
  note text,
  agent text,                          -- auteur de l'enregistrement
  created_at timestamptz not null default now()
);
alter table re_outcomes enable row level security;
create index if not exists idx_re_outcomes_contact on re_outcomes(client_id, contact_name, created_at desc);

-- n°4 : biens envoyes a un client (un enregistrement par envoi)
create table if not exists re_sends (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  property_id uuid references re_properties(id) on delete set null,
  property_title text,                 -- copie du titre : l'historique reste lisible si le bien est supprime
  contact_name text not null,
  contact_phone text,
  agent text,                          -- qui a envoye
  channel text not null default 'whatsapp',
  created_at timestamptz not null default now()
);
alter table re_sends enable row level security;
create index if not exists idx_re_sends_contact on re_sends(client_id, contact_name, created_at desc);
create index if not exists idx_re_sends_property on re_sends(client_id, property_id);

-- n°48 / n°86 / n°98 : historique des changements d'etape (leads et deals) + actions automatiques declenchees
create table if not exists re_stages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null check (kind in ('lead', 'deal')),
  record_id uuid not null,             -- id du lead ou du deal (pas de FK : l'historique survit a la suppression)
  record_name text,
  from_status text,                    -- NULL = creation
  to_status text not null,
  by_name text,
  auto jsonb not null default '[]'::jsonb,   -- codes des actions automatiques (tache creee, bien vendu...)
  created_at timestamptz not null default now()
);
alter table re_stages enable row level security;
create index if not exists idx_re_stages_record on re_stages(client_id, kind, record_id, created_at desc);

-- n°41 / n°81 : une alerte "lead chaud" au maximum par lead et par periode (la contrainte unique empeche les doublons
-- meme si deux executions arrivent en meme temps)
create table if not exists re_hot_alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  lead_id uuid not null references re_leads(id) on delete cascade,
  period_key bigint not null,          -- numero de la periode (voir lib/immo-os/hot-alert.ts)
  score int,
  created_at timestamptz not null default now(),
  unique (lead_id, period_key)
);
alter table re_hot_alerts enable row level security;
create index if not exists idx_re_hot_alerts_lead on re_hot_alerts(lead_id, created_at desc);
