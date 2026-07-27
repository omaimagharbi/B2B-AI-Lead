-- =====================================================================
-- Ajoute le role "directeur_commercial" (entre "proprietaire" et "membre")
-- pour permettre a un cabinet de designer un responsable qui suit
-- l'activite des commerciaux (cibles assignees, contactees, etc.)
-- sans etre lui-meme le proprietaire du cabinet.
-- A executer dans Supabase > SQL Editor, APRES 20_correctif_invite_equipe.sql
-- =====================================================================

alter table client_users drop constraint if exists client_users_role_check;

alter table client_users add constraint client_users_role_check
  check (role in ('proprietaire', 'directeur_commercial', 'membre'));
