-- =====================================================================
-- Connexion a un vrai calendrier externe (Google Calendar) : le calendrier
-- interne (calendrier_entrees) restait 100% isole, aucune reservation par
-- le prospect ne verifiait la disponibilite reelle du cabinet. Ce fichier
-- ajoute le stockage des jetons OAuth Google (par cabinet) et les reglages
-- de reservation (duree du creneau, plage horaire).
-- =====================================================================

alter table clients add column if not exists google_calendar_connecte boolean not null default false;
alter table clients add column if not exists google_calendar_access_token text;
alter table clients add column if not exists google_calendar_refresh_token text;
alter table clients add column if not exists google_calendar_token_expiry timestamptz;
alter table clients add column if not exists google_calendar_email text;
alter table clients add column if not exists google_calendar_id text default 'primary';
-- Reglages de reservation en ligne (valeurs par defaut raisonnables,
-- modifiables plus tard depuis l'onglet Calendrier).
alter table clients add column if not exists reservation_duree_minutes integer not null default 30;
alter table clients add column if not exists reservation_heure_debut time not null default '09:00';
alter table clients add column if not exists reservation_heure_fin time not null default '18:00';
-- Etat OAuth temporaire (anti-CSRF) : verifie au callback avant d'associer
-- les jetons Google au bon cabinet, puis efface.
alter table clients add column if not exists google_calendar_oauth_state text;

-- L'evenement cree lors d'une reservation en ligne doit pouvoir etre
-- rattache a l'event Google Calendar correspondant (pour eventuelle
-- annulation/mise a jour future) et a la cible/diagnostic d'origine.
alter table calendrier_entrees add column if not exists google_event_id text;
alter table calendrier_entrees add column if not exists target_id uuid references targets(id) on delete set null;
alter table calendrier_entrees add column if not exists heure_debut time;
alter table calendrier_entrees add column if not exists duree_minutes integer;
