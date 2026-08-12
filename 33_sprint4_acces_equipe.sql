-- =====================================================================
-- SPRINT 4 : acces & equipe.
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- 0. BUG REEL TROUVE EN COURS DE ROUTE : la contrainte de role sur
-- client_users n'autorisait que 'proprietaire'/'membre', mais
-- app/api/team/invite/route.ts insere aussi 'directeur_commercial' -
-- chaque invitation en tant que Directeur commercial echouait donc a
-- l'insertion. On corrige la contrainte.
alter table client_users drop constraint if exists client_users_role_check;
alter table client_users add constraint client_users_role_check
  check (role in ('proprietaire', 'membre', 'directeur_commercial'));

-- 1. ACCES GRISE PAR DEFAUT : n'importe qui peut s'inscrire, mais l'acces
-- au tableau de bord reste bloque tant qu'un admin de la plateforme ne l'a
-- pas active explicitement (Partie 1 des notes d'origine).
-- IMPORTANT : les clients DEJA existants sont automatiquement actives
-- (grandfathering) pour ne pas bloquer l'usage actuel - seuls les
-- NOUVEAUX inscrits demarreront grises.
alter table clients add column if not exists acces_active boolean not null default false;
update clients set acces_active = true where acces_active = false;

-- 2. FORMULAIRE PREMIERE CONNEXION : reseaux et canaux de l'entreprise,
-- rempli une fois par le proprietaire des que son acces est active.
alter table clients add column if not exists whatsapp_directeur text;
alter table clients add column if not exists whatsapp_equipe jsonb not null default '[]'::jsonb;
alter table clients add column if not exists facebook_url text;
alter table clients add column if not exists instagram_url text;
alter table clients add column if not exists linkedin_url text;
alter table clients add column if not exists site_web text;
alter table clients add column if not exists onboarding_complete boolean not null default false;

-- On considere que les clients deja existants ont deja "fait" leur
-- onboarding (pas de formulaire retroactif impose a des comptes actifs).
update clients set onboarding_complete = true where acces_active = true;

-- 4. Cas particulier : quand c'est l'ADMIN plateforme qui cree un cabinet
-- directement (app/api/admin/clients/creer), le compte doit demarrer deja
-- actif - c'est deja une activation manuelle, pas la peine de le regriser.
-- On distingue ce cas via un flag dans les metadonnees d'inscription.
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
    insert into public.client_users (client_id, auth_user_id, nom_complet, role)
    values (
      v_client_id_invite::uuid,
      new.id,
      coalesce(new.raw_user_meta_data->>'nom_complet', ''),
      coalesce(new.raw_user_meta_data->>'role', 'membre')
    );
    return new;
  end if;

  v_vertical_slug := coalesce(new.raw_user_meta_data->>'vertical_slug', 'cabinet-formation');
  v_cree_par_admin := coalesce((new.raw_user_meta_data->>'cree_par_admin')::boolean, false);

  select id into v_vertical_id from public.verticals where slug = v_vertical_slug;

  if v_vertical_id is null then
    select id into v_vertical_id from public.verticals where slug = 'cabinet-formation';
  end if;

  insert into public.clients (vertical_id, nom_entreprise, email, statut_abonnement, acces_active, onboarding_complete)
  values (
    v_vertical_id,
    coalesce(new.raw_user_meta_data->>'nom_entreprise', 'Cabinet sans nom'),
    new.email,
    'trial',
    v_cree_par_admin,
    v_cree_par_admin
  )
  returning id into v_client_id;

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


-- 5. DROITS ADMIN DU PROPRIETAIRE : liste des onglets masques pour les
-- roles membre/directeur_commercial, configurable par le proprietaire.
alter table clients add column if not exists onglets_masques_equipe jsonb not null default '[]'::jsonb;
