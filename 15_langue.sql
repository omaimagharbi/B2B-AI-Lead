-- =====================================================
-- AJOUT : preference de langue de l'interface
-- A executer dans Supabase > SQL Editor
-- =====================================================

alter table clients add column if not exists langue_preferee text
  check (langue_preferee in ('fr', 'en', 'ar'))
  default 'fr';
