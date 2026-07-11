import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

async function envoyerWhatsapp(telephone: string, message: string) {
  const idInstance = process.env.GREENAPI_ID_INSTANCE
  const apiToken = process.env.GREENAPI_API_TOKEN

  if (!idInstance || !apiToken) {
    throw new Error('Configuration GreenAPI manquante')
  }

  // Format attendu par GreenAPI : indicatif pays + numero, sans "+" ni espaces, suivi de "@c.us"
  const numeroFormatte = telephone.replace(/[^0-9]/g, '') + '@c.us'

  const res = await fetch(
    `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: numeroFormatte, message }),
    }
  )

  if (!res.ok) throw new Error('Echec envoi WhatsApp')
}

async function envoyerEmail(email: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Configuration Resend manquante')

  // Par defaut on utilise l'adresse de test Resend (fonctionne sans verifier de domaine,
  // mais n'envoie qu'a l'adresse email avec laquelle tu t'es inscrit sur Resend).
  // Une fois ton propre domaine verifie sur resend.com/domains, mets RESEND_FROM_EMAIL
  // dans Vercel avec une adresse de ce domaine (ex: diagnostic@catalyste.tn)
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: 'Votre diagnostic de compétences personnalisé',
      html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Erreur Resend:', detail)
    throw new Error('Echec envoi Email')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { target_id } = await req.json()
    if (!target_id) {
      return NextResponse.json({ error: 'target_id manquant' }, { status: 400 })
    }

    // 1. On recupere la cible + le client associe (pour connaitre la zone/canal)
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
      .select('id, vertical_id, zone_geographique, nom_entreprise')
      .eq('id', target.client_id)
      .single()

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }

    const canal = client.zone_geographique === 'tunisie' ? 'whatsapp' : 'email'

    if (canal === 'whatsapp' && !target.telephone) {
      return NextResponse.json({ error: 'Cette cible n\'a pas de telephone' }, { status: 400 })
    }
    if (canal === 'email' && !target.email) {
      return NextResponse.json({ error: 'Cette cible n\'a pas d\'email' }, { status: 400 })
    }

    // 2. On cree le diagnostic (le token_acces est genere automatiquement par la DB)
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
    const message = `Bonjour ${target.nom},\n\n${client.nom_entreprise} vous invite a realiser un diagnostic gratuit et personnalise de vos besoins en formation (15 secondes) :\n${lien}`

    // 3. Envoi effectif selon le canal
    if (canal === 'whatsapp') {
      await envoyerWhatsapp(target.telephone!, message)
    } else {
      await envoyerEmail(target.email!, message)
    }

    // 4. On journalise la campagne et on met a jour le statut de la cible
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
    return NextResponse.json({ error: 'Erreur serveur lors de l\'envoi' }, { status: 500 })
  }
}
