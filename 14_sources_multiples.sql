-- =====================================================
-- AJOUT : sources de sourcing multiples (Google Maps, Facebook, Web)
-- A executer dans Supabase > SQL Editor
-- =====================================================

alter table clients drop constraint if exists clients_canal_sourcing_check;
alter table clients add constraint clients_canal_sourcing_check
  check (canal_sourcing in ('linkedin', 'google_maps', 'facebook', 'web', 'tous'));
