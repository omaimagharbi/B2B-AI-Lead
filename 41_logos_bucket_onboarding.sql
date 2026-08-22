-- =====================================================================
-- Changement 3 (cadrage) : le nouveau formulaire d'inscription permet de
-- glisser-deposer le logo du cabinet directement. Meme pattern que le
-- bucket catalogue-pdfs (28_pdf_catalogue.sql).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos_authenticated_upload" on storage.objects;
create policy "logos_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "logos_authenticated_delete" on storage.objects;
create policy "logos_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'logos' and auth.role() = 'authenticated');
