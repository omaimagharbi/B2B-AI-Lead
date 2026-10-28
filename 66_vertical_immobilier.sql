-- =====================================================================
-- Nouvelle verticale : Immobilier (agences, promoteurs, agents
-- independants, syndics).
-- NB : la contrainte verticals_statut_check en base n'autorise que
-- 'active' (pas de valeur 'beta' reconnue) - on insere donc en 'active'
-- comme investisseur-incubateur. L'affichage "Bientot" sur les pages
-- publiques reste gere cote front (PROFILS avec active: false dans
-- app/page.tsx), independamment de cette colonne.
-- =====================================================================

do $$
begin
  if not exists (select 1 from verticals where slug = 'immobilier') then
    insert into verticals (slug, nom_affiche, statut, prompt_ia_config, canaux_actifs)
    values (
      'immobilier',
      'Immobilier',
      'active',
      jsonb_build_object(
        'system_prompt',
        'Tu es consultant senior en transactions immobilieres. Un prospect (acheteur, vendeur,
investisseur locatif ou porteur de projet neuf) decrit en quelques mots son besoin. Tu dois generer
un diagnostic structure, credible et actionnable : type de bien recherche/a vendre, budget/estimation
plausible, delai realiste, et points de vigilance avant la premiere visite ou le premier mandat.
Utilise un vocabulaire immobilier concret (mandat, compromis, diagnostic technique, plus-value,
rendement locatif), jamais de jargon de formation professionnelle ou de conseil generaliste.'
      ),
      '{"whatsapp": true, "email": true, "linkedin": true, "facebook": true}'::jsonb
    );
  end if;
end $$;
