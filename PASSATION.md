# Passation lots 4, 5, 6a, 6b (V16 -> V18)
- Migrations 77 (lot 4), 78 (lot 5), 79 (Meta), 80 (fichiers) : tout dans 00_MIGRATIONS_70_a_80_combinees.sql. Sans elles, l'app marche comme avant.
- Aucune nouvelle route : tout passe par app/api/immo/route.ts (?r=meta, wa, charter, settings, upload&kind=chat). Cron : celui qui existe.
- Variables : META_WA_ACCESS_TOKEN, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN, META_WA_API_VERSION (opt.), IMMO_HOT_ALERT_PERIOD_HOURS (72), IMMO_HOT_ALERT_STALE_HOURS (12), IMMO_TZ_OFFSET_HOURS (3).
- Tests : npx tsx scripts/test-lot4-5.ts (19 groupes OK) ; npm run build OK. Rien teste en ligne (Supabase, Meta, GreenAPI).
- Textes juridiques EN/FR/AR = brouillons a faire valider (lib/immo-os/policy.ts, POLICY_DRAFT).
