-- =====================================================================
-- Enrichit les inputs et les outputs de l'onglet Stratégie, suite aux
-- retours "verifier les inputs / verifier output" :
-- - Nouveaux inputs strategiques manuels : reseaux sociaux actifs, blog,
--   base email existante, budget publicitaire, objectifs chiffres.
-- - Tranches chiffrees de taille d'entreprise (20-100 / +500) et portee
--   geographique (local/national/international) + villes ciblees, sur
--   le meme principe que taille_entreprise (deja existant sur clients).
-- - strategies_generees stocke maintenant la sortie enrichie complete
--   (filtres recommandes, scripts de vente, guide de qualification,
--   ligne editoriale, lead magnets), plus les inputs de profil au moment
--   de la generation.
-- =====================================================================

alter table clients
  add column if not exists reseaux_actifs jsonb, -- {"linkedin": true, "facebook": false, "instagram": true}
  add column if not exists blog_actif boolean,
  add column if not exists base_email_existante text, -- ex: "Oui, ~500 contacts" ou vide
  add column if not exists budget_publicitaire text, -- 'organique' | 'payant' | 'mixte'
  add column if not exists objectif_chiffre text, -- ex: "5 conventions/mois" ou "50k TND ce trimestre"
  add column if not exists taille_min_salaries integer,
  add column if not exists taille_max_salaries integer,
  add column if not exists portee_geographique text, -- 'local' | 'national' | 'international'
  add column if not exists villes_ciblees text; -- ex: "Tunis, Sfax, Sousse" (pertinent si portee = local)

alter table strategies_generees
  add column if not exists filtres_recommandes jsonb, -- {postes:[], secteur:'', taille:''}
  add column if not exists script_appel text,
  add column if not exists script_linkedin text,
  add column if not exists guide_qualification jsonb, -- string[]
  add column if not exists ligne_editoriale text,
  add column if not exists lead_magnets jsonb, -- string[]
  add column if not exists profil_utilise_json jsonb; -- snapshot du profil Ciblage utilise pour cette generation
