-- =====================================================================
-- CORRECTIF : la migration 18_clarification_comptes.sql a recree la
-- fonction handle_new_client_signup() en repartant de la version SANS
-- le "cas 1" (invitation d'un collegue sur un cabinet EXISTANT), qui
-- avait ete ajoute par la migration 13. Consequence concrete : depuis
-- la migration 18, chaque personne invitee via /api/team/invite se
-- retrouvait avec un NOUVEAU cabinet vide au lieu d'etre rattachee au
-- cabinet de celui qui l'a invitee.
-- Ce script recree la fonction en gardant le renommage de role fait en
-- 18 ("proprietaire" / "membre") ET le cas d'invitation retire par erreur.
-- A executer dans Supabase > SQL Editor
-- =====================================================================

create or replace function public.handle_new_client_signup()
returns trigger as $$
declare
  v_vertical_id uuid;
  v_vertical_slug text;
  v_client_id uuid;
  v_client_id_invite text;
begin
  -- Cas 1 : invitation d'un collegue sur un cabinet EXISTANT (client_id deja
  -- present dans les metadonnees, transmis par /api/team/invite)
  v_client_id_invite := new.raw_user_meta_data->>'client_id';

  if v_client_id_invite is not null then
    insert into public.client_users (client_id, auth_user_id, nom_complet, role)
    values (
      v_client_id_invite::uuid,
      new.id,
      coalesce(new.raw_user_meta_data->>'nom_complet', ''),
      coalesce(new.raw_user_meta_data->>'role', 'membre')
    );
    return new;
  end if;

  -- Cas 2 : creation d'un nouveau cabinet (inscription normale)
  v_vertical_slug := coalesce(new.raw_user_meta_data->>'vertical_slug', 'cabinet-formation');

  select id into v_vertical_id from public.verticals where slug = v_vertical_slug;

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

  -- "proprietaire" = le compte qui a cree le cabinet (pas le super-admin de la plateforme)
  insert into public.client_users (client_id, auth_user_id, nom_complet, role)
  values (
    v_client_id,
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', ''),
    'proprietaire'
  );

  return new;
end;
$$ language plpgsql security definer;
