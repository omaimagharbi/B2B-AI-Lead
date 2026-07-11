import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// =====================================================================
// CONFIGURATION IMPORTANTE A LIRE AVANT UTILISATION
// =====================================================================
// Ce cron appelle un "Actor" Apify (un scraper LinkedIn tout fait, disponible
// sur apify.com/store) pour chercher des profils LinkedIn par mots-cles.
//
// 1. Va sur apify.com, cree un compte, cherche dans le Store un actor de
//    recherche LinkedIn par mots-cles (ex: "harvestapi/linkedin-profile-search"
//    ou "apimaestro/linkedin-profile-search-scraper"). Certains necessitent un
//    abonnement/credit Apify (facturation a l'usage, comme Anthropic).
// 2. Une fois choisi, note son identifiant exact (format "createur~nom-actor",
//    visible dans l'URL de l'actor sur apify.com) -> variable APIFY_ACTOR_ID
// 3. ⚠️ CRUCIAL : ouvre l'onglet "Input" de cet actor sur sa page Apify pour
//    voir EXACTEMENT quels champs il attend (ca varie d'un actor a l'autre :
//    "searchQuery", "keywords", "title"+"location", etc.). Adapte la fonction
//    construireInputApify() ci-dessous en consequence - le nom des champs
//    ci-dessous est un exemple plausible, pas une garantie universelle.
// 4. Idem pour le format de sortie (les noms de champs du resultat) : adapte
//    la fonction mapperResultatApify() ci-dessous selon ce que l'actor renvoie
//    reellement (regarde un exemple de resultat dans l'onglet "Runs" d'Apify).
// =====================================================================

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'harvestapi~linkedin-profile-search'

// Mots-cles de recherche selon le vertical (a affiner selon tes retours terrain)
const ROLES_PAR_VERTICAL: Record<string, string> = {
  'cabinet-formation': 'DRH OR Responsable Formation OR Directeur des Ressources Humaines',
  'startup-saas': 'CTO OR Lead Developer OR VP Engineering',
  'pme-services': 'Directeur General OR Gerant OR Fondateur',
}

// Pays cible selon la zone du client (adapte "France" si tu vises un autre pays)
const PAYS_PAR_ZONE: Record<string, string> = {
  tunisie: 'Tunisia',
  international: 'France',
}

function construireInputApify(motsCles: string, pays: string, limite: number) {
  // ⚠️ A ADAPTER selon l'actor choisi (voir onglet Input sur apify.com)
  return {
    searchQuery: motsCles,
    location: pays,
    maxItems: limite,
  }
}

function mapperResultatApify(item: Record<string, unknown>) {
  // ⚠️ A ADAPTER selon l'actor choisi (voir un exemple de resultat reel sur apify.com)
  return {
    nom: (item.fullName ?? item.name ?? item.title ?? 'Prospect LinkedIn') as string,
    entreprise: (item.currentCompany ?? item.company ?? null) as string | null,
    poste: (item.headline ?? item.jobTitle ?? item.position ?? null) as string | null,
    linkedin_url: (item.profileUrl ?? item.url ?? item.linkedinUrl ?? null) as string | null,
    email: (item.email ?? null) as string | null,
    telephone: (item.phone ?? null) as string | null,
  }
}

async function chercherProfilsApify(motsCles: string, pays: string, limite: number) {
  if (!APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN manquant')
  }

  const input = construireInputApify(motsCles, pays, limite)

  const res = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
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
  // Securite : Vercel envoie automatiquement ce header pour ses propres crons
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const LIMITE_PROFILS_PAR_CLIENT = 20
  const resultats: Record<string, unknown>[] = []

  try {
    // 1. On recupere tous les cabinets actifs, avec leur vertical et leur zone
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, nom_entreprise, zone_geographique, verticals(slug)')
      .not('zone_geographique', 'is', null)

    if (clientsError) {
      return NextResponse.json({ error: 'Erreur chargement clients' }, { status: 500 })
    }

    for (const client of clients ?? []) {
      // @ts-expect-error - jointure Supabase typee dynamiquement
      const verticalSlug = client.verticals?.slug as string | undefined
      const zone = client.zone_geographique as string

      const motsCles = ROLES_PAR_VERTICAL[verticalSlug ?? ''] ?? 'Directeur'
      const pays = PAYS_PAR_ZONE[zone] ?? 'France'

      try {
        const profils = await chercherProfilsApify(motsCles, pays, LIMITE_PROFILS_PAR_CLIENT)

        // On evite les doublons : on ne garde que les profils dont le linkedin_url
        // n'est pas deja present pour ce client
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
          const lignes = nouveauxProfils.map((p) => ({
            client_id: client.id,
            nom: p.nom,
            entreprise: p.entreprise,
            poste: p.poste,
            linkedin_url: p.linkedin_url,
            email: p.email,
            telephone: p.telephone,
            source_scraping: 'apify_linkedin',
            statut: 'nouveau',
          }))

          await supabaseAdmin.from('targets').insert(lignes)
        }

        resultats.push({
          client: client.nom_entreprise,
          profils_trouves: profils.length,
          nouveaux_ajoutes: nouveauxProfils.length,
        })
      } catch (err) {
        console.error(`Erreur sourcing pour ${client.nom_entreprise}:`, err)
        resultats.push({
          client: client.nom_entreprise,
          erreur: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      }
    }

    return NextResponse.json({ succes: true, resultats })
  } catch (err) {
    console.error('Erreur cron sourcing:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
