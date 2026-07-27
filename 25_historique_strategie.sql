-- =====================================================================
-- Archive chaque generation de strategie (commerciale + marketing) avec
-- les chiffres du moment, pour garder un historique consultable.
-- =====================================================================

create table if not exists strategies_generees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  recommandation_commerciale text,
  recommandation_marketing text,
  stats_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_strategies_generees_client
  on strategies_generees(client_id, created_at desc);

alter table strategies_generees enable row level security;

drop policy if exists "strategies_generees_select" on strategies_generees;
create policy "strategies_generees_select" on strategies_generees
  for select using (client_id = public.get_my_client_id());
