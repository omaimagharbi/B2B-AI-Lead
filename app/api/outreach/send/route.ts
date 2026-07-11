import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail } from '@/lib/notifications'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const LIMITE_LEADS_ESSAI_GRATUIT = 3

export async function POST(req: NextRequest) {
  try {
    const { target_id } = await req.json()
    if (!target_id) {
      return NextResponse.json({ error: 'target_id manquant' }, { status: 400 })
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('targets')
      .select('id, nom, telephone, email, client_id, statut')
      .eq('id', target_id)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Cible introuvable' }, { status: 404 })
    }

    if (target.statut !== 'nouveau') {
      return NextResponse.json({ error: 'Cette cible a deja ete contactee' }, { status: 400 })
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id, vertical_id, zone_geographique, nom_entreprise, statut_abonnement')
      .eq('id', target.client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    if (client.statut_abonnement === 'trial') {
      const { count: nombreLeadsLivres } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id)

      if ((nombreLeadsLivres ?? 0) >= LIMITE_LEADS_ESSAI_GRATUIT) {
        return NextResponse.json(
          {
            error: `Limite de l'essai gratuit atteinte (${LIMITE_LEADS_ESSAI_GRATUIT} fiches). Passez a un abonnement payant pour continuer a recevoir des prospects.`,
            limite_atteinte: true,
          },
          { status: 403 }
        )
      }
    }

    const canal = client.zone_geographique === 'tunisie' ? 'whatsapp' : 'email'

    if (canal === 'whatsapp' && !target.telephone) {
      return NextResponse.json({ error: "Cette cible n'a pas de telephone" }, { status: 400 })
    }
    if (canal === 'email' && !target.email) {
      return NextResponse.json({ error: "Cette cible n'a pas d'email" }, { status: 400 })
    }

    const { data: diagnostic, error: diagError } = await supabaseAdmin
      .from('diagnostics')
      .insert({
        target_id: target.id,
        client_id: client.id,
        vertical_id: client.vertical_id,
        statut: 'en_attente',
      })
      .select('token_acces')
      .single()

    if (diagError || !diagnostic) {
      return NextResponse.json({ error: 'Erreur creation diagnostic' }, { status: 500 })
    }

    const lien = `${SITE_URL}/diagnostic/${diagnostic.token_acces}`
    const message = `Bonjour ${target.nom},\n\n${client.nom_entreprise} vous invite a realiser un diagnostic gratuit et personnalise (15 secondes) :\n${lien}`

    if (canal === 'whatsapp') {
      await envoyerWhatsapp(target.telephone!, message)
    } else {
      await envoyerEmail(target.email!, message)
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

    return NextResponse.json({ succes: true, canal })
  } catch (err) {
    console.error('Erreur /api/outreach/send:', err)
    return NextResponse.json({ error: "Erreur serveur lors de l'envoi" }, { status: 500 })
  }
}
