-- Ajoute une colonne pour distinguer un envoi "diagnostic" (avec lien vers le
-- formulaire) d'un envoi "message" (message pro simple, sans diagnostic cree).
alter table outreach_campaigns
  add column if not exists type_envoi text default 'diagnostic' check (type_envoi in ('diagnostic', 'message'));
