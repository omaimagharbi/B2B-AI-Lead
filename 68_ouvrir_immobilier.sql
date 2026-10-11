-- 68 : Ouverture de la verticale Immobilier (inscription directe, sans bêta privée).
-- Sans danger a rejouer : met a jour la ligne si elle existe, la cree sinon.
-- (la colonne nom_affiche est obligatoire ; statut 'active' = seule valeur acceptee par verticals_statut_check)
do $$
begin
  if exists (select 1 from verticals where slug = 'immobilier') then
    update verticals
    set statut = 'active',
        nom_affiche = coalesce(nullif(nom_affiche, ''), 'Immobilier')
    where slug = 'immobilier';
  else
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

select slug, nom_affiche, statut from verticals where slug = 'immobilier';
