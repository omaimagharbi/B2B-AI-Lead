-- =====================================================================
-- Scraping auto du cabinet lui-meme (doc "1- Input commercialisation",
-- section 2) : positionnement/expertises extraits automatiquement du site
-- web (fetch direct + IA), et ligne editoriale extraite de LinkedIn/
-- Facebook (via un outil tiers type Apify/PhantomBuster, meme pattern que
-- le scraping de prospects existant - LinkedIn/Facebook ne sont pas
-- scrapables par simple fetch HTTP, contrairement a un site web public).
-- =====================================================================

alter table clients add column if not exists positionnement_site text;
alter table clients add column if not exists ligne_editoriale_reseaux text;
alter table clients add column if not exists derniere_analyse_cabinet_at timestamptz;
