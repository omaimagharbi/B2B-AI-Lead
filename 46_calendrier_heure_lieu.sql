-- =====================================================================
-- Le calendrier doit se rapprocher de Google Calendar : un evenement a
-- besoin d'un horaire (pas juste une date) et d'un lieu.
-- =====================================================================

alter table calendrier_entrees add column if not exists heure_debut time;
alter table calendrier_entrees add column if not exists duree_minutes integer;
alter table calendrier_entrees add column if not exists lieu text;
