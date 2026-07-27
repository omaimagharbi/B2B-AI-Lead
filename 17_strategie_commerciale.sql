-- =====================================================================
-- STRATEGIE COMMERCIALE (sans IA generative) : segmentation, score de
-- chaleur, recommandations par regles, et relances automatiques.
-- A executer dans Supabase > SQL Editor
-- =====================================================================

-- 1. TARGETS : segmentation + score + suivi des relances
alter table targets add column if not exists segment_categorie text;
alter table targets add column if not exists segment_urgence text
  check (segment_urgence in ('haute', 'moyenne', 'basse'));
alter table targets add column if not exists score_chaleur integer default 0
  check (score_chaleur >= 0 and score_chaleur <= 100);
alter table targets add column if not exists nb_relances integer not null default 0;
alter table targets add column if not exists derniere_relance_at timestamptz;

-- 2. DIAGNOSTICS : recommandations commerciales generees par le moteur de regles
--    (distinct du brouillon IA envoye au prospect - celles-ci sont un usage
--    interne pour le cabinet, jamais montrees au prospect)
alter table diagnostics add column if not exists recommandations_json jsonb;

-- 3. OUTREACH_CAMPAIGNS : on autorise le type 'relance' en plus de
--    'diagnostic' et 'message'
alter table outreach_campaigns drop constraint if exists outreach_campaigns_type_envoi_check;
alter table outreach_campaigns add constraint outreach_campaigns_type_envoi_check
  check (type_envoi in ('diagnostic', 'message', 'relance'));
