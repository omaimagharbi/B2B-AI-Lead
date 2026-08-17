-- =====================================================================
-- Rapport de diagnostic (retours cadrage) : l'expert doit pouvoir ajouter
-- une phrase personnalisee avant l'envoi ("touche humaine" du rapport).
-- =====================================================================

alter table diagnostics add column if not exists commentaire_expert text;
