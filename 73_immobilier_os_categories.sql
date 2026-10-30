-- 73 : categories d'agenda pour les visites / rendez-vous (idempotent).
-- Sans cette migration, l'agenda fonctionne mais les categories ne sont pas enregistrees.
alter table re_visits add column if not exists category text not null default 'viewing';
