import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Ce webhook est fait pour etre appele par Apify, PhantomBuster, ou tout autre
// outil de scraping, une fois le scraping termine (via leur systeme de "webhook"
// ou "integration" declenche a la fin d'une execution).
//
// Authentification simple par cle secrete (a definir dans .env.local et a
// configurer cote Apify/PhantomBuster comme header "x-webhook-secret")

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.SCRAPING_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
    }

    const body = await req.json()
    const { client_id, contacts } = body as {
      client_id: string
      contacts: Array<{
        nom: string
        entreprise_ou_objectif?: string
        poste_ou_budget?: string
        telephone?: string
        email?: string
        linkedin_url?: string
        country?: string
      }>
    }

    if (!client_id || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    const lignes = contacts.map((c) => ({
      client_id,
      nom: c.nom,
      entreprise_ou_objectif: c.entreprise_ou_objectif ?? null,
      poste_ou_budget: c.poste_ou_budget ?? null,
      telephone: c.telephone ?? null,
      email: c.email ?? null,
      linkedin_url: c.linkedin_url ?? null,
      country: c.country ?? null,
      source_scraping: 'apify_phantombuster',
      statut: 'nouveau',
    }))

    const { error } = await supabaseAdmin.from('targets').insert(lignes)

    if (error) {
      console.error('Erreur insertion cibles scrapees:', error)
      return NextResponse.json({ error: 'Erreur insertion' }, { status: 500 })
    }

    return NextResponse.json({ succes: true, nombre_ajoute: lignes.length })
  } catch (err) {
    console.error('Erreur webhook scraping:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
