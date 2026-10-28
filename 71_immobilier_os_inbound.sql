-- 71 : reception WhatsApp pour le Real Estate OS.
-- external_id = idMessage GreenAPI : evite les doublons quand GreenAPI renvoie le meme webhook.
-- Idempotent.
alter table re_messages add column if not exists external_id text;
create unique index if not exists uq_re_messages_external
  on re_messages(client_id, external_id) where external_id is not null;
