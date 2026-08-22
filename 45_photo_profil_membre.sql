-- =====================================================================
-- Chaque utilisateur doit pouvoir avoir sa propre photo de profil et
-- modifier ses donnees personnelles (nom/telephone deja possible via
-- app/api/team/modifier). On ajoute la colonne manquante + le bucket
-- de stockage, meme pattern que logos (41_logos_bucket_onboarding.sql).
-- =====================================================================

alter table client_users add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_upload" on storage.objects;
create policy "avatars_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and auth.role() = 'authenticated');
