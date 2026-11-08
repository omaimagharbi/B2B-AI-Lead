# B2B AI Lead Machine

## Démarrage local

1. Installer les dépendances :
```
npm install
```

2. Copier `.env.local.example` en `.env.local` et remplir avec tes vraies clés (Supabase + Anthropic)

3. Lancer le serveur de dev :
```
npm run dev
```

4. Ouvrir : http://localhost:3000/diagnostic/test

## Déploiement

1. Push ce projet sur un repo GitHub
2. Sur Vercel : "Add New Project" → importer ce repo GitHub
3. Dans Vercel → Settings → Environment Variables : ajouter les 3 variables du `.env.local`
4. Deploy

## PiloBrain Real Estate (/immo)

Espace immobilier (Qatar) : 13 menus - Dashboard, Properties, Leads (kanban), Calendar, Clients, Owners, WhatsApp, AI Assistant, Marketing, Deals, Reports, Team, Settings.

1. Executer `70_immobilier_os.sql` dans le SQL editor de Supabase (idempotent).
2. Ouvrir `/immo` (connecte). Sans la migration, l'espace tourne en **mode demo** (donnees locales au navigateur).
3. Espace vide en mode reel -> bouton "Load sample data" sur le dashboard.
4. IA : `GEMINI_API_KEY` puis `ANTHROPIC_API_KEY` ; envoi WhatsApp : `GREENAPI_*` (deja utilises par le reste de la plateforme).

### Reception WhatsApp (Real Estate OS)
1. Executer `71_immobilier_os_inbound.sql` (anti-doublons).
2. Le webhook GreenAPI existant (`/api/webhook/whatsapp?secret=...`) traite maintenant aussi l'immobilier : les contacts connus (leads, clients, proprietaires) sont retrouves par numero ; un numero inconnu cree un lead pour l'agence `WHATSAPP_IMMO_CLIENT_ID` (id visible dans /immo/settings).
3. Les cibles de prospection existantes gardent leur comportement habituel (traitees en premier).

### Formulaire public de capture de leads
- Lien : `https://TON-SITE/lead?a=<ID_AGENCE>` (visible dans /immo/settings, avec le code iframe). `&property=<id>` affiche le bien, `&lang=ar|fr` change la langue.
- Chaque demande cree un lead (source "website") + un message dans l'inbox ; un meme numero ne cree pas de doublon. Le directeur recoit une alerte WhatsApp (champ `whatsapp_directeur`).
- Anti-spam : champ piege + 5 envois / 10 min / IP (fonction SQL `verifier_rate_limit` deja presente).

## MISE EN LIGNE - ordre a respecter (PiloBrain Real Estate)
1. Supabase > SQL Editor : coller et executer **UNE SEULE FOIS** `00_MIGRATIONS_70_a_80_combinees.sql` (equivaut a 70 a 80, dans le bon ordre, idempotent). Si 70 a 76 sont deja faits : lancer seulement 77, 78, 79 puis 80 (`80_immobilier_os_lot6b_medias.sql`, `77_immobilier_os_lot4_suivi_client.sql`, `78_immobilier_os_lot5_conformite.sql`, `79_immobilier_os_lot6a_meta.sql`). Ne pas lancer 71 ou 72 seuls avant le 70 (erreur `relation "re_messages" does not exist`).
2. GitHub : remplacer les fichiers du depot par le contenu de ce zip (les fichiers sont a la racine, pas dans un sous-dossier), commit + push. Vercel redeploie tout seul.
3. Vercel > Environment Variables : ajouter `WHATSAPP_IMMO_CLIENT_ID` (id affiche dans /immo/settings) ; optionnels : `IMMO_DEFAULT_COUNTRY_CODE` (974), `IMMO_AI_MONTHLY_LIMIT` (300), `CRON_SECRET` (deja utilise par les autres crons), `IMMO_CLAUDE_MODEL` (nom du modele Claude de l'assistant, defaut `claude-sonnet-5-5`).
4. Ouvrir `/immo` (ou le bouton dore "PiloBrain Real Estate" en haut du dashboard).
Si le build Vercel echoue : copier les lignes rouges en bas du log. Si Vercel refuse le nombre de crons, supprimer le bloc `/api/immo/cron-rappels` dans vercel.json.

### Migration 74 : photos, propriete, proprietaires, zones
- Biens : plusieurs photos (12 max, la 1re = couverture `image_url`), regime `freehold` / `usufruct` (+ duree) avec filtre, numero d'unite, 14 types.
- Proprietaires : responsable + dernier contact (mis a jour automatiquement a chaque WhatsApp envoye/recu).
- Zones configurables (Settings > Zones & projets, gestionnaires seulement) : municipalite > zone > projet > unite (= le bien). Bouton de chargement des 8 municipalites du Qatar.
- Sans la migration 74, l'espace marche toujours : les nouveaux champs ne sont simplement pas enregistres (un message l'indique).
- Mode demo : cle locale `imo_demo_v2` (les anciennes donnees de demo v1 sont ignorees ; bouton Reset dans Settings).

