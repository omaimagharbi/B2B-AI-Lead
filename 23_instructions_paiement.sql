-- =====================================================================
-- Ajoute un champ libre pour les instructions de paiement du cabinet
-- (RIB, D17, Flouci, Western Union...), affiche au prospect une fois
-- qu'il a choisi son pack. Paiement manuel, pas d'encaissement automatique.
-- =====================================================================

alter table clients add column if not exists instructions_paiement text;
