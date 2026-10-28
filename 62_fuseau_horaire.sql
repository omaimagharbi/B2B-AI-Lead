-- =====================================================================
-- Le calcul des creneaux disponibles supposait un fuseau horaire fixe
-- (Tunisie, UTC+1) code en dur - faux des qu'un cabinet opere depuis un
-- autre pays (Golfe, France, etc., tous geres par ailleurs sur la
-- plateforme). On rend le fuseau configurable par cabinet.
-- =====================================================================

alter table clients add column if not exists fuseau_horaire text not null default 'Africa/Tunis';
