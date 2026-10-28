import { supabaseAdmin } from '@/lib/supabase-admin'

// Monitoring "maison" : on journalise les erreurs critiques dans une table Supabase.
// Ce n'est pas aussi complet qu'un vrai Sentry (pas d'alertes temps reel, pas de
// notifications push), mais ca fonctionne immediatement sans compte externe ni
// configuration supplementaire, et permet de consulter les erreurs recentes dans
// /admin/erreurs. Si tu veux plus tard un vrai monitoring avec alertes (Sentry,
// Better Stack...), ce fichier est l'endroit a remplacer/completer.
export async function logErreur(route: string, err: unknown) {
  try {
    await supabaseAdmin.from('error_logs').insert({
      route,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack ?? null : null,
    })
  } catch {
    // Si meme le logging echoue, on ne fait rien de plus : ne jamais faire planter
    // la requete principale a cause d'un probleme de journalisation
  }
}
