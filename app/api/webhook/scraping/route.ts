import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { genererSignalIA } from '@/lib/classification'
import { quotaCiblesDisponible } from '@/lib/quotas'

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

    // Dedoublonnage : meme logique que le sourcing interne (lib/sourcing.ts),
    // on compare sur linkedin_url pour ce client. Les contacts sans linkedin_url
    // sont inseres tels quels (impossible de les dedoublonner sur ce champ).
    const { data: ciblesExistantes } = await supabaseAdmin
      .from('targets')
      .select('linkedin_url')
      .eq('client_id', client_id)
      .not('linkedin_url', 'is', null)

    const urlsExistantes = new Set((ciblesExistantes ?? []).map((c) => c.linkedin_url))
    const contactsFiltres = contacts.filter(
      (c) => !c.linkedin_url || !urlsExistantes.has(c.linkedin_url)
    )
    const nombreDoublons = contacts.length - contactsFiltres.length

    if (contactsFiltres.length === 0) {
      return NextResponse.json({ succes: true, nombre_ajoute: 0, doublons_ignores: nombreDoublons })
    }

    const lignes = contactsFiltres.map((c) => ({
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
      signal_ia: genererSignalIA({
        poste: c.poste_ou_budget ?? null,
        entreprise: c.entreprise_ou_objectif ?? null,
        segmentCategorie: null,
        segmentUrgence: null,
      }),
    }))

    // Le scraping est un process automatise (cron) : plutot que de tout
    // rejeter si le quota est depasse, on tronque a ce qu'il reste de
    // disponible ce mois-ci - le client garde au moins ce qui rentre dans
    // son forfait au lieu de tout perdre.
    const quota = await quotaCiblesDisponible(client_id, lignes.length)
    const lignesRetenues = quota.autorise
      ? lignes
      : lignes.slice(0, Math.max(0, (quota.quota ?? 0) - quota.consomme))

    if (lignesRetenues.length === 0) {
      return NextResponse.json({
        succes: true,
        nombre_ajoute: 0,
        doublons_ignores: nombreDoublons,
        quota_atteint: true,
      })
    }

    const { error } = await supabaseAdmin.from('targets').insert(lignesRetenues)

    if (error) {
      console.error('Erreur insertion cibles scrapees:', error)
      return NextResponse.json({ error: 'Erreur insertion' }, { status: 500 })
    }

    return NextResponse.json({
      succes: true,
      nombre_ajoute: lignesRetenues.length,
      doublons_ignores: nombreDoublons,
      quota_atteint: lignesRetenues.length < lignes.length,
    })
  } catch (err) {
    console.error('Erreur webhook scraping:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
