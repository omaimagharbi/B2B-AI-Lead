-- =====================================================================
-- Boite de reception : stocke les reponses des prospects (WhatsApp + Email)
-- captees via des webhooks entrants. A executer dans Supabase > SQL Editor.
-- =====================================================================

create table if not exists messages_recus (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  target_id uuid references targets(id) on delete set null,
  canal text not null check (canal in ('whatsapp', 'email')),
  contenu text not null,
  expediteur text,
  lu boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recus_client on messages_recus(client_id, created_at desc);
create index if not exists idx_messages_recus_target on messages_recus(target_id);

alter table messages_recus enable row level security;

drop policy if exists "messages_recus_select" on messages_recus;
create policy "messages_recus_select" on messages_recus
  for select using (client_id = public.get_my_client_id());

drop policy if exists "messages_recus_update" on messages_recus;
create policy "messages_recus_update" on messages_recus
  for update using (client_id = public.get_my_client_id());
