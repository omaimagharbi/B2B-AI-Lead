-- =====================================================
-- AJOUT : criteres de ciblage precis pour le sourcing (secteur, taille)
-- A executer dans Supabase > SQL Editor
-- =====================================================

alter table clients add column if not exists secteur_activite text;
alter table clients add column if not exists taille_entreprise text
  default 'indifferent'
  check (taille_entreprise in ('indifferent', 'pme', 'grande_entreprise', 'startup'));
