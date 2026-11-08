-- 78 : Real Estate OS - lot 5 : conformite et garde-fous WhatsApp.
--  * consentement + "ne plus contacter" (STOP) sur leads / clients / proprietaires
--  * lien de desinscription (meme mecanisme que la partie B2B, migration 09)
--  * reglage agence : que faire d'un numero inconnu qui ecrit (re_settings)
--  * acceptation de la charte d'utilisation par chaque membre (re_charter_acceptances)
-- Idempotent. Textes juridiques : brouillons a faire valider par un juriste local avant mise en production.

do $$
declare t text;
begin
  foreach t in array array['re_leads', 're_clients', 're_owners'] loop
    execute format('alter table %I add column if not exists do_not_contact boolean not null default false', t);
    execute format('alter table %I add column if not exists do_not_contact_at timestamptz', t);
    execute format('alter table %I add column if not exists do_not_contact_reason text', t);   -- stop_keyword | manual | unsubscribe_link
    execute format('alter table %I add column if not exists consent_at timestamptz', t);
    execute format('alter table %I add column if not exists consent_source text', t);          -- web_form | whatsapp_inbound | manual
    execute format('alter table %I add column if not exists consent_version text', t);
    execute format('alter table %I add column if not exists token_desinscription text', t);
    execute format('update %I set token_desinscription = replace(gen_random_uuid()::text, ''-'', '''') where token_desinscription is null', t);
    execute format('alter table %I alter column token_desinscription set default replace(gen_random_uuid()::text, ''-'', '''')', t);
    execute format('create unique index if not exists %I on %I(token_desinscription)', 'uq_' || t || '_unsub', t);
    execute format('create index if not exists %I on %I(client_id) where do_not_contact', 'idx_' || t || '_dnc', t);
  end loop;
end $$;

create table if not exists re_settings (
  client_id uuid primary key references clients(id) on delete cascade,
  -- create_lead : tout numero inconnu devient un lead (comportement historique)
  -- if_property : lead seulement si le message cite un bien ou une intention immobiliere claire, sinon simple message
  -- inbox_only  : jamais de lead automatique, le message arrive dans la boite de reception
  -- ignore      : le message d'un numero inconnu est ignore
  unknown_number_rule text not null default 'create_lead' check (unknown_number_rule in ('create_lead', 'if_property', 'inbox_only', 'ignore')),
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table re_settings enable row level security;

create table if not exists re_charter_acceptances (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  user_id uuid not null,               -- client_users.id (pas de FK : la preuve d'acceptation survit au retrait du membre)
  user_name text,
  version text not null,
  lang text,
  accepted_at timestamptz not null default now(),
  unique (client_id, user_id, version)
);
alter table re_charter_acceptances enable row level security;
create index if not exists idx_re_charter_client on re_charter_acceptances(client_id, version);
