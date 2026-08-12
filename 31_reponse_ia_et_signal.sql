-- =====================================================================
-- Sprint 1 : detection automatique de reponse positive (declencheur du
-- 2e message / diagnostic complet) + signal IA affiche sous le prospect.
-- A executer dans Supabase > SQL Editor.
-- =====================================================================

-- Sentiment detecte par l'IA sur le dernier message recu du prospect.
-- 'positive'  -> le commercial doit envoyer le diagnostic complet (2e message)
-- 'negative'  -> le prospect n'est pas interesse, on n'insiste pas
-- 'neutre'    -> reponse recue mais pas assez claire pour trancher
alter table targets add column if not exists reponse_sentiment text
  check (reponse_sentiment in ('positive', 'negative', 'neutre'));

alter table targets add column if not exists reponse_detectee_at timestamptz;

-- true tant que le commercial n'a pas traite la reponse positive detectee
-- (sert a afficher un badge "a traiter" et a piloter la notification).
alter table targets add column if not exists reponse_a_traiter boolean not null default false;

-- Phrase courte generee par l'IA a partir des infos disponibles sur la cible
-- (poste, entreprise, segment/urgence), affichee sous le nom du prospect.
-- Ex : "Recherche active detectee : DRH en phase de recrutement."
alter table targets add column if not exists signal_ia text;

-- On relie explicitement chaque message recu au sentiment detecte dessus,
-- pour garder un historique meme si le champ sur `targets` est ensuite ecrase
-- par un message plus recent.
alter table messages_recus add column if not exists sentiment_detecte text
  check (sentiment_detecte in ('positive', 'negative', 'neutre'));

create index if not exists idx_targets_reponse_a_traiter
  on targets(client_id, reponse_a_traiter) where reponse_a_traiter = true;
