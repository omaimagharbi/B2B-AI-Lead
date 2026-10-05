-- =====================================================================
-- Bug de securite trouve en ajoutant la suppression de cible : la table
-- targets n'avait de politique RLS que pour SELECT et INSERT (voir
-- 07_refonte_architecture.sql). Sans politique UPDATE/DELETE explicite,
-- Postgres refuse la commande par defaut - ce qui aurait fait echouer
-- silencieusement la suppression (et a probablement deja fait echouer
-- silencieusement certaines mises a jour cote client existantes :
-- assignation, changement de statut/etape pipeline, edition de fiche...).
-- =====================================================================

create policy "targets_update_own" on targets
  for update using (client_id = public.get_my_client_id());

create policy "targets_delete_own" on targets
  for delete using (client_id = public.get_my_client_id());
