-- =====================================================================
-- Badge marketing (doc "Adaptation Graphique des Badges Epures", Sprint 5)
-- : un visuel (image SVG) partageable/integrable par le cabinet sur son
-- site ou ses reseaux, avec les chiffres exprimes dans la devise adaptee
-- a sa zone (TND/USD/EUR, meme logique que lib/pays.ts deviseParZone).
-- Token public dedie (distinct des tokens d'acces prive) pour permettre
-- l'integration en <img src=...> sans authentification.
-- =====================================================================

alter table clients add column if not exists token_badge_public uuid not null default gen_random_uuid();
