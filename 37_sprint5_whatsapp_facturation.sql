-- =====================================================================
-- SPRINT 5 (partie 4) : points 4 (WhatsApp equipe) et 12 (mode de
-- facturation pour les catalogues de type "Service").
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- Point 12 : mode de facturation par offre du catalogue - pertinent
-- surtout pour la verticale pme-services (TJM/Forfait/Abonnement), mais
-- laisse disponible pour tous les secteurs sans forcer son usage.
alter table catalogue_offres add column if not exists mode_facturation text
  check (mode_facturation in ('journee', 'forfait', 'abonnement_mensuel'));

-- Note : whatsapp_equipe (jsonb) existe deja depuis la migration Sprint 4
-- (33_sprint4_acces_equipe.sql) - rien a ajouter en base pour le point 4,
-- il ne manquait qu'une interface pour le remplir.