### Lot 2 : migrations 75 et 76
- 75 : chambres souhaitees (leads + clients), commission sur le bien. Types de biens : 17 au total (hotel, industriel, usage mixte ajoutes).
- 76 : `re_activity` (journal), `re_assignments` (historique des affectations), `re_hierarchy` (chef d'equipe / rattachement).
- Journal : ecrit par le serveur dans `lib/immo-os/api/entity.ts` (creation / modification / suppression de toute fiche), `api/reassign.ts` et les routes `/api/team/*` ; aucune page n'ecrit dans le journal. Seuls les NOMS des champs modifies sont enregistres (pas les valeurs). Purge au fil de l'eau (>180 jours), pas de cron.
- Appels : `?r=activity` (journal, gestionnaires), `?r=assignments&lead_id=`, `POST ?r=leads/reassign` (reassignation en masse). Aucune nouvelle fonction Vercel (56 routes avant et apres).
- Alerte leads orphelins (sans agent ou agent retire) : bandeau Leads/Equipe + message WhatsApp quotidien au directeur dans le cron existant `cron-rappels` (GreenAPI + `whatsapp_directeur`, deja configures) + alerte immediate au retrait d'un membre.
- Droits : le retrait/invitation passent par `/api/team/invite|remove|modifier` existants. Les menus masques sont stockes dans `onglets_masques` sous la forme `immo:<menu>` (masquage d'interface ; l'acces aux donnees reste filtre cote serveur).

### Lot 3 : tableau de bord manager, indicateurs, Market Intelligence, calendrier (aucune migration)
- `lib/immo-os/metrics.ts` (calcul pur, teste) : conversations, visites, vitesse de reponse (mediane + part <= 1 h), taux de suivi (lead actif contacte < 48 h), relances du jour (RDV de type relance/appel), offres, conversion chat -> visite, leads a risque, points de la semaine (5 pts vente, 2 pts visite, 1 pt conversation).
- `app/immo/manager-panel.tsx` : bloc en haut du Dashboard. Le manager voit tous les agents ; l'agent ne voit que ses chiffres (ses donnees sont deja filtrees par le serveur).
- Leads a risque : sans agent actif, sans contact 5+ jours, visite/negociation sans contact 3+ jours, « nouveau » depuis 3+ jours (seuils dans `metrics.ts`).
- `app/immo/market` (menu Market Intelligence) : prix moyen/m2 par zone, demande par zone (manager), tendance, budgets vs prix, analyse IA. Donnees internes seulement.
- Calendrier : 3 vues (mois, semaine, liste), 6 types colores + Autre, textes EN/FR/AR.
- Alerte IA leads orphelins : bouton « Plan de redistribution par IA » (Equipe et Leads), repartition equilibree applicable en un clic.

### Lot 4 : fiche client, suivi du deal, alerte lead chaud (migration 77)
- n°98 fiche client `/immo/client?id=<id client ou lead>` (historique, conversation, qui l'a traite, etapes) ; n°99 resultat du contact par conversation (table `re_outcomes`) ; n°105 bien detecte dans le message (`lib/immo-os/property-detect.ts`, colonnes `re_messages.property_id/property_auto`) ; n°89 vue croisee bien + conversation + proprietaire dans l'ecran WhatsApp (le proprietaire n'est montre qu'aux gestionnaires) ; n°4 biens envoyes (`re_sends`, ecrit par `api/whatsapp.ts`).
- n°48 / n°86 etapes du deal : `re_stages` (historique), actions automatiques par etape (tache calendrier, bien reserve / vendu / loue, lead gagne) dans `lib/immo-os/api/deal-steps.ts`, appele par `api/entity.ts` ; memes regles en mode demo (`lib/immo-os/demo-flow.ts`).
- n°41 / n°81 alerte lead chaud (score >= 75) : `lib/immo-os/api/hot-alerts.ts`, une alerte par lead et par periode (`re_hot_alerts`, contrainte unique), declenchee quand le lead devient chaud + balayage dans le cron existant (`cron-rappels`). Variables optionnelles : `IMMO_HOT_ALERT_PERIOD_HOURS` (72), `IMMO_HOT_ALERT_STALE_HOURS` (12), `IMMO_TZ_OFFSET_HOURS` (3, heure des taches automatiques).

### Lot 5 : conformite et garde-fous WhatsApp (migration 78)
- n°55 / n°83 consentement + STOP + "ne plus contacter" (colonnes sur leads / clients / proprietaires, lien `/desinscription/<jeton>` = meme page que le B2B, liste de mots partagee `lib/optout-words.ts`). Un contact bloque ne recoit plus rien depuis l'application (refus cote serveur).
- n°101 charte d'utilisation acceptee par chaque membre (`re_charter_acceptances`, ecran bloquant) ; n°102 / n°103 regles documentees dans Reglages, reglage "numero inconnu" par agence (`re_settings`, `lib/immo-os/inbound.ts`), groupes / statuts / chaines ignores.
- Textes juridiques (notice client `/lead/privacy`, charte, messages STOP) en EN / FR / AR : BROUILLONS a faire valider par un juriste (`lib/immo-os/policy.ts`, `POLICY_DRAFT`).
- Tests des fonctions pures : `npx tsx scripts/test-lot4-5.ts`.

### Lot 6a : WhatsApp Business officiel (Meta) (migration 79)
- Webhook `/api/immo?r=meta` (GET = verification Meta, POST = messages et statuts, signature `X-Hub-Signature-256` obligatoire) ; reglages `/api/immo?r=wa` ; aucune nouvelle fonction Vercel. Code : `lib/immo-os/wa-meta.ts` (pur + appels Graph API), `api/meta.ts`, `api/wa.ts`, envoi dans `api/whatsapp.ts`.
- Un ou plusieurs numeros Meta PAR AGENCE (`re_wa_numbers`, saisis dans Reglages > WhatsApp Business) ; une agence sans numero Meta continue d'utiliser GreenAPI, qui sert aussi de repli si Meta est en panne ou si le jeton a expire (jamais pour contourner la fenetre de 24 h).
- Fenetre de 24 h : apres 24 h sans message du client, seul un modele approuve (`re_wa_templates`, synchronise depuis Meta) peut partir ; l'ecran WhatsApp l'affiche et propose les modeles, le serveur refuse sinon (409).
- Statuts de livraison (envoye / delivre / lu / echec) sur chaque message sortant Meta.
- Variables : `META_WA_ACCESS_TOKEN`, `META_WA_APP_SECRET`, `META_WA_VERIFY_TOKEN` (+ optionnelle `META_WA_API_VERSION`, defaut v21.0).

### Lot 6b : fichiers, fiche IA avec photos, proprietaires (migration 80)
- n°35 : photos / PDF envoyes depuis l'ecran WhatsApp (trombone), verifies par leurs premiers octets, 4 Mo max, stockes dans le bucket `immo-chat` (dossier = agence) ; en reception, photos / PDF / vocaux / videos arrivent par le webhook Meta et sont ranges dans le meme bucket. Le serveur n'accepte que des URL du stockage de l'agence. GreenAPI : envoi de fichiers par lien, pas de reception de medias.
- n°38 / n°91 : dans « Envoyer un bien », bouton « Rediger avec l'IA » + photos cochees (5 max) ; la legende de la 1re image porte le texte (1000 caracteres max, sinon texte puis images).
- n°100 : bouton conversation sur la fiche proprietaire ; un agent ne peut ni voir ni ecrire aux proprietaires (403 cote serveur).

## Limite Vercel Hobby (12 fonctions)
Tout le Real Estate OS cote serveur est servi par UNE SEULE fonction : `app/api/immo/route.ts` (appel `/api/immo?r=<nom>`; le code des endpoints est dans `lib/immo-os/api/`). Le formulaire public `/lead?a=<ID>` est une page statique. Les rappels de leads (48 h) tournent dans le cron existant `/api/cron/relances` : aucun cron ni fonction en plus.
Aucun nom de dossier special (crochets) : tout s'uploade normalement.

## STRUCTURE ATTENDUE DU DEPOT (a la racine)
`app/` (avec dedans : admin, api, auth, dashboard, immo, lead, ... + layout.tsx, page.tsx, globals.css), `components/`, `lib/`, `public/`, `package.json`, `next.config.js`, `tsconfig.json`, `vercel.json`...
Erreur Vercel "Couldn't find any `pages` or `app` directory" = le dossier `app` n'est pas a la racine du depot.
