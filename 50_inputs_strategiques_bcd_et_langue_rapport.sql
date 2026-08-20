-- =====================================================================
-- Suite du Bloc 3 "Inputs Stratégiques" (cf. 49_inputs_strategiques.sql) :
-- ajout des 3 champs manuels restants (B/C/D), en saisie libre comme
-- taux_closing_historique - meme si leur usage reste "recommandation
-- textuelle de l'IA", pas un vrai bridage automatique des canaux.
--
-- + langue_rapport sur diagnostics : le commercial choisit la langue du
-- rapport final au moment de l'envoi (Étape 5), au lieu d'une langue
-- deduite automatiquement de la zone du prospect.
-- =====================================================================

alter table clients add column if not exists motifs_rejet_passes text;
alter table clients add column if not exists canaux_echoues text;
alter table clients add column if not exists volume_equipe_commerciale text;

alter table diagnostics add column if not exists langue_rapport text
  check (langue_rapport in ('fr', 'en', 'ar'))
  default 'fr';
