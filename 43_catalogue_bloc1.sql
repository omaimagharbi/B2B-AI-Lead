-- =====================================================================
-- Le catalogue doit refleter le BLOC 1 du cadrage stategique (identite
-- des offres) : thematique, format inter/intra-entreprise, mode de
-- delivrance, et USP/differenciation - affiches ensuite en tableau plutot
-- qu'en liste de lignes.
-- =====================================================================

alter table catalogue_offres add column if not exists thematique text;
alter table catalogue_offres add column if not exists format text
  check (format is null or format in ('inter_entreprise', 'intra_entreprise'));
alter table catalogue_offres add column if not exists mode_delivrance text
  check (mode_delivrance is null or mode_delivrance in ('presentiel', 'en_ligne', 'blended'));
alter table catalogue_offres add column if not exists usp text;
