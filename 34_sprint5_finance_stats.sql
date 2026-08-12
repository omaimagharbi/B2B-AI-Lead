-- =====================================================================
-- SPRINT 5 (partie 1) : stats globales plateforme + suivi financier par
-- client (facturation manuelle, sans Stripe - a ajouter plus tard si
-- besoin, une fois les cles et la grille tarifaire pretes).
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- plan_tarifaire existe deja d'apres le code (utilise dans /api/admin/clients),
-- on le garde defensif au cas ou il manquerait sur certains environnements.
alter table clients add column if not exists plan_tarifaire text;

alter table clients add column if not exists montant_abonnement numeric(10,2);
alter table clients add column if not exists devise_abonnement text default 'TND'
  check (devise_abonnement in ('TND', 'USD', 'EUR'));
alter table clients add column if not exists statut_paiement text default 'en_attente'
  check (statut_paiement in ('paye', 'en_attente', 'en_retard'));
alter table clients add column if not exists date_echeance_paiement date;
alter table clients add column if not exists mode_paiement text; -- 'cheque', 'especes', 'virement', 'stripe'...
