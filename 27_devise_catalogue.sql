-- Ajoute le choix de la devise pour chaque offre du catalogue.
alter table catalogue_offres add column if not exists devise text default 'TND';
