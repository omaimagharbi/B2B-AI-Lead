-- =====================================================================
-- Bloc 3 "Inputs Stratégiques" du cadrage : seul le taux de closing
-- historique (avant la plateforme) est utile en saisie manuelle - les
-- objections passees, canaux echoues et volume de travail seront mesures
-- directement par l'usage reel de la plateforme (deja fait, cf.
-- /api/strategie/generer qui calcule les taux par canal/segment reels).
--
-- Inputs marketing : mots-cles d'expertise (perimetre technique du
-- cabinet) et idees recues du marche (pour la matrice de contre-objection).
-- =====================================================================

alter table clients add column if not exists taux_closing_historique numeric;
alter table clients add column if not exists mots_cles_expertise text;
alter table clients add column if not exists idees_recues_marche text;
