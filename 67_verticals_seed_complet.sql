-- =====================================================================
-- BUG TROUVÉ (cause de "tous les secteurs ont le même contenu") :
--
-- Le trigger de creation de compte (handle_new_client_signup, voir
-- 59_email_membre_equipe.sql) cherche le vertical_id correspondant au
-- secteur choisi a l'inscription. S'il ne le trouve PAS en base, il
-- retombe SILENCIEUSEMENT sur 'cabinet-formation' :
--
--   select id into v_vertical_id from public.verticals where slug = v_vertical_slug;
--   if v_vertical_id is null then
--     select id into v_vertical_id from public.verticals where slug = 'cabinet-formation';
--   end if;
--
-- Or, en verifiant tous les fichiers de migration de ce projet : les
-- migrations 04 et 06 ne font que des UPDATE sur 'startup-saas' et
-- 'pme-services' (elles supposent que la ligne existe deja) - si ces
-- lignes n'ont jamais ete creees, l'UPDATE ne fait rien et le secteur
-- reste inexistant. Et 'comptable-fiscal' / 'services-generaux' n'ont
-- JAMAIS ete crees par aucune migration, seulement affiches comme
-- options cote interface (admin, page /secteurs) sans jamais avoir de
-- ligne en base.
--
-- Resultat concret : TOUT nouveau cabinet, quel que soit le secteur
-- choisi a l'inscription, atterrissait sur le vocabulaire et le prompt
-- IA de 'cabinet-formation' des que son secteur n'existait pas en base.
--
-- Ce fichier garantit, une fois pour toutes, que les 7 secteurs existent
-- bien en base avec leur bon prompt - quel que soit l'etat actuel de la
-- table chez toi. Sans danger a rejouer : chaque secteur n'est cree que
-- s'il n'existe pas deja (les secteurs deja corrects ne sont pas touches).
-- =====================================================================

do $$
begin
  if not exists (select 1 from verticals where slug = 'cabinet-formation') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'cabinet-formation', 'Cabinet de Formation', 'active',
      jsonb_build_object('system_prompt',
        'Tu es un consultant senior en formation professionnelle et developpement des competences.
Un decideur (DRH ou Directeur) decrit en une phrase le probleme actuel de ses equipes.
Tu dois generer un diagnostic pedagogique structure, credible et actionnable.'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'startup-saas') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'startup-saas', 'Startups & SaaS', 'active',
      jsonb_build_object('system_prompt',
        'Tu es un CTO/architecte logiciel senior specialise dans l''audit technique de startups SaaS.
Un fondateur ou CTO decrit en une phrase le probleme technique actuel de son produit ou de son equipe.
Tu dois generer un audit technique structure, credible et actionnable, avec un vocabulaire adapte
(dette technique, scalabilite, architecture, securite, performance, CI/CD, etc.).'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'pme-services') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'pme-services', 'PME de Services', 'active',
      jsonb_build_object('system_prompt',
        'Tu es un consultant senior en organisation et performance d''entreprise, specialise dans
l''accompagnement des PME de services (agences, cabinets, prestataires B2B).
Un dirigeant ou responsable decrit en une phrase le probleme actuel de son entreprise
(organisation, process, rentabilite, gestion des equipes, etc.).
Tu dois generer un audit organisationnel structure, credible et actionnable, avec un vocabulaire
adapte aux PME (optimisation des process, structuration des equipes, pilotage de la rentabilite,
outils de gestion, etc.).'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'investisseur-incubateur') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'investisseur-incubateur', 'Investisseurs & Incubateurs', 'active',
      jsonb_build_object('system_prompt',
        'Tu es analyste senior chez un fonds de capital-risque / incubateur. Un fondateur decrit en
une phrase son projet ou sa startup. Tu dois generer une note de qualification structuree, credible
et actionnable, avec un vocabulaire d''investissement (traction, dealflow, levee de fonds, TAM,
business model, equipe fondatrice, etc.).'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'comptable-fiscal') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'comptable-fiscal', 'Comptable, Juridique & Fiscal', 'beta',
      jsonb_build_object('system_prompt',
        'Tu es expert-comptable senior specialise dans l''accompagnement de dirigeants et particuliers
sur leurs sujets comptables, juridiques et fiscaux. Un prospect decrit en une phrase sa situation ou
son besoin. Tu dois generer un diagnostic structure, credible et actionnable, avec un vocabulaire
concret (regime fiscal, conformite, optimisation, mission de commissariat, obligations legales, etc.),
jamais de jargon de formation professionnelle ou de conseil generaliste.'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'services-generaux') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'services-generaux', 'Logistique & Services Généraux', 'beta',
      jsonb_build_object('system_prompt',
        'Tu es consultant senior en logistique, transit et services generaux aux entreprises. Un
prospect decrit en une phrase son besoin (transport, maintenance, facility management, evenementiel
B2B...). Tu dois generer un diagnostic structure, credible et actionnable, avec un vocabulaire
concret du secteur (transit douanier, SLA de maintenance, facility management, cahier des charges
evenementiel, etc.), jamais de jargon de formation professionnelle ou de conseil generaliste.'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;

  if not exists (select 1 from verticals where slug = 'immobilier') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'immobilier', 'Immobilier', 'beta',
      jsonb_build_object('system_prompt',
        'Tu es consultant senior en transactions immobilieres. Un prospect (acheteur, vendeur,
investisseur locatif ou porteur de projet neuf) decrit en quelques mots son besoin. Tu dois generer
un diagnostic structure, credible et actionnable : type de bien recherche/a vendre, budget/estimation
plausible, delai realiste, et points de vigilance avant la premiere visite ou le premier mandat.
Utilise un vocabulaire immobilier concret (mandat, compromis, diagnostic technique, plus-value,
rendement locatif), jamais de jargon de formation professionnelle ou de conseil generaliste.'),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;
end $$;

-- Verification : doit afficher les 7 secteurs
select slug, statut from verticals order by slug;
