-- =====================================================================
-- Point 57 : synchronisation email bidirectionnelle reelle (IMAP), en plus
-- du webhook de reception existant (Resend Inbound). Chaque cabinet peut
-- brancher sa propre boite mail professionnelle pour que les reponses
-- arrivent dans la plateforme meme si elles ne passent pas par le domaine
-- gere par Resend.
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

alter table clients add column if not exists imap_host text;
alter table clients add column if not exists imap_port integer default 993;
alter table clients add column if not exists imap_utilisateur text;
alter table clients add column if not exists imap_mot_de_passe text;
alter table clients add column if not exists imap_secure boolean not null default true;
alter table clients add column if not exists imap_actif boolean not null default false;
alter table clients add column if not exists imap_derniere_sync_at timestamptz;
alter table clients add column if not exists imap_derniere_erreur text;

-- NOTE SECURITE : imap_mot_de_passe est stocke en clair dans cette version.
-- Pour la prod, il est recommande de le chiffrer (ex: pgsodium/Supabase
-- Vault, ou chiffrement applicatif avant insertion) plutot que de le
-- laisser lisible directement en base. A traiter avant d'onboarder de
-- vrais clients sur cette fonctionnalite.
