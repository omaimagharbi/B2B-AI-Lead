-- =====================================================================
-- Retours terrain post-Sprint 6 :
-- - les droits d'acces doivent se choisir par membre de l'equipe, pas
--   globalement pour tout le monde en une fois (client.onglets_masques_equipe)
-- - chaque membre doit pouvoir etre edite individuellement (nom, telephone)
-- =====================================================================

alter table client_users add column if not exists telephone text;
alter table client_users add column if not exists onglets_masques jsonb not null default '[]'::jsonb;

-- Reprise des reglages globaux existants comme valeur de depart pour chaque
-- membre deja invite (proprietaires/admins exclus, ils voient toujours tout) :
-- evite de reperdre un reglage deja fait par un cabinet qui utilisait
-- l'ancien systeme global.
update client_users cu
set onglets_masques = c.onglets_masques_equipe
from clients c
where cu.client_id = c.id
  and cu.role not in ('proprietaire', 'admin')
  and cu.onglets_masques = '[]'::jsonb
  and c.onglets_masques_equipe is not null
  and c.onglets_masques_equipe != '[]'::jsonb;

-- La colonne clients.onglets_masques_equipe n'est plus utilisee par le
-- front (remplacee par client_users.onglets_masques, par membre) mais on
-- la laisse en base sans la supprimer, au cas ou.
