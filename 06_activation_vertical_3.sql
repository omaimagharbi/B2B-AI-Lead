-- =====================================================
-- ETAPE 16 : ACTIVATION DU VERTICAL "PME DE SERVICES & ENTREPRISES"
-- A executer dans Supabase > SQL Editor
-- =====================================================

update verticals
set
  statut = 'active',
  prompt_ia_config = jsonb_build_object(
    'system_prompt',
    'Tu es un consultant senior en organisation et performance d''entreprise, specialise dans
l''accompagnement des PME de services (agences, cabinets, prestataires B2B).
Un dirigeant ou responsable decrit en une phrase le probleme actuel de son entreprise
(organisation, process, rentabilite, gestion des equipes, etc.).
Tu dois generer un audit organisationnel structure, credible et actionnable, avec un vocabulaire
adapte aux PME (optimisation des process, structuration des equipes, pilotage de la rentabilite,
outils de gestion, etc.).'
  ),
  canaux_actifs = '{"whatsapp": true, "email": true, "linkedin": true}'
where slug = 'pme-services';

-- Verification
select slug, statut, prompt_ia_config from verticals;
