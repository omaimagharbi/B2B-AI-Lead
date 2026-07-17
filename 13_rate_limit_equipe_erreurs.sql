-- =====================================================
-- AJOUT : rate-limiting, monitoring d'erreurs, gestion d'equipe
-- A executer dans Supabase > SQL Editor
-- =====================================================

-- =====================================================
-- 1. RATE LIMITING anti-abus sur /api/diagnostic
-- =====================================================
create table if not exists diagnostic_rate_limits (
  identifiant text primary key,
  compte int not null default 1,
  fenetre_debut timestamptz not null default now()
);

create or replace function verifier_rate_limit(
  p_identifiant text,
  p_max int,
  p_fenetre_minutes int
) returns boolean as $$
declare
  v_row record;
begin
  select * into v_row from diagnostic_rate_limits where identifiant = p_identifiant for update;

  if not found then
    insert into diagnostic_rate_limits (identifiant, compte, fenetre_debut)
    values (p_identifiant, 1, now());
    return true;
  end if;

  if now() - v_row.fenetre_debut > (p_fenetre_minutes || ' minutes')::interval then
    update diagnostic_rate_limits set compte = 1, fenetre_debut = now()
    where identifiant = p_identifiant;
    return true;
  end if;

  if v_row.compte >= p_max then
    return false;
  end if;

  update diagnostic_rate_limits set compte = compte + 1 where identifiant = p_identifiant;
  return true;
end;
$$ language plpgsql;

-- =====================================================
-- 2. MONITORING D'ERREURS (journal simple, sans service externe)
-- =====================================================
create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  message text,
  stack text,
  created_at timestamptz default now()
);

-- =====================================================
-- 3. GESTION D'EQUIPE : le trigger d'inscription doit distinguer
-- "nouveau cabinet" (creation d'un client) et "invitation d'un collegue"
-- (rattachement a un client_id existant, sans creer de doublon)
-- =====================================================
create or replace function public.handle_new_client_signup()
returns trigger as $$
declare
  v_vertical_id uuid;
  v_vertical_slug text;
  v_client_id uuid;
  v_client_id_invite text;
begin
  -- Cas 1 : invitation d'un collegue sur un cabinet EXISTANT
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

  -- Cas 2 : creation d'un nouveau cabinet (comportement d'origine, inchange)
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
