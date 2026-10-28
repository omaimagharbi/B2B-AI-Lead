import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail, construireMessage } from '@/lib/notifications'
import { canalParPays } from '@/lib/pays'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LIMITE_PACKS_ESSAI_GRATUIT = 3
const LIMITE_ENVOIS_PAR_EXECUTION = 30

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const resultats = { envoyes: 0, echoues: 0, bloques_essai_gratuit: 0 }

  try {
    const { data: targets, error: targetsError } = await supabaseAdmin
      .from('targets')
      .select(
        'id, nom, telephone, email, country, client_id, ne_plus_contacter, token_desinscription, clients(id, vertical_id, nom_entreprise, statut_abonnement, message_personnalise, logo_url)'
      )
      .eq('statut', 'nouveau')
      .eq('ne_plus_contacter', false)
      .limit(LIMITE_ENVOIS_PAR_EXECUTION)

    if (targetsError) {
      return NextResponse.json({ error: 'Erreur chargement cibles' }, { status: 500 })
    }

    const compteurPacksParClient = new Map<string, number>()

    for (const target of targets ?? []) {
      // @ts-ignore - jointure Supabase typee dynamiquement
      const client = target.clients as {
        id: string
        vertical_id: string
        nom_entreprise: string
        statut_abonnement: string
        message_personnalise: string | null
        logo_url: string | null
      } | null

      if (!client) {
        resultats.echoues++
        continue
      }

      if (client.statut_abonnement === 'trial') {
        let nombrePacks = compteurPacksParClient.get(client.id)
        if (nombrePacks === undefined) {
          const { count } = await supabaseAdmin
            .from('leads_packs')
            .select('*, diagnostics!inner(client_id)', { count: 'exact', head: true })
            .eq('diagnostics.client_id', client.id)
          nombrePacks = count ?? 0
          compteurPacksParClient.set(client.id, nombrePacks)
        }

        if (nombrePacks >= LIMITE_PACKS_ESSAI_GRATUIT) {
          resultats.bloques_essai_gratuit++
          continue
        }
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
        const { data: diagnostic, error: diagError } = await supabaseAdmin
          .from('diagnostics')
          .insert({ target_id: target.id, client_id: client.id, vertical_id: client.vertical_id })
          .select('token_acces')
          .single()

        if (diagError || !diagnostic) throw new Error('Erreur creation diagnostic')

        const lien = `${SITE_URL}/diagnostic/${diagnostic.token_acces}`
        const lienDesinscription = `${SITE_URL}/desinscription/${target.token_desinscription}`
        const messageParDefaut = `Bonjour ${target.nom},\n\n${client.nom_entreprise} vous invite a decrire votre situation (15 secondes), un expert etudiera votre dossier personnellement :\n${lien}`
        const message = construireMessage(
          client.message_personnalise,
          { nom: target.nom, cabinet: client.nom_entreprise, lien, lienDesinscription },
          messageParDefaut
        )

        if (canal === 'whatsapp') {
          await envoyerWhatsapp(target.telephone!, message, client.logo_url)
        } else {
          await envoyerEmail(target.email!, message, client.logo_url)
        }

        await supabaseAdmin.from('outreach_campaigns').insert({
          client_id: client.id,
          target_id: target.id,
          canal,
          template_message: message,
          statut: 'envoye',
          date_envoi: new Date().toISOString(),
        })

        await supabaseAdmin.from('targets').update({ statut: 'contacte' }).eq('id', target.id)

        resultats.envoyes++
      } catch (err) {
        console.error(`Erreur envoi pour cible ${target.id}:`, err)
        resultats.echoues++
      }
    }

    return NextResponse.json({ succes: true, ...resultats })
  } catch (err) {
    console.error('Erreur cron outreach:', err)
    await logErreur('/api/cron/outreach', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
