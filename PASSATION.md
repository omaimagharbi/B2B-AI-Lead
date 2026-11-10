# Passation V16 -> V20 (lots 4, 5, 6, corrections, 7, 8)
- Migrations 77 a 82 : tout dans 00_MIGRATIONS_70_a_82_combinees.sql. Sans elles, l'app marche comme avant.
- Aucune nouvelle route (tout dans app/api/immo/route.ts). Cron : celui qui existe. Nouvelle dependance : leaflet (npm install).
- Variables : META_WA_ACCESS_TOKEN, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN, META_PAGE_ACCESS_TOKEN, META_GRAPH_VERSION (opt.), META_WA_API_VERSION (opt.), NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (opt.), IMMO_HOT_ALERT_PERIOD_HOURS (72), IMMO_HOT_ALERT_STALE_HOURS (12), IMMO_TZ_OFFSET_HOURS (3). IA : GEMINI_API_KEY / ANTHROPIC_API_KEY deja prevues.
- L'agent IA qui repond seul est DESACTIVE par defaut (menu AI Real Estate Agent).
- Tests : npx tsx scripts/test-lot4-5.ts (26 groupes OK) ; npm run build OK. Rien teste en ligne.
- Textes juridiques EN/FR/AR = brouillons a faire valider par un juriste, puis POLICY_DRAFT=false (lib/immo-os/policy.ts).
- Non fait : O38 (traduction complete des ~340 textes d'origine), paiement en ligne, n°76 (portails, volontairement).
