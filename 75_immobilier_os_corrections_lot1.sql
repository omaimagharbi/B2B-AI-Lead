-- 75 : Real Estate OS - corrections du lot 1 : chambres souhaitees (lead + client), commission sur le bien.
-- Idempotent. Sans cette migration l'espace /immo marche toujours (les champs ne sont simplement pas enregistres).
alter table re_leads add column if not exists beds_wanted int;
alter table re_clients add column if not exists beds_wanted int;
alter table re_properties add column if not exists commission_pct numeric(5,2);
