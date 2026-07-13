import { supabaseAdmin } from '@/lib/supabase-admin'
import { nomPays } from '@/lib/pays'

// =====================================================================
// ⚠️ A ADAPTER selon l'actor Apify choisi (voir onglet "Input"/"Runs" sur
// apify.com pour les vrais noms de champs attendus/retournes).
// =====================================================================

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'harvestapi~linkedin-profile-search'

const TAILLE_LABEL: Record<string, string> = {
  startup: 'startup',
  pme: 'PME',
  grande_entreprise: 'grande entreprise',
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

type ClientPourSourcing = {
  id: string
  nom_entreprise: string
  mode_ciblage: string
  secteur_activite: string | null
  taille_entreprise: string | null
  canal_sourcing: string | null
  profil_particulier: string | null
}

// Lance le sourcing pour UN client precis, sur tous ses pays selectionnes.
// Utilise a la fois par le cron automatique (boucle sur tous les clients)
// et par le bouton "Lancer la recherche" du dashboard (un seul client).
export async function lancerSourcingPourClient(clientId: string) {
  const resultats: Record<string, unknown>[] = []
  const LIMITE_PROFILS_PAR_PAYS = 15

  const { data: client, error: clientError } = await supabaseAdmin
    .from('clients')
    .select(
      'id, nom_entreprise, mode_ciblage, secteur_activite, taille_entreprise, canal_sourcing, profil_particulier'
    )
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return [{ erreur: 'Client introuvable' }]
  }

  const typedClient = client as ClientPourSourcing

  // Le canal "linkedin" (ou "tous") est le seul reellement implemente pour l'instant.
  // "facebook" et "email" seul sont des emplacements prevus pour de futures integrations.
  if (typedClient.canal_sourcing === 'facebook' || typedClient.canal_sourcing === 'email') {
    return [
      {
        client: typedClient.nom_entreprise,
        info: `Le canal "${typedClient.canal_sourcing}" n'est pas encore implemente. Seul LinkedIn (via Apify) fonctionne actuellement.`,
      },
    ]
  }

  const { data: paysData } = await supabaseAdmin
    .from('client_countries')
    .select('country_code')
    .eq('client_id', clientId)

  const paysClient = paysData ?? []

  if (paysClient.length === 0) {
    return [{ client: typedClient.nom_entreprise, info: 'Aucun pays selectionne, ignore' }]
  }

  // Construction des mots-cles : profession(s) choisie(s) + secteur + taille (mode entreprise)
  // ou profil particulier choisi (mode particulier)
  let motsCles: string

  if (typedClient.mode_ciblage === 'particulier') {
    motsCles = typedClient.profil_particulier ?? 'Personne en recherche d\'accompagnement'
  } else {
    const { data: professionsData } = await supabaseAdmin
      .from('client_professions')
      .select('profession')
      .eq('client_id', clientId)

    const professions = (professionsData ?? []).map((p) => p.profession)
    motsCles = professions.length > 0 ? professions.join(' OR ') : 'Directeur'

    if (typedClient.secteur_activite) {
      motsCles += ` secteur ${typedClient.secteur_activite}`
    }
    if (typedClient.taille_entreprise && TAILLE_LABEL[typedClient.taille_entreprise]) {
      motsCles += ` ${TAILLE_LABEL[typedClient.taille_entreprise]}`
    }
  }

  for (const { country_code } of paysClient) {
    const pays = nomPays(country_code)

    try {
      const profils = await chercherProfilsApify(motsCles, pays, LIMITE_PROFILS_PAR_PAYS)

      const { data: cibleExistantes } = await supabaseAdmin
        .from('targets')
        .select('linkedin_url')
        .eq('client_id', clientId)
        .not('linkedin_url', 'is', null)

      const urlsExistantes = new Set((cibleExistantes ?? []).map((c) => c.linkedin_url))
      const nouveauxProfils = profils.filter(
        (p) => p.linkedin_url && !urlsExistantes.has(p.linkedin_url)
      )

      if (nouveauxProfils.length > 0) {
        await supabaseAdmin.from('targets').insert(
          nouveauxProfils.map((p) => ({
            client_id: clientId,
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
        client: typedClient.nom_entreprise,
        pays,
        mots_cles_utilises: motsCles,
        profils_trouves: profils.length,
        nouveaux_ajoutes: nouveauxProfils.length,
      })
    } catch (err) {
      resultats.push({
        client: typedClient.nom_entreprise,
        pays,
        erreur: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    }
  }

  return resultats
}
