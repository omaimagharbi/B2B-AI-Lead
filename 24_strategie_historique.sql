-- =====================================================================
-- Permet d'importer d'anciens clients/prospects (avec leur resultat) pour
-- alimenter des le depart l'onglet Strategie, avant meme d'avoir de
-- l'activite recente sur la plateforme.
-- =====================================================================

alter table targets add column if not exists resultat_historique text
  check (resultat_historique in ('gagne', 'perdu') or resultat_historique is null);
