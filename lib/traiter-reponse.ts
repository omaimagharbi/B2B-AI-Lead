import { supabaseAdmin } from '@/lib/supabase-admin'
import { classifierReponse } from '@/lib/classification'
import { envoyerEmail } from '@/lib/notifications'

// Appelee par les deux webhooks entrants (email + whatsapp) des qu'un message
// de prospect est recu. Centralise : enregistrement du message, classification
// IA du sentiment, mise a jour de la cible, et notification du commercial si
// la reponse est positive (c'est lui qui declenche manuellement l'envoi du
// diagnostic complet depuis l'onglet Validation - on ne l'envoie jamais tout seul).
export async function traiterReponseEntrante(params: {
  clientId: string
  targetId: string
  canal: 'whatsapp' | 'email'
  contenu: string
  expediteur: string
}) {
  const { clientId, targetId, canal, contenu, expediteur } = params

  const sentiment = await classifierReponse(contenu)

  await supabaseAdmin.from('messages_recus').insert({
    client_id: clientId,
    target_id: targetId,
    canal,
    contenu,
    expediteur,
    sentiment_detecte: sentiment,
  })

  await supabaseAdmin
    .from('targets')
    .update({
      reponse_sentiment: sentiment,
      reponse_detectee_at: new Date().toISOString(),
      reponse_a_traiter: sentiment === 'positive',
      // On sort la cible du circuit de relance automatique des qu'elle a
      // repondu, quel que soit le sentiment - relancer quelqu'un qui a deja
      // repondu (meme negativement) grille la credibilite du cabinet.
      nb_relances: 2,
    })
    .eq('id', targetId)

  if (sentiment !== 'positive') return

  // Notification best-effort au cabinet : on ne bloque jamais le webhook
  // pour un email qui echoue.
  try {
    const { data: target } = await supabaseAdmin
      .from('targets')
      .select('nom, client_id, clients(email, nom_entreprise)')
      .eq('id', targetId)
      .single()

    // @ts-ignore - jointure Supabase typee dynamiquement
    const emailCabinet = target?.clients?.email as string | undefined
    // @ts-ignore - jointure Supabase typee dynamiquement
    const nomCabinet = target?.clients?.nom_entreprise as string | undefined
    const dashboardUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/dashboard`

    if (emailCabinet && target) {
      await envoyerEmail(
        emailCabinet,
        `Bonjour ${nomCabinet ?? ''},\n\n${target.nom} a repondu positivement a votre message. Vous pouvez maintenant preparer et envoyer le diagnostic complet depuis l'onglet Validation :\n${dashboardUrl}`
      )
    }
  } catch (err) {
    console.error('Notification reponse positive echouee (non bloquant):', err)
  }
}
