import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { nomPays } from '@/lib/pays'

// =====================================================================
// ⚠️ A ADAPTER selon l'actor Apify choisi (voir onglet "Input"/"Runs" sur
// apify.com pour les vrais noms de champs attendus/retournes). Voir les
// commentaires detailles dans la premiere version de ce fichier (etape 17).
// =====================================================================

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'harvestapi~linkedin-profile-search'

const ROLES_PAR_VERTICAL: Record<string, string> = {
  'cabinet-formation-entreprise': 'DRH OR Responsable Formation OR Directeur des Ressources Humaines',
  'cabinet-formation-particulier': 'Personne en reconversion professionnelle OR recherche coaching',
  'startup-saas': 'CTO OR Lead Developer OR VP Engineering',
  'pme-services': 'Directeur General OR Gerant OR Fondateur',
}

function construireInputApify(motsCles: string, pays: string, limite: number) {
  return { searchQuery: motsCles, location: pays, maxItems: limite }
}

function mapperResultatApify(item: Record<string, unknown>) {
  return {
    nom: (item.fullName ?? item.name ?? item.title ?? 'Prospect LinkedIn') as string,
    entreprise_ou_objectif: (item.currentCompany ?? item.company ?? null) as string | null,
    poste_ou_budget: (item.headline ?? item.jobTitle ?? item.position ?? null) as string | null,
    linkedin_url: (item.profileUrl ?? item.url ?? item.linkedinUrl ?? null) as string | null,
    email: (item.email ?? null) as string | null,
    telephone: (item.phone ?? null) as string | null,
  }
}

async function chercherProfilsApify(motsCles: string, pays: string, limite: number) {
  if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN manquant')

  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(construireInputApify(motsCles, pays, limite)),
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Erreur Apify (${res.status}): ${detail}`)
  }

  const items = (await res.json()) as Record<string, unknown>[]
  return items.map(mapperResultatApify)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader ===
