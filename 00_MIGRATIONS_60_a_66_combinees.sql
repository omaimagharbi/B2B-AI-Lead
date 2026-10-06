-- =====================================================================
-- FICHIER COMBINÉ — migrations 60 à 66, à exécuter en une seule fois
-- dans Supabase > SQL Editor, à la place de jouer les 7 fichiers un par un.
--
-- Sûr à rejouer plusieurs fois : toutes les instructions sont protégées
-- (ADD COLUMN IF NOT EXISTS, vérification d'existence avant INSERT, DROP
-- POLICY IF EXISTS avant CREATE POLICY). Aucune perte de données, aucun
-- doublon possible.
-- =====================================================================


-- ============ 60 : Connexion Google Calendar ============
alter table clients add column if not exists google_calendar_connecte boolean not null default false;
alter table clients add column if not exists google_calendar_access_token text;
alter table clients add column if not exists google_calendar_refresh_token text;
alter table clients add column if not exists google_calendar_token_expiry timestamptz;
alter table clients add column if not exists google_calendar_email text;
alter table clients add column if not exists google_calendar_id text default 'primary';
alter table clients add column if not exists reservation_duree_minutes integer not null default 30;
alter table clients add column if not exists reservation_heure_debut time not null default '09:00';
alter table clients add column if not exists reservation_heure_fin time not null default '18:00';
alter table clients add column if not exists google_calendar_oauth_state text;

alter table calendrier_entrees add column if not exists google_event_id text;
alter table calendrier_entrees add column if not exists target_id uuid references targets(id) on delete set null;
alter table calendrier_entrees add column if not exists heure_debut time;
alter table calendrier_entrees add column if not exists duree_minutes integer;


-- ============ 61 : Contexte brut pour le signal IA ============
alter table targets add column if not exists contexte_brut_scraping text;


-- ============ 62 : Fuseau horaire par cabinet ============
alter table clients add column if not exists fuseau_horaire text not null default 'Africa/Tunis';


-- ============ 63 : Autorisations manquantes sur les cibles (IMPORTANT) ============
-- Bug de securite trouve : la table targets n'avait de politique RLS que
-- pour SELECT et INSERT - sans UPDATE/DELETE, assigner une cible, changer
-- son statut/etape pipeline, ou la supprimer pouvait echouer silencieusement.
drop policy if exists "targets_update_own" on targets;
create policy "targets_update_own" on targets
  for update using (client_id = public.get_my_client_id());

drop policy if exists "targets_delete_own" on targets;
create policy "targets_delete_own" on targets
  for delete using (client_id = public.get_my_client_id());


-- ============ 64 : Secteur (vertical) par cible ============
alter table targets add column if not exists vertical_id uuid references verticals(id);

update targets t
set vertical_id = c.vertical_id
from clients c
where t.client_id = c.id
  and t.vertical_id is null;


-- ============ 65 : Canal Facebook (copier-coller, comme LinkedIn) ============
alter table outreach_campaigns drop constraint if exists outreach_campaigns_canal_check;
alter table outreach_campaigns add constraint outreach_campaigns_canal_check
  check (canal in ('whatsapp', 'email', 'linkedin', 'facebook'));


-- ============ 66 : Nouvelle verticale Immobilier (statut 'active' - 'beta' refuse par la contrainte verticals_statut_check) ============
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
