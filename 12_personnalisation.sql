-- =====================================================
-- AJOUT : personnalisation des messages (texte + logo)
-- A executer dans Supabase > SQL Editor
-- =====================================================

alter table clients add column if not exists message_personnalise text;
alter table clients add column if not exists logo_url text;
