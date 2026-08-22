-- =====================================================================
-- Changement 4 (collaboration) : permettre de creer une tache directement
-- depuis une carte du pipeline, liee au prospect concerne.
-- =====================================================================

alter table taches add column if not exists cible_id uuid references targets(id) on delete set null;
