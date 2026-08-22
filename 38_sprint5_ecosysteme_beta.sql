-- =====================================================================
-- SPRINT 5 (partie 5) : Carte active #4 "Ecosysteme Entrepreneurial"
-- (investisseurs / incubateurs / business angels) + mecanisme generique
-- de "cartes en beta" (capture de demandes sans creer de compte).
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- 1. NOUVELLE VERTICALE : investisseur-incubateur
-- On cree la ligne seulement si elle n'existe pas deja (le slug n'a pas de
-- contrainte unique garantie dans ce projet, donc on verifie a la main).
do $$
begin
  if not exists (select 1 from verticals where slug = 'investisseur-incubateur') then
    insert into verticals (slug, statut, prompt_ia_config, canaux_actifs)
    values (
      'investisseur-incubateur',
      'active',
      jsonb_build_object(
        'system_prompt',
        'Tu es un analyste senior specialise dans l''evaluation de startups pour des investisseurs
(incubateurs, business angels, fonds de capital-risque). Un investisseur decrit en une phrase
le profil d''une startup ou d''un fondateur qu''il a repere. Tu dois generer un audit de maturite
et de potentiel de financement structure, credible et actionnable : analyse du modele de revenus,
de la scalabilite, des signaux de traction, et des points de vigilance avant un premier contact.
Utilise un vocabulaire d''investissement (traction, scalabilite, valorisation, potentiel de sortie),
jamais de jargon pedagogique ou comptable.'
      ),
      '{"whatsapp": true, "email": true, "linkedin": true}'::jsonb
    );
  else
    update verticals
    set
      statut = 'active',
      prompt_ia_config = jsonb_build_object(
        'system_prompt',
        'Tu es un analyste senior specialise dans l''evaluation de startups pour des investisseurs
(incubateurs, business angels, fonds de capital-risque). Un investisseur decrit en une phrase
le profil d''une startup ou d''un fondateur qu''il a repere. Tu dois generer un audit de maturite
et de potentiel de financement structure, credible et actionnable : analyse du modele de revenus,
de la scalabilite, des signaux de traction, et des points de vigilance avant un premier contact.
Utilise un vocabulaire d''investissement (traction, scalabilite, valorisation, potentiel de sortie),
jamais de jargon pedagogique ou comptable.'
      )
    where slug = 'investisseur-incubateur';
  end if;
end $$;

-- 2. MECANISME DE CARTES EN BETA : demandes capturees sans creer de compte,
-- pour les cartes visibles mais pas encore codees (a activer plus tard,
-- pas de liste figee ici - le choix des cartes affichees reste a trancher).
create table if not exists beta_demandes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  carte_slug text not null,
  sous_secteur text,
  traite boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_beta_demandes_traite on beta_demandes(traite, created_at desc);

alter table beta_demandes enable row level security;
-- Pas de policy publique de lecture : uniquement via supabaseAdmin cote
-- serveur (route publique d'ecriture + panneau admin de lecture).
