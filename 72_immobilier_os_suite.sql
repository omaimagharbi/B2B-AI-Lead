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
