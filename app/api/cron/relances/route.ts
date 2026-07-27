import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail, construireMessage } from '@/lib/notifications'
import { canalParPays } from '@/lib/pays'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LIMITE_PAR_EXECUTION = 30
const JOURS_AVANT_RELANCE_1 = 3
const JOURS_AVANT_RELANCE_2 = 7

function joursEcoules(date: string): number {
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
}

// Message differencie selon le nombre de relances deja envoyees et l'urgence
// detectee (regles simples, pas d'IA generative).
function construireMessageRelance(params: {
  nom: string
  cabinet: string
  nbRelances: number
  urgence: string | null
}) {
  const { nom, cabinet, nbRelances, urgence } = params

  if (nbRelances === 0) {
    return `Bonjour ${nom},\n\n${cabinet} souhaitait juste s'assurer que vous avez bien reçu notre message. N'hésitez pas à répondre si vous avez des questions.`
  }

  // 2e relance : ton plus direct si l'urgence detectee etait haute
  return urgence === 'haute'
    ? `Bonjour ${nom},\n\n${cabinet} revient vers vous : votre demande semblait urgente, nous restons disponibles pour en discuter rapidement si besoin.`
    : `Bonjour ${nom},\n\n${cabinet} reste à votre disposition si vous souhaitez échanger, sans engagement de votre part.`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const resultats = { relances_envoyees: 0, ignores: 0, echoues: 0 }

  try {
    const { data: targets, error: targetsError } = await supabaseAdmin
      .from('targets')
      .select(
        `id, nom, telephone, email, country, client_id, ne_plus_contacter, token_desinscription,
         nb_relances, derniere_relance_at, segment_urgence,
         clients(nom_entreprise, logo_url, message_personnalise)`
      )
      .eq('statut', 'contacte')
      .eq('ne_plus_contacter', false)
      .lt('nb_relances', 2)
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

      // On determine la date du dernier contact (derniere relance, ou premier envoi)
      let dateDernierContact = target.derniere_relance_at as string | null
      if (!dateDernierContact) {
        const { data: dernierEnvoi } = await supabaseAdmin
          .from('outreach_campaigns')
          .select('date_envoi')
          .eq('target_id', target.id)
          .eq('statut', 'envoye')
          .order('date_envoi', { ascending: false })
          .limit(1)
          .maybeSingle()
        dateDernierContact = dernierEnvoi?.date_envoi ?? null
      }

      if (!dateDernierContact) {
        resultats.ignores++
        continue
      }

      const seuilJours = target.nb_relances === 0 ? JOURS_AVANT_RELANCE_1 : JOURS_AVANT_RELANCE_2
      if (joursEcoules(dateDernierContact) < seuilJours) {
        resultats.ignores++
        continue
      }

      const canal = canalParPays(target.country ?? 'FR')
      if (canal === 'whatsapp' && !target.telephone) {
        resultats.echoues++
        continue
      }
      if (canal === 'email' && !target.email) {
        resultats.echoues++
        continue
      }

      try {
        const lienDesinscription = `${SITE_URL}/desinscription/${target.token_desinscription}`
        const messageParDefaut = construireMessageRelance({
          nom: target.nom,
          cabinet: client.nom_entreprise,
          nbRelances: target.nb_relances,
          urgence: target.segment_urgence,
        })
        // Le message personnalise du cabinet reste utilisable (variables {nom}/{cabinet}/{lien})
        // mais {lien} n'a pas de sens pour une relance simple : on pointe vers le site.
        const message = construireMessage(
          null, // pas de template client pour les relances : on garde un ton neutre et sobre
          { nom: target.nom, cabinet: client.nom_entreprise, lien: SITE_URL, lienDesinscription },
          messageParDefaut
        )

        if (canal === 'whatsapp') {
          await envoyerWhatsapp(target.telephone!, message, client.logo_url)
        } else {
          await envoyerEmail(target.email!, message, client.logo_url)
        }

        await supabaseAdmin.from('outreach_campaigns').insert({
          client_id: target.client_id,
          target_id: target.id,
          canal,
          template_message: message,
          statut: 'envoye',
          type_envoi: 'relance',
          date_envoi: new Date().toISOString(),
        })

        await supabaseAdmin
          .from('targets')
          .update({ nb_relances: target.nb_relances + 1, derniere_relance_at: new Date().toISOString() })
          .eq('id', target.id)

        resultats.relances_envoyees++
      } catch (err) {
        console.error(`Erreur relance pour cible ${target.id}:`, err)
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
