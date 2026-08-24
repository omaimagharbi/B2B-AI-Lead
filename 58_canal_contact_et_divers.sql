-- Retour terrain : sur la carte d'une cible, on voit "Non assigné" et le
-- statut du pipeline, mais pas par quel canal elle a ete contactee (email ?
-- WhatsApp ? LinkedIn ?). On ajoute ce suivi.

alter table targets
  add column if not exists dernier_canal_contact text; -- 'email' | 'whatsapp' | 'linkedin'

-- Retour terrain : un nouveau membre invite n'apparaissait pas "en haut" de
-- la liste equipe - en realite, la requete ne triait pas du tout (ordre
-- Postgres non garanti). On s'assure que la colonne existe pour pouvoir
-- trier par plus recent d'abord.
alter table client_users
  add column if not exists created_at timestamptz not null default now();
