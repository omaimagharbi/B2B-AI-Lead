-- =====================================================================
-- PiloBrain Real Estate : migrations 70 a 81 COMBINEES, dans le bon ordre.
-- A coller UNE SEULE FOIS dans Supabase > SQL Editor > Run. Idempotent (peut etre relance).
-- Deja execute 70 a 76 ? Lancer uniquement 77, 78, 79, 80, 81 (ou ce fichier, sans risque).
-- (Erreur 'relation re_messages does not exist' = le 71 a ete lance avant le 70 : ce fichier regle ca.)
-- =====================================================================

-- ########## 70 : tables ##########
-- =====================================================================
-- 70 : Real Estate OS (espace /immo) - biens, proprietaires, clients,
-- leads, deals, messages WhatsApp, annonces. Chaque ligne appartient a un
-- cabinet (client_id). Acces uniquement via les routes API (service_role) :
-- RLS activee sans policy publique = rien n'est lisible directement depuis le navigateur.
-- Idempotent : peut etre relance sans risque.
-- =====================================================================

create table if not exists re_owners (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text, notes text,
  created_at timestamptz not null default now()
);

create table if not exists re_properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  type text not null default 'apartment',          -- apartment|villa|townhouse|office|shop|land
  listing text not null default 'sale',            -- sale|rent
  status text not null default 'available',        -- available|reserved|sold|rented
  area text, price numeric not null default 0,
  beds int default 0, baths int default 0, size_m2 numeric default 0,
  owner_id uuid references re_owners(id) on delete set null,
  image_url text, description text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists re_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text, nationality text,
  kind text not null default 'buyer',              -- buyer|seller|tenant|investor
  budget numeric default 0, preferred_areas text, notes text, agent text,
  created_at timestamptz not null default now()
);

create table if not exists re_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  phone text, email text,
  interest text, property_id uuid references re_properties(id) on delete set null,
  budget numeric default 0,
  status text not null default 'new',              -- new|qualified|viewing|negotiation|won|lost
  source text not null default 'whatsapp',         -- whatsapp|website|referral|portal|walk_in
  agent text, score int default 50, notes text,
  last_contact timestamptz default now(),
  created_at timestamptz not null default now()
);

