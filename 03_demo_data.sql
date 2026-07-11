-- =====================================================
-- DONNEES DE DEMO/TEST - a executer apres etapes 1 et 2
-- Permet de tester le tunnel /diagnostic/demo-token sans
-- attendre que l'outreach automatique (etape 13) soit fait
-- =====================================================

do $$
declare
  v_vertical_id uuid;
  v_client_id uuid;
  v_target_id uuid;
begin
  select id into v_vertical_id from verticals where slug = 'cabinet-formation';

  insert into clients (vertical_id, nom_entreprise, email, zone_geographique, statut_abonnement)
  values (v_vertical_id, 'Cabinet Demo (test)', 'demo@cabinet-test.tn', 'tunisie', 'trial')
  returning id into v_client_id;

  insert into targets (client_id, nom, entreprise, poste, statut)
  values (v_client_id, 'Prospect Demo', 'Entreprise Demo', 'DRH', 'nouveau')
  returning id into v_target_id;

  insert into diagnostics (target_id, client_id, vertical_id, token_acces, statut)
  values (v_target_id, v_client_id, v_vertical_id, 'demo-token', 'en_attente');

  raise notice 'Client de demo cree avec id: %', v_client_id;
end $$;

-- Verification
select token_acces from diagnostics where token_acces = 'demo-token';
