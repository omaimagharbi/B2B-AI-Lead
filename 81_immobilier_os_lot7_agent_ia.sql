-- 81 : Real Estate OS - lot 7 : AI Real Estate Agent (reponse automatique avec garde-fous), qualite des echanges.
-- Idempotent. Chaque reponse automatique est DESACTIVABLE par l'agence (ai_agent.auto_reply, desactive par defaut)
-- et laisse une trace dans le journal d'activite (re_activity : actions ai_auto_reply / ai_handoff / ai_blocked).
alter table re_settings add column if not exists ai_agent jsonb not null default '{}'::jsonb;
alter table re_messages add column if not exists auto boolean not null default false;  -- message envoye automatiquement par l'agent IA
create index if not exists idx_re_messages_auto on re_messages(client_id, contact_name, created_at desc) where auto;
