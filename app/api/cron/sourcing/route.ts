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
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const LIMITE_PROFILS_PAR_PAYS = 15
  const resultats: Record<string, unknown>[] = []

  try {
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select(
        'id, nom_entreprise, mode_ciblage, secteur_activite, taille_entreprise, verticals(slug), client_countries(country_code)'
      )

    if (clientsError) {
      return NextResponse.json({ error: 'Erreur chargement clients' }, { status: 500 })
    }

    for (const client of clients ?? []) {
      // @ts-ignore - jointures Supabase typees dynamiquement
      const verticalSlug = client.verticals?.slug as string | undefined
      const paysClient = (client.client_countries ?? []) as { country_code: string }[]

      if (paysClient.length === 0) {
        resultats.push({ client: client.nom_entreprise, info: 'Aucun pays selectionne, ignore' })
        continue
      }

      const cleRole =
        verticalSlug === 'cabinet-formation'
          ? `cabinet-formation-${client.mode_ciblage ?? 'entreprise'}`
          : verticalSlug ?? ''
      let motsCles = ROLES_PAR_VERTICAL[cleRole] ?? 'Directeur'

      // On affine avec le secteur d'activite et la taille d'entreprise si renseignes
      // (uniquement pertinent en mode "entreprise", pas pour les prospects particuliers)
      if (client.mode_ciblage !== 'particulier') {
        if (client.secteur_activite) {
          motsCles += ` secteur ${client.secteur_activite}`
        }
        const tailleLabel: Record<string, string> = {
          startup: 'startup',
          pme: 'PME',
          grande_entreprise: 'grande entreprise',
        }
        if (client.taille_entreprise && tailleLabel[client.taille_entreprise]) {
          motsCles += ` ${tailleLabel[client.taille_entreprise]}`
        }
      }

      for (const { country_code } of paysClient) {
        const pays = nomPays(country_code)

        try {
          const profils = await chercherProfilsApify(motsCles, pays, LIMITE_PROFILS_PAR_PAYS)

          const { data: cibleExistantes } = await supabaseAdmin
            .from('targets')
            .select('linkedin_url')
            .eq('client_id', client.id)
            .not('linkedin_url', 'is', null)

          const urlsExistantes = new Set((cibleExistantes ?? []).map((c) => c.linkedin_url))
          const nouveauxProfils = profils.filter(
            (p) => p.linkedin_url && !urlsExistantes.has(p.linkedin_url)
          )

          if (nouveauxProfils.length > 0) {
            await supabaseAdmin.from('targets').insert(
              nouveauxProfils.map((p) => ({
                client_id: client.id,
                nom: p.nom,
                entreprise_ou_objectif: p.entreprise_ou_objectif,
                poste_ou_budget: p.poste_ou_budget,
                linkedin_url: p.linkedin_url,
                email: p.email,
                telephone: p.telephone,
                country: country_code,
                source_scraping: 'apify_linkedin',
                statut: 'nouveau',
              }))
            )
          }

          resultats.push({
            client: client.nom_entreprise,
            pays,
            profils_trouves: profils.length,
            nouveaux_ajoutes: nouveauxProfils.length,
          })
        } catch (err) {
          resultats.push({
            client: client.nom_entreprise,
            pays,
            erreur: err instanceof Error ? err.message : 'Erreur inconnue',
          })
        }
      }
    }

    return NextResponse.json({ succes: true, resultats })
  } catch (err) {
    console.error('Erreur cron sourcing:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
