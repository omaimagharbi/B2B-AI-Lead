-- =====================================================================
-- CLARIFICATION DES COMPTES : le role "admin" dans client_users
-- (proprietaire d'un cabinet) portait le meme nom que le super-admin
-- de la plateforme (toi/Braise sur /admin). On renomme pour eviter
-- toute confusion entre les deux.
-- A executer dans Supabase > SQL Editor
-- =====================================================================

-- 0. La contrainte existante limite les valeurs possibles de "role" (ex: 'admin','membre').
--    On l'elargit pour accepter 'proprietaire' avant de renommer les lignes existantes.
alter table client_users drop constraint if exists client_users_role_check;
alter table client_users add constraint client_users_role_check
  check (role in ('proprietaire', 'membre'));

-- 1. On renomme les lignes existantes
update client_users set role = 'proprietaire' where role = 'admin';

-- 2. On corrige la fonction de creation de compte pour les futurs inscrits
create or replace function public.handle_new_client_signup()
returns trigger as $$
declare
  v_vertical_id uuid;
  v_vertical_slug text;
  v_client_id uuid;
begin
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
