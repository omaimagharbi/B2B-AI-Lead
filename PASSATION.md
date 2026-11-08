# Passation lots 4, 5 et 6a (V16 -> V17)
- Migrations : 77 (lot 4), 78 (lot 5), 79 (lot 6a), toutes dans 00_MIGRATIONS_70_a_79_combinees.sql. Sans elles l'app marche comme avant.
- Aucune nouvelle route : tout passe par app/api/immo/route.ts (?r=meta, ?r=wa, ?r=charter, ?r=settings). Cron : celui qui existe (cron-rappels) pour le balayage lead chaud.
- Nouvelles variables : META_WA_ACCESS_TOKEN, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN, META_WA_API_VERSION (opt.), IMMO_HOT_ALERT_PERIOD_HOURS (72), IMMO_HOT_ALERT_STALE_HOURS (12), IMMO_TZ_OFFSET_HOURS (3).
- Tests : npx tsx scripts/test-lot4-5.ts (18 groupes OK). npm run build OK.
- Textes juridiques EN/FR/AR = brouillons (lib/immo-os/policy.ts, POLICY_DRAFT=true) : a faire valider par un juriste.
