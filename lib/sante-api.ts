import { supabaseAdmin } from '@/lib/supabase-admin'

export type ServiceSurveille = 'ia_diagnostic' | 'whatsapp' | 'email' | 'sourcing'

// Enregistre le resultat d'un appel a un service externe. Best-effort :
// une erreur d'ecriture ici ne doit jamais faire echouer l'appel metier
// qui l'a declenchee.
export async function enregistrerSanteApi(
  service: ServiceSurveille,
  succes: boolean,
  details?: string
) {
  try {
    await supabaseAdmin.from('sante_api').insert({
      service,
      succes,
      details: details?.slice(0, 500) ?? null,
    })
  } catch (err) {
    console.error('Erreur enregistrement sante API (non bloquant):', err)
  }
}
