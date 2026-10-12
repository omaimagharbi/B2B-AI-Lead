-- =====================================================================
-- 70 : Suivi des connexions et du temps passe (admin > "Suivi testeur")
-- A executer dans Supabase > SQL Editor. Sur a rejouer plusieurs fois.
--
-- Une ligne = une "visite" d'un utilisateur connecte (de son entree
-- jusqu'a sa derniere activite). Le navigateur envoie un signal toutes les
-- ~30 s tant que l'onglet est visible ; le serveur cumule le temps ACTIF.
-- RLS activee SANS policy : seule la service_role (routes API) y accede,
-- jamais le navigateur directement.
-- =====================================================================
create table if not exists suivi_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  auth_user_id uuid not null,
  email text not null,
  debut timestamptz not null default now(),
  derniere_activite timestamptz not null default now(),
  duree_secondes integer not null default 0,
  pages jsonb not null default '[]'::jsonb,
  appareil text
);

create index if not exists idx_suivi_sessions_email_debut
  on suivi_sessions (lower(email), debut desc);

alter table suivi_sessions enable row level security;
