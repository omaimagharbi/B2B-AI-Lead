-- =====================================================================
-- Chatbot support (doc changement_plateforme, point 9) : un chatbot IA
-- flottant, visible sur le dashboard client, qui repond aux questions en
-- se basant UNIQUEMENT sur un manuel d'utilisation redige par l'admin
-- (toi) - pas de connaissance generale hors sujet.
--
-- Une seule ligne globale (pas par client) : "lie avec le compte admin"
-- dans le doc = un seul manuel gere depuis /admin, partage par tous les
-- cabinets.
-- =====================================================================

create table if not exists chatbot_config (
  id int primary key default 1,
  manuel_utilisation text not null default '',
  updated_at timestamptz not null default now(),
  constraint chatbot_config_singleton check (id = 1)
);

insert into chatbot_config (id, manuel_utilisation)
values (1, '')
on conflict (id) do nothing;
