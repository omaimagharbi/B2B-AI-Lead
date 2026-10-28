-- =====================================================================
-- Ajout du canal Facebook (copier-coller manuel, comme LinkedIn - voir
-- app/api/outreach/send/route.ts). Meta interdit le demarchage a froid via
-- l'API Messenger (le prospect doit avoir ecrit en premier), donc ce canal
-- ne peut PAS etre automatise comme WhatsApp/Email - c'est volontairement
-- le meme fonctionnement que LinkedIn : on prepare le texte, le cabinet
-- le colle lui-meme.
-- =====================================================================

alter table outreach_campaigns drop constraint if exists outreach_campaigns_canal_check;
alter table outreach_campaigns add constraint outreach_campaigns_canal_check
  check (canal in ('whatsapp', 'email', 'linkedin', 'facebook'));
