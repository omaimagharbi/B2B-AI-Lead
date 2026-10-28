import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerEmail } from '@/lib/notifications'
import { canalParPays } from '@/lib/pays'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LIMITE_PAR_EXECUTION = 30
// Regle validee : une seule relance a J+7, mais ce n'est plus le robot qui
// contacte directement le prospect (ca grillait la credibilite du cabinet
// en cas de mauvais timing) - le cron notifie desormais le commercial, qui
// decide lui-meme d'envoyer ou non une relance depuis le pipeline.
const JOURS_AVANT_RELANCE = 7

function joursEcoules(date: string): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const resultats = { notifications_envoyees: 0, ignores: 0, echoues: 0 }

  try {
    const { data: targets, error: targetsError } = await supabaseAdmin
      .from('targets')
      .select(
        `id, nom, telephone, email, country, client_id, ne_plus_contacter, token_desinscription,
         nb_relances, segment_urgence,
         clients(nom_entreprise, logo_url, message_personnalise, email)`
      )
      .eq('statut', 'contacte')
      .eq('ne_plus_contacter', false)
      // Une seule relance possible, et jamais si le prospect a deja repondu
      // (traiterReponseEntrante met nb_relances a 2 des qu'une reponse arrive,
      // quel que soit son sentiment).
      .lt('nb_relances', 1)
      .is('reponse_sentiment', null)
      .limit(LIMITE_PAR_EXECUTION)

    if (targetsError) {
      return NextResponse.json({ error: 'Erreur chargement cibles' }, { status: 500 })
    }

    for (const target of targets ?? []) {
      // @ts-ignore - jointure Supabase typee dynamiquement
      const client = target.clients as {
        nom_entreprise: string
        logo_url: string | null
        message_personnalise: string | null
        email: string | null
      } | null

      if (!client) {
        resultats.echoues++
        continue
      }

      // On ne relance pas un prospect dont le dossier a deja aboutit a une vente
      const { data: diagnosticsDuTarget } = await supabaseAdmin
        .from('diagnostics')
        .select('id')
        .eq('target_id', target.id)

      const idsDiagnostics = (diagnosticsDuTarget ?? []).map((d) => d.id)
      if (idsDiagnostics.length > 0) {
        const { count: nbPacksAcceptes } = await supabaseAdmin
          .from('leads_packs')
          .select('*', { count: 'exact', head: true })
          .in('diagnostic_id', idsDiagnostics)
          .eq('statut_vente', 'accepte')

        if ((nbPacksAcceptes ?? 0) > 0) {
          resultats.ignores++
          continue
        }
      }

      // Une seule relance possible (filtree plus haut), donc la reference est
      // toujours le tout premier envoi.
      const { data: premierEnvoi } = await supabaseAdmin
        .from('outreach_campaigns')
        .select('date_envoi')
        .eq('target_id', target.id)
        .eq('statut', 'envoye')
        .order('date_envoi', { ascending: true })
        .limit(1)
        .maybeSingle()

      const dateDernierContact = premierEnvoi?.date_envoi ?? null

      if (!dateDernierContact) {
        resultats.ignores++
        continue
      }

      if (joursEcoules(dateDernierContact) < JOURS_AVANT_RELANCE) {
        resultats.ignores++
        continue
      }

      if (!client.email) {
        resultats.echoues++
        continue
      }

      try {
        // Canal suggere au commercial pour sa relance manuelle (whatsapp en
        // Tunisie/Golfe, email ailleurs) - purement indicatif dans le texte.
        const canal = canalParPays(target.country ?? 'FR')
        const dashboardUrl = `${SITE_URL}/dashboard`
        const tonalite =
          target.segment_urgence === 'haute'
            ? "sa demande semblait urgente lors du premier contact"
            : "aucune urgence particuliere detectee au premier contact"

        await envoyerEmail(
          client.email,
          `Bonjour ${client.nom_entreprise ?? ''},\n\n${target.nom} n'a pas repondu depuis 7 jours (${tonalite}). ` +
            `Une relance manuelle via ${canal === 'whatsapp' ? 'WhatsApp' : 'e-mail'} peut valoir le coup si le contexte s'y prete. ` +
            `Retrouvez la fiche dans votre pipeline :\n${dashboardUrl}`,
          client.logo_url
        )

        await supabaseAdmin
          .from('targets')
          .update({ nb_relances: target.nb_relances + 1, derniere_relance_at: new Date().toISOString() })
          .eq('id', target.id)

        resultats.notifications_envoyees++
      } catch (err) {
        console.error(`Erreur notification relance pour cible ${target.id}:`, err)
        resultats.echoues++
      }
    }

    return NextResponse.json({ succes: true, ...resultats })
  } catch (err) {
    console.error('Erreur cron relances:', err)
    await logErreur('/api/cron/relances', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
