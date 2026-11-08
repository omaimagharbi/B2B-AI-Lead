-- 80 : Real Estate OS - lot 6b : photos et fichiers dans les conversations WhatsApp (n°35), fiche de bien avec photos (n°38 / n°91).
-- Idempotent. Le bucket est public (URL non devinable : dossier agence + UUID) car Meta doit pouvoir lire les fichiers envoyes par lien.
alter table re_messages add column if not exists media_url text;
alter table re_messages add column if not exists media_type text check (media_type in ('image', 'document', 'audio', 'video'));
alter table re_messages add column if not exists media_name text;

insert into storage.buckets (id, name, public) values ('immo-chat', 'immo-chat', true)
on conflict (id) do nothing;
