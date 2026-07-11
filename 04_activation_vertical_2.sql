-- =====================================================
-- ETAPE 15 : ACTIVATION DU VERTICAL "STARTUP TECH & SAAS"
-- A executer dans Supabase > SQL Editor
-- =====================================================

-- 1. On active la Carte 2 et on lui donne son propre prompt IA
--    (audit technique/logiciel au lieu du diagnostic pedagogique)
update verticals
set
  statut = 'active',
  prompt_ia_config = jsonb_build_object(
    'system_prompt',
    'Tu es un CTO/architecte logiciel senior specialise dans l''audit technique de startups SaaS.
Un fondateur ou CTO decrit en une phrase le probleme technique actuel de son produit ou de son equipe.
Tu dois generer un audit technique structure, credible et actionnable, avec un vocabulaire adapte
(dette technique, scalabilite, architecture, securite, performance, CI/CD, etc.).'
  ),
  canaux_actifs = '{"whatsapp": true, "email": true, "linkedin": true}'
where slug = 'startup-saas';

-- 2. On donne aussi un prompt explicite au vertical Cabinet de Formation
--    (pour que les deux verticals soient geres de la meme maniere en base)
update verticals
set
  prompt_ia_config = jsonb_build_object(
    'system_prompt',
    'Tu es un consultant senior en formation professionnelle et developpement des competences.
Un decideur (DRH ou Directeur) decrit en une phrase le probleme actuel de ses equipes.
Tu dois generer un diagnostic pedagogique structure, credible et actionnable.'
  )
where slug = 'cabinet-formation';

-- Verification
select slug, statut, prompt_ia_config from verticals;
