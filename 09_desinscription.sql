-- =====================================================
-- AJOUT : desinscription des prospects (conformite RGPD/loi anti-spam)
-- A executer dans Supabase > SQL Editor
-- =====================================================

alter table targets add column if not exists ne_plus_contacter boolean not null default false;
alter table targets add column if not exists token_desinscription text unique
  default encode(gen_random_bytes(12), 'hex');

-- On force la generation du token pour les lignes deja existantes (si la colonne
-- vient d'etre ajoutee, le default ne s'applique qu'aux nouvelles lignes)
update targets set token_desinscription = encode(gen_random_bytes(12), 'hex')
where token_desinscription is null;
