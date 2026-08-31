-- =====================================================================
-- Le "signal detecte" affiche sur la carte prospect etait jusqu'ici un
-- texte recompose a partir de champs deja connus (poste/entreprise), pas
-- un vrai signal externe interprete par l'IA (embauche en cours, activite
-- sur les reseaux...). Ce fichier ajoute le stockage du contexte brut
-- remonte par le scraping (bio LinkedIn, activite recente, posts Facebook),
-- pour qu'un appel IA puisse ensuite en tirer un signal exploitable -
-- voir lib/signal-ia.ts.
-- =====================================================================

alter table targets add column if not exists contexte_brut_scraping text;
