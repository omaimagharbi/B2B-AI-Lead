-- =====================================================================
-- Retour terrain : un cabinet ayant acces a plusieurs secteurs
-- (verticals_autorises) voit toutes ses cibles/diagnostics melanges sans
-- distinction visuelle de quel secteur ils viennent - targets n'avait
-- aucune colonne "vertical", contrairement a diagnostics qui l'a deja.
-- =====================================================================

alter table targets add column if not exists vertical_id uuid references verticals(id);

-- Backfill : rattache chaque cible existante au vertical_id actuel de son
-- cabinet (best effort - impossible de deviner retroactivement sous quel
-- secteur actif une cible a ete sourcee avant ce correctif).
update targets t
set vertical_id = c.vertical_id
from clients c
where t.client_id = c.id
  and t.vertical_id is null;
