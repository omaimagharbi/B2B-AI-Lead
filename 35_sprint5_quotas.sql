-- =====================================================================
-- SPRINT 5 (partie 2) : quotas mensuels de cibles (Module 2 du panneau
-- Super-Admin - "Plan_Premium" et limites de consommation).
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- NULL = illimite (comportement actuel, aucun client n'est bloque tant que
-- l'admin n'a pas explicitement fixe une limite).
alter table clients add column if not exists quota_cibles_mensuel integer;

-- Fonction utilitaire : compte les cibles creees par un client depuis le
-- 1er du mois en cours. Utilisee a la fois par l'API (verification avant
-- import/scraping) et par l'admin (affichage de la jauge de consommation).
create or replace function public.cibles_extraites_ce_mois(p_client_id uuid)
returns integer as $$
  select count(*)::integer
  from public.targets
  where client_id = p_client_id
    and created_at >= date_trunc('month', now());
$$ language sql stable;
