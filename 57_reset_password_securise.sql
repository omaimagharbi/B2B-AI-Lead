-- =====================================================================
-- Securise le flux "mot de passe oublie" : l'ancien systeme changeait le
-- mot de passe directement avec juste l'email (n'importe qui connaissant
-- l'email d'un compte pouvait le pirater). Maintenant, on envoie un code
-- a 6 chiffres par email (Resend fonctionne de maniere fiable depuis
-- l'ajout de l'envoi automatique des identifiants) et on exige ce code
-- avant de changer le mot de passe.
-- =====================================================================

create table if not exists reinitialisations_mdp (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  expires_at timestamptz not null,
  utilise boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reinitialisations_mdp_email on reinitialisations_mdp(email, code);

alter table reinitialisations_mdp enable row level security;
-- Aucune policy select/insert/update pour les roles anon/authenticated :
-- cette table n'est manipulee que par les routes API via supabaseAdmin
-- (service role, qui contourne RLS), jamais directement par le client.
