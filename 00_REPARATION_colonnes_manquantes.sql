-- =====================================================================
-- SCRIPT DE REPARATION - a executer UNE FOIS dans Supabase > SQL Editor
-- Corrige : "Erreur de chargement" (compte admin) et
--           "Impossible de charger votre compte" (compte client)
--
-- Cause : les pages admin et dashboard lisent des colonnes ajoutees par
-- plusieurs migrations SQL recentes (56 a 59). Si une seule de ces
-- migrations n'a pas ete executee sur cette base, TOUTE la requete de
-- chargement du compte echoue (admin ET client, d'ou les 2 ecrans).
--
-- Ce script est 100% sans danger : chaque ligne utilise
-- "ADD COLUMN IF NOT EXISTS", donc rejouer une colonne deja existante
-- ne fait rien (pas de perte de donnees, pas de doublon, pas d'erreur).
-- Tu peux le lancer meme si tu ne sais plus quelles migrations ont
-- deja ete executees.
-- =====================================================================

-- ---- Table clients (utilisee par le dashboard ET par /admin) ----

-- 07_refonte_architecture.sql
alter table clients add column if not exists mode_ciblage text default 'entreprise'
  check (mode_ciblage in ('entreprise', 'particulier'));

-- 10_criteres_sourcing.sql
alter table clients add column if not exists secteur_activite text;

-- 10_criteres_sourcing.sql
alter table clients add column if not exists taille_entreprise text
  default 'indifferent'
  check (taille_entreprise in ('indifferent', 'pme', 'grande_entreprise', 'startup'));

-- 11_criteres_avances.sql
alter table clients add column if not exists canal_sourcing text
  check (canal_sourcing in ('linkedin', 'facebook', 'email', 'tous'))
  default 'linkedin';

-- 11_criteres_avances.sql
alter table clients add column if not exists profil_particulier text;

-- 12_personnalisation.sql
alter table clients add column if not exists message_personnalise text;

-- 12_personnalisation.sql
alter table clients add column if not exists logo_url text;

-- 15_langue.sql
alter table clients add column if not exists langue_preferee text
  check (langue_preferee in ('fr', 'en', 'ar'))
  default 'fr';

-- 19_fonctionnalites_avancees.sql
alter table clients add column if not exists commission_pourcentage numeric(5,2) default 0
  check (commission_pourcentage >= 0 and commission_pourcentage <= 100);

-- 32_imap_sync.sql
alter table clients add column if not exists imap_host text;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_port integer default 993;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_utilisateur text;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_mot_de_passe text;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_secure boolean not null default true;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_actif boolean not null default false;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_derniere_sync_at timestamptz;

-- 32_imap_sync.sql
alter table clients add column if not exists imap_derniere_erreur text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists acces_active boolean not null default false;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists whatsapp_directeur text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists whatsapp_equipe jsonb not null default '[]'::jsonb;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists facebook_url text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists instagram_url text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists linkedin_url text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists site_web text;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists onboarding_complete boolean not null default false;

-- 33_sprint4_acces_equipe.sql
alter table clients add column if not exists onglets_masques_equipe jsonb not null default '[]'::jsonb;

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists plan_tarifaire text;

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists montant_abonnement numeric(10,2);

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists devise_abonnement text default 'TND'
  check (devise_abonnement in ('TND', 'USD', 'EUR'));

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists statut_paiement text default 'en_attente'
  check (statut_paiement in ('paye', 'en_attente', 'en_retard'));

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists date_echeance_paiement date;

-- 34_sprint5_finance_stats.sql
alter table clients add column if not exists mode_paiement text;

-- 35_sprint5_quotas.sql
alter table clients add column if not exists quota_cibles_mensuel integer;

-- 49_inputs_strategiques.sql
alter table clients add column if not exists taux_closing_historique numeric;

-- 49_inputs_strategiques.sql
alter table clients add column if not exists mots_cles_expertise text;

-- 49_inputs_strategiques.sql
alter table clients add column if not exists idees_recues_marche text;

-- 50_inputs_strategiques_bcd_et_langue_rapport.sql
alter table clients add column if not exists motifs_rejet_passes text;

-- 50_inputs_strategiques_bcd_et_langue_rapport.sql
alter table clients add column if not exists canaux_echoues text;

-- 50_inputs_strategiques_bcd_et_langue_rapport.sql
alter table clients add column if not exists volume_equipe_commerciale text;

-- 53_analyse_cabinet.sql
alter table clients add column if not exists positionnement_site text;

-- 53_analyse_cabinet.sql
alter table clients add column if not exists ligne_editoriale_reseaux text;

-- 53_analyse_cabinet.sql
alter table clients add column if not exists derniere_analyse_cabinet_at timestamptz;

-- 55_badge_marketing.sql
alter table clients add column if not exists token_badge_public uuid not null default gen_random_uuid();

-- 56_strategie_enrichie.sql
alter table clients
  add column if not exists reseaux_actifs jsonb, 
  add column if not exists blog_actif boolean,
  add column if not exists base_email_existante text, 
  add column if not exists budget_publicitaire text, 
  add column if not exists objectif_chiffre text, 
  add column if not exists taille_min_salaries integer,
  add column if not exists taille_max_salaries integer,
  add column if not exists portee_geographique text, 
  add column if not exists villes_ciblees text;

-- 58_canal_contact_et_divers.sql
alter table clients
  add column if not exists onglets_autorises jsonb, 
  add column if not exists verticals_autorises jsonb;

-- ---- Table client_users (fiche membre equipe / profil) ----

-- 42_equipe_par_membre.sql
alter table client_users add column if not exists telephone text;

-- 42_equipe_par_membre.sql
alter table client_users add column if not exists onglets_masques jsonb not null default '[]'::jsonb;

-- 45_photo_profil_membre.sql
alter table client_users add column if not exists photo_url text;

-- 51_profil_complet.sql
alter table client_users add column if not exists pays text;

-- 51_profil_complet.sql
alter table client_users add column if not exists genre text
  check (genre in ('homme', 'femme', 'autre'));

-- 51_profil_complet.sql
alter table client_users add column if not exists date_naissance date;

-- 58_canal_contact_et_divers.sql
alter table client_users
  add column if not exists created_at timestamptz not null default now();

-- 59_email_membre_equipe.sql
alter table client_users add column if not exists email text;