create table if not exists re_deals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  property_id uuid references re_properties(id) on delete set null,
  party_name text,
  kind text not null default 'sale',               -- sale|rent
  value numeric not null default 0,
  commission_pct numeric not null default 2,
  status text not null default 'negotiation',      -- negotiation|offer|contract|closed|cancelled
  agent text, closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists re_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  contact_name text not null, contact_phone text,
  direction text not null default 'in',            -- in|out
  body text not null,
  unread boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists re_ads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  property_id uuid references re_properties(id) on delete set null,
  channel text not null default 'instagram',
  language text not null default 'en',
  tone text default 'luxury',
  content text not null,
  status text not null default 'draft',            -- draft|published
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['re_owners','re_properties','re_clients','re_leads','re_deals','re_messages','re_ads'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create index if not exists idx_%s_client on %I(client_id)', t, t);
  end loop;
end $$;

-- ########## 71 : reception WhatsApp (anti-doublons) ##########
-- 71 : reception WhatsApp pour le Real Estate OS.
-- external_id = idMessage GreenAPI : evite les doublons quand GreenAPI renvoie le meme webhook.
-- Idempotent.
alter table re_messages add column if not exists external_id text;
create unique index if not exists uq_re_messages_external
  on re_messages(client_id, external_id) where external_id is not null;

-- ########## 72 : visites, quota IA, rappels, import prospects, photos ##########
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

-- ########## 73 : categories d'agenda ##########
-- 73 : categories d'agenda pour les visites / rendez-vous (idempotent).
-- Sans cette migration, l'agenda fonctionne mais les categories ne sont pas enregistrees.
alter table re_visits add column if not exists category text not null default 'viewing';

-- ########## 74 : photos, regime de propriete, responsable proprietaire, zones ##########
-- 74 : Real Estate OS - plusieurs photos, regime de propriete (freehold / usufruct),
--      responsable + dernier contact du proprietaire, zones configurables (municipalite > zone > projet > unite).
-- Idempotent : peut etre relance sans risque. Sans cette migration l'espace /immo continue de marcher
-- (les nouveaux champs ne sont simplement pas enregistres).

-- Biens : photos multiples, regime de propriete, rattachement a la hierarchie, numero d'unite
alter table re_properties add column if not exists photos jsonb not null default '[]'::jsonb;   -- liste d'URLs (la 1ere = photo de couverture = image_url)
alter table re_properties add column if not exists tenure text;                                 -- freehold | usufruct (NULL = non precise)
alter table re_properties add column if not exists usufruct_years int;                          -- duree du droit d'usufruit (annees), si tenure = usufruct
alter table re_properties add column if not exists unit_no text;                                -- numero d'unite / appartement
alter table re_properties drop constraint if exists re_properties_tenure_check;
alter table re_properties add constraint re_properties_tenure_check check (tenure is null or tenure in ('freehold','usufruct'));

-- Proprietaires : responsable (membre de l'equipe) et date du dernier contact
alter table re_owners add column if not exists responsible text;
alter table re_owners add column if not exists last_contact timestamptz;

-- Hierarchie configurable : municipalite > zone > projet (l'unite = le bien dans re_properties)
create table if not exists re_zones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  level text not null default 'zone',                       -- municipality | zone | project
  name text not null,
  name_ar text,
  parent_id uuid references re_zones(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table re_zones drop constraint if exists re_zones_level_check;
alter table re_zones add constraint re_zones_level_check check (level in ('municipality','zone','project'));
alter table re_zones enable row level security;
create index if not exists idx_re_zones_client on re_zones(client_id, level);

alter table re_properties add column if not exists zone_id uuid references re_zones(id) on delete set null;   -- noeud le plus precis (projet ou zone)
create index if not exists idx_re_properties_zone on re_properties(client_id, zone_id);
create index if not exists idx_re_properties_tenure on re_properties(client_id, tenure);

-- ########## 75 : corrections lot 1 (chambres souhaitees, commission du bien) ##########
-- 75 : Real Estate OS - corrections du lot 1 : chambres souhaitees (lead + client), commission sur le bien.
-- Idempotent. Sans cette migration l'espace /immo marche toujours (les champs ne sont simplement pas enregistres).
alter table re_leads add column if not exists beds_wanted int;
alter table re_clients add column if not exists beds_wanted int;
alter table re_properties add column if not exists commission_pct numeric(5,2);

-- ########## 76 : journal d'activite, historique d'affectation, hierarchie d'equipe ##########
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

-- ########## 77 ##########
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

-- ########## 78 ##########
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

-- ########## 79 ##########
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

-- ########## 80 ##########
-- 80 : Real Estate OS - lot 6b : photos et fichiers dans les conversations WhatsApp (n°35), fiche de bien avec photos (n°38 / n°91).
-- Idempotent. Le bucket est public (URL non devinable : dossier agence + UUID) car Meta doit pouvoir lire les fichiers envoyes par lien.
alter table re_messages add column if not exists media_url text;
alter table re_messages add column if not exists media_type text check (media_type in ('image', 'document', 'audio', 'video'));
alter table re_messages add column if not exists media_name text;

insert into storage.buckets (id, name, public) values ('immo-chat', 'immo-chat', true)
on conflict (id) do nothing;

-- ########## 81 ##########
-- 81 : Real Estate OS - lot 7 : AI Real Estate Agent (reponse automatique avec garde-fous), qualite des echanges.
-- Idempotent. Chaque reponse automatique est DESACTIVABLE par l'agence (ai_agent.auto_reply, desactive par defaut)
-- et laisse une trace dans le journal d'activite (re_activity : actions ai_auto_reply / ai_handoff / ai_blocked).
alter table re_settings add column if not exists ai_agent jsonb not null default '{}'::jsonb;
alter table re_messages add column if not exists auto boolean not null default false;  -- message envoye automatiquement par l'agent IA
create index if not exists idx_re_messages_auto on re_messages(client_id, contact_name, created_at desc) where auto;
