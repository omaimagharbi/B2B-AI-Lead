-- =====================================================
-- DONNEES DE DEMO V2 - compatible avec la refonte architecture
-- A executer APRES 07_refonte_architecture.sql
-- =====================================================

do $$
declare
  v_vertical_id uuid;
  v_client_id uuid;
  v_target_id uuid;
begin
  select id into v_vertical_id from verticals where slug = 'cabinet-formation';

  insert into clients (vertical_id, nom_entreprise, email, statut_abonnement, mode_ciblage)
  values (v_vertical_id, 'Cabinet Demo (test)', 'demo@cabinet-test.tn', 'trial', 'entreprise')
  returning id into v_client_id;

  insert into client_countries (client_id, country_code) values (v_client_id, 'TN');

  insert into targets (client_id, nom, entreprise_ou_objectif, poste_ou_budget, country, statut)
  values (v_client_id, 'Prospect Demo', 'Entreprise Demo', 'DRH', 'TN', 'nouveau')
  returning id into v_target_id;

  insert into diagnostics (target_id, client_id, vertical_id, token_acces, statut_validation)
  values (v_target_id, v_client_id, v_vertical_id, 'demo-token', 'brouillon_ia');

  raise notice 'Client de demo cree avec id: %', v_client_id;
end $$;

-- Verification
select token_acces, statut_validation from diagnostics where token_acces = 'demo-token';
