-- =====================================================
-- CORRECTIF : le trigger d'inscription doit utiliser le vertical
-- choisi par l'utilisateur (Carte 1 ou Carte 2), pas toujours "cabinet-formation"
-- A executer dans Supabase > SQL Editor
-- =====================================================

create or replace function public.handle_new_client_signup()
returns trigger as $$
declare
  v_vertical_id uuid;
  v_vertical_slug text;
  v_client_id uuid;
begin
  -- On recupere le slug du vertical envoye depuis le formulaire d'inscription
  -- (si absent, on retombe sur "cabinet-formation" par securite)
  v_vertical_slug := coalesce(new.raw_user_meta_data->>'vertical_slug', 'cabinet-formation');

  select id into v_vertical_id from public.verticals where slug = v_vertical_slug;

  -- Securite supplementaire si jamais le slug envoye est invalide
  if v_vertical_id is null then
    select id into v_vertical_id from public.verticals where slug = 'cabinet-formation';
  end if;

  insert into public.clients (vertical_id, nom_entreprise, email, statut_abonnement)
  values (
    v_vertical_id,
    coalesce(new.raw_user_meta_data->>'nom_entreprise', 'Cabinet sans nom'),
    new.email,
    'trial'
  )
  returning id into v_client_id;

  insert into public.client_users (client_id, auth_user_id, nom_complet, role)
  values (
    v_client_id,
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', ''),
    'admin'
  );

  return new;
end;
$$ language plpgsql security definer;

-- Le trigger existant continue de pointer vers cette fonction, pas besoin de le recreer
