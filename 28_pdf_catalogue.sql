-- =====================================================================
-- Permet d'attacher un PDF (syllabus/brochure) a chaque offre du catalogue.
-- Sert a la fois a pre-remplir le formulaire (extraction IA) et a etre
-- envoye au prospect avec le pack correspondant.
-- =====================================================================

alter table catalogue_offres add column if not exists pdf_url text;

insert into storage.buckets (id, name, public)
values ('catalogue-pdfs', 'catalogue-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "catalogue_pdfs_public_read" on storage.objects;
create policy "catalogue_pdfs_public_read" on storage.objects
  for select using (bucket_id = 'catalogue-pdfs');

drop policy if exists "catalogue_pdfs_authenticated_upload" on storage.objects;
create policy "catalogue_pdfs_authenticated_upload" on storage.objects
  for insert with check (bucket_id = 'catalogue-pdfs' and auth.role() = 'authenticated');

drop policy if exists "catalogue_pdfs_authenticated_delete" on storage.objects;
create policy "catalogue_pdfs_authenticated_delete" on storage.objects
  for delete using (bucket_id = 'catalogue-pdfs' and auth.role() = 'authenticated');
