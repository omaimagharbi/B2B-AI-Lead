-- 79 : Real Estate OS - lot 6a : WhatsApp Business officiel (Meta Cloud API).
--  * un ou plusieurs numeros Meta par agence (re_wa_numbers) ; GreenAPI reste le repli quand l'agence n'a pas de numero Meta
--  * modeles de messages approuves (re_wa_templates), synchronises depuis Meta
--  * canal et statut de livraison (envoye / delivre / lu / echec) sur chaque message
-- Idempotent. Les jetons d'acces Meta ne sont JAMAIS stockes ici : variables d'environnement uniquement.

alter table re_messages add column if not exists channel text not null default 'greenapi' check (channel in ('greenapi', 'meta'));
alter table re_messages add column if not exists wa_status text;      -- sent | delivered | read | failed (messages envoyes par Meta)
alter table re_messages add column if not exists wa_error text;

create table if not exists re_wa_numbers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  phone_number_id text not null unique,   -- "Phone number ID" affiche dans Meta > WhatsApp > API Setup (pas le numero de telephone)
  waba_id text,                           -- identifiant du compte WhatsApp Business (pour synchroniser les modeles)
  display_phone text,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table re_wa_numbers enable row level security;
create index if not exists idx_re_wa_numbers_client on re_wa_numbers(client_id) where active;

create table if not exists re_wa_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  language text not null,                 -- code Meta : en, fr, ar, en_US...
  category text,                          -- MARKETING | UTILITY | AUTHENTICATION
  status text not null,                   -- APPROVED | PENDING | REJECTED | PAUSED | DISABLED
  body text,                              -- texte du corps avec {{1}}, {{2}}...
  synced_at timestamptz not null default now(),
  unique (client_id, name, language)
);
alter table re_wa_templates enable row level security;
