-- =====================================================================
-- La fiche membre d'equipe (dashboard > Equipe) n'affichait que le nom et
-- le telephone : impossible de voir/verifier l'email de connexion d'un
-- membre sans aller chercher dans Supabase Auth. On duplique l'email sur
-- client_users (source de verite reste auth.users, mais cette colonne
-- evite un aller-retour a chaque affichage de la liste equipe).
-- =====================================================================

alter table client_users add column if not exists email text;

-- Backfill des comptes existants a partir de auth.users
update public.client_users cu
set email = au.email
from auth.users au
where cu.auth_user_id = au.id
  and cu.email is null;

-- Le trigger de creation de compte doit desormais aussi renseigner l'email
create or replace function public.handle_new_client_signup()
returns trigger as $$
declare
  v_vertical_id uuid;
  v_vertical_slug text;
  v_client_id uuid;
  v_client_id_invite text;
  v_cree_par_admin boolean;
begin
  v_client_id_invite := new.raw_user_meta_data->>'client_id';

  if v_client_id_invite is not null then
    insert into public.client_users (client_id, auth_user_id, nom_complet, role, email)
    values (
      v_client_id_invite::uuid,
      new.id,
      coalesce(new.raw_user_meta_data->>'nom_complet', ''),
      coalesce(new.raw_user_meta_data->>'role', 'membre'),
      new.email
    );
    return new;
  end if;

  v_vertical_slug := coalesce(new.raw_user_meta_data->>'vertical_slug', 'cabinet-formation');
  v_cree_par_admin := coalesce((new.raw_user_meta_data->>'cree_par_admin')::boolean, false);

  select id into v_vertical_id from public.verticals where slug = v_vertical_slug;

  if v_vertical_id is null then
    select id into v_vertical_id from public.verticals where slug = 'cabinet-formation';
  end if;

  insert into public.clients (vertical_id, nom_entreprise, email, statut_abonnement, acces_active, onboarding_complete, secteur_activite)
  values (
    v_vertical_id,
    coalesce(new.raw_user_meta_data->>'nom_entreprise', 'Cabinet sans nom'),
    new.email,
    'trial',
    v_cree_par_admin,
    v_cree_par_admin,
    new.raw_user_meta_data->>'sous_secteur'
  )
  returning id into v_client_id;

  insert into public.client_users (client_id, auth_user_id, nom_complet, role, email)
  values (
    v_client_id,
    new.id,
    coalesce(new.raw_user_meta_data->>'nom_complet', ''),
    'proprietaire',
    new.email
  );

  return new;
end;
$$ language plpgsql security definer;
