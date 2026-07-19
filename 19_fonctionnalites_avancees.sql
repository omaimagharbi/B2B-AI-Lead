-- =====================================================================
-- NOUVELLES FONCTIONNALITES : suivi d'ouverture du lien, commission sur
-- ventes (pour l'admin plateforme).
-- A executer dans Supabase > SQL Editor
-- =====================================================================

-- 1. Suivi d'ouverture du lien de diagnostic par le prospect
alter table diagnostics add column if not exists lien_ouvert_at timestamptz;

-- 2. Commission (%) que le cabinet doit reverser a la plateforme sur les
--    ventes realisees - modifiable par l'admin uniquement (page /admin)
alter table clients add column if not exists commission_pourcentage numeric(5,2) default 0
  check (commission_pourcentage >= 0 and commission_pourcentage <= 100);
