-- =====================================================================
-- Changement 2 (cadrage) : le formulaire de demande beta ne doit plus
-- se contenter de l'email — on ajoute le nom de l'entreprise et un
-- numero de telephone (obligatoires desormais cote formulaire).
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

alter table beta_demandes add column if not exists nom_entreprise text;
alter table beta_demandes add column if not exists telephone text;
