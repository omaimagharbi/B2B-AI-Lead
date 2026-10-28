import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifie si un client peut encore extraire `nbSupplementaire` cibles ce
// mois-ci, selon son quota_cibles_mensuel (NULL = illimite). Utilise avant
// chaque import/scraping pour ne jamais depasser le quota fixe par l'admin.
export async function quotaCiblesDisponible(
  clientId: string,
  nbSupplementaire: number
): Promise<{ autorise: boolean; consomme: number; quota: number | null }> {
  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('quota_cibles_mensuel')
    .eq('id', clientId)
    .single()

  const quota = client?.quota_cibles_mensuel ?? null

  if (quota === null) {
    return { autorise: true, consomme: 0, quota: null }
  }

  const { data: consommeData } = await supabaseAdmin.rpc('cibles_extraites_ce_mois', {
    p_client_id: clientId,
  })

  const consomme = (consommeData as number) ?? 0

  return { autorise: consomme + nbSupplementaire <= quota, consomme, quota }
}
