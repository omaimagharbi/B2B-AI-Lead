-- Retour terrain : sur la carte d'une cible, on voit "Non assigné" et le
-- statut du pipeline, mais pas par quel canal elle a ete contactee (email ?
-- WhatsApp ? LinkedIn ?). On ajoute ce suivi.

alter table targets
  add column if not exists dernier_canal_contact text; -- 'email' | 'whatsapp' | 'linkedin'

-- Retour terrain : un nouveau membre invite n'apparaissait pas "en haut" de
-- la liste equipe - en realite, la requete ne triait pas du tout (ordre
-- Postgres non garanti). On s'assure que la colonne existe pour pouvoir
-- trier par plus recent d'abord.
alter table client_users
  add column if not exists created_at timestamptz not null default now();

-- Retour terrain : le manuel du chatbot n'avait pas d'historique - chaque
-- sauvegarde ecrase la precedente sans possibilite de revenir en arriere.
create table if not exists chatbot_manuel_historique (
  id uuid primary key default gen_random_uuid(),
  manuel_utilisation text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chatbot_manuel_historique_date on chatbot_manuel_historique(created_at desc);
alter table chatbot_manuel_historique enable row level security;
-- Pas de policy anon/authenticated : gere uniquement via supabaseAdmin (service role).

-- Retour terrain : "les discussions [avec le chatbot support] doivent etre
-- enregistrees" - rien n'etait persiste, tout restait uniquement dans le
-- state React du navigateur (perdu au refresh, invisible pour l'admin).
create table if not exists chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  client_user_id uuid references client_users(id) on delete set null,
  role text not null, -- 'user' | 'bot'
  texte text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chatbot_conversations_client on chatbot_conversations(client_id, created_at desc);
alter table chatbot_conversations enable row level security;
-- Pas de policy anon/authenticated : ecrit/lu uniquement via supabaseAdmin
-- (service role), depuis les routes API qui verifient deja l'auth.
