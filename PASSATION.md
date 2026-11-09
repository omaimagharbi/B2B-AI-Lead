# Passation V16 -> V19 (lots 4, 5, 6a, 6b, corrections, lot 7)
- Migrations 77 a 81 : tout dans 00_MIGRATIONS_70_a_81_combinees.sql. Sans elles, l'app marche comme avant.
- Aucune nouvelle route (tout dans app/api/immo/route.ts : ?r=meta, wa, charter, settings, upload&kind=chat). Cron : celui qui existe.
- Variables : META_WA_ACCESS_TOKEN, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN, META_WA_API_VERSION (opt.), IMMO_HOT_ALERT_PERIOD_HOURS (72), IMMO_HOT_ALERT_STALE_HOURS (12), IMMO_TZ_OFFSET_HOURS (3). L'IA utilise GEMINI_API_KEY / ANTHROPIC_API_KEY deja prevues.
- L'agent IA qui repond seul est DESACTIVE par defaut : Menu AI Real Estate Agent > interrupteur (gestionnaires).
- Tests : npx tsx scripts/test-lot4-5.ts (24 groupes OK) ; npm run build OK. Rien teste en ligne.
- Textes juridiques EN/FR/AR = brouillons a faire valider par un juriste, puis POLICY_DRAFT=false (lib/immo-os/policy.ts).
- Non fait : O38 (traduction complete), lot 8.
