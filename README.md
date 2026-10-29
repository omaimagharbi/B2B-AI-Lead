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

Espace immobilier (Qatar) : Dashboard, Properties, Leads (kanban), Clients, Owners, WhatsApp, AI Assistant, Marketing, Deals, Reports, Team, Settings.

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
1. Supabase > SQL Editor : coller et executer **UNE SEULE FOIS** `00_MIGRATIONS_70_a_72_combinees.sql` (equivaut a 70 + 71 + 72, dans le bon ordre, idempotent). Ne pas lancer 71 ou 72 seuls avant le 70 (erreur `relation "re_messages" does not exist`).
2. GitHub : remplacer les fichiers du depot par le contenu de ce zip (les fichiers sont a la racine, pas dans un sous-dossier), commit + push. Vercel redeploie tout seul.
3. Vercel > Environment Variables : ajouter `WHATSAPP_IMMO_CLIENT_ID` (id affiche dans /immo/settings) ; optionnels : `IMMO_DEFAULT_COUNTRY_CODE` (974), `IMMO_AI_MONTHLY_LIMIT` (300), `CRON_SECRET` (deja utilise par les autres crons).
4. Ouvrir `/immo` (ou le bouton dore "PiloBrain Real Estate" en haut du dashboard).
Si le build Vercel echoue : copier les lignes rouges en bas du log. Si Vercel refuse le nombre de crons, supprimer le bloc `/api/immo/cron-rappels` dans vercel.json.

## Limite Vercel Hobby (12 fonctions)
Tout le Real Estate OS cote serveur est servi par UNE SEULE fonction : `app/api/immo/route.ts` (appel `/api/immo?r=<nom>`; le code des endpoints est dans `lib/immo-os/api/`). Le formulaire public `/lead?a=<ID>` est une page statique. Les rappels de leads (48 h) tournent dans le cron existant `/api/cron/relances` : aucun cron ni fonction en plus.
Aucun nom de dossier special (crochets) : tout s'uploade normalement.

## STRUCTURE ATTENDUE DU DEPOT (a la racine)
`app/` (avec dedans : admin, api, auth, dashboard, immo, lead, ... + layout.tsx, page.tsx, globals.css), `components/`, `lib/`, `public/`, `package.json`, `next.config.js`, `tsconfig.json`, `vercel.json`...
Erreur Vercel "Couldn't find any `pages` or `app` directory" = le dossier `app` n'est pas a la racine du depot.
