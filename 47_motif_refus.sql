-- =====================================================================
-- Chemin C du process de contact ("Refus intelligent") : quand un prospect
-- refuse, on ne le perd pas - on capture le motif et on planifie une
-- relance de courtoisie a +30/+60/+90 jours au lieu de l'abandonner.
-- =====================================================================

alter table targets add column if not exists motif_refus text;
