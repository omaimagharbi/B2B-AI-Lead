import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail, construireMessage } from '@/lib/notifications'
import { canalParPays } from '@/lib/pays'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LIMITE_PACKS_ESSAI_GRATUIT = 3

export async function POST(req: NextRequest) {
  try {
    const { target_id, type_envoi } = await req.json()
    // type_envoi : 'diagnostic' (par defaut, cree un diagnostic + lien) ou 'message'
    // (envoie juste le message personnalise du cabinet, sans creer de diagnostic)
    const typeEnvoi: 'diagnostic' | 'message' = type_envoi === 'message' ? 'message' : 'diagnostic'

    if (!target_id) {
      return NextResponse.json({ error: 'target_id manquant' }, { status: 400 })
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('targets')
      .select(
        'id, nom, telephone, email, country, client_id, statut, ne_plus_contacter, token_desinscription'
      )
      .eq('id', target_id)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Cible introuvable' }, { status: 404 })
    }

    if (target.ne_plus_contacter) {
      return NextResponse.json({ error: 'Ce prospect s\'est désinscrit' }, { status: 400 })
    }

    if (target.statut !== 'nouveau') {
      return NextResponse.json({ error: 'Cette cible a deja ete contactee' }, { status: 400 })
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, vertical_id, nom_entreprise, statut_abonnement, message_personnalise, logo_url')
      .eq('id', target.client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    // Etape 14 - Monetisation : limite d'essai gratuit (basee sur les packs vendus)
    if (client.statut_abonnement === 'trial') {
      const { count } = await supabaseAdmin
        .from('leads_packs')
        .select('*, diagnostics!inner(client_id)', { count: 'exact', head: true })
        .eq('diagnostics.client_id', client.id)

      if ((count ?? 0) >= LIMITE_PACKS_ESSAI_GRATUIT) {
        return NextResponse.json(
          {
            error: `Limite de l'essai gratuit atteinte. Passez a un abonnement payant pour continuer.`,
            limite_atteinte: true,
          },
          { status: 403 }
        )
      }
    }

    const canal = canalParPays(target.country ?? 'FR')

    if (canal === 'whatsapp' && !target.telephone) {
      return NextResponse.json({ error: "Cette cible n'a pas de telephone" }, { status: 400 })
    }
    if (canal === 'email' && !target.email) {
      return NextResponse.json({ error: "Cette cible n'a pas d'email" }, { status: 400 })
    }

    // On cree le diagnostic uniquement si on envoie un lien de diagnostic (statut
    // par defaut 'brouillon_ia', token auto-genere). Pour un simple message pro,
    // pas de diagnostic cree.
    let lien = SITE_URL
    if (typeEnvoi === 'diagnostic') {
      const { data: diagnostic, error: diagError } = await supabaseAdmin
        .from('diagnostics')
        .insert({
          target_id: target.id,
          client_id: client.id,
          vertical_id: client.vertical_id,
        })
        .select('token_acces')
        .single()

      if (diagError || !diagnostic) {
        return NextResponse.json({ error: 'Erreur creation diagnostic' }, { status: 500 })
      }

      lien = `${SITE_URL}/diagnostic/${diagnostic.token_acces}`
    }

    const lienDesinscription = `${SITE_URL}/desinscription/${target.token_desinscription}`
    const messageParDefaut =
      typeEnvoi === 'diagnostic'
        ? `Bonjour ${target.nom},\n\n${client.nom_entreprise} vous invite a decrire votre situation (15 secondes), un expert etudiera votre dossier personnellement :\n${lien}`
        : `Bonjour ${target.nom},\n\n${client.nom_entreprise} souhaitait vous contacter personnellement. N'hesitez pas a repondre a ce message si vous avez des questions.`
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
      type_envoi: typeEnvoi,
      date_envoi: new Date().toISOString(),
    })

    await supabaseAdmin.from('targets').update({ statut: 'contacte' }).eq('id', target.id)

    return NextResponse.json({ succes: true, canal, type_envoi: typeEnvoi })
  } catch (err) {
    console.error('Erreur /api/outreach/send:', err)
    await logErreur('/api/outreach/send', err)
    return NextResponse.json({ error: "Erreur serveur lors de l'envoi" }, { status: 500 })
  }
}
