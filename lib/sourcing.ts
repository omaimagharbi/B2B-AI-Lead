import { supabaseAdmin } from '@/lib/supabase-admin'
import { nomPays } from '@/lib/pays'

// =====================================================================
// ⚠️ A ADAPTER selon les actors Apify choisis (voir onglet "Input"/"Runs"
// sur apify.com pour les vrais noms de champs attendus/retournes - ils
// varient d'un actor a l'autre, ce qui suit sont des noms plausibles a
// verifier/ajuster une fois l'actor reellement selectionne sur Apify).
// =====================================================================

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN

const ACTOR_LINKEDIN = process.env.APIFY_ACTOR_ID ?? 'harvestapi~linkedin-profile-search'
const ACTOR_GOOGLE_MAPS = process.env.APIFY_ACTOR_ID_GMAPS ?? 'compass~crawler-google-places'
const ACTOR_FACEBOOK = process.env.APIFY_ACTOR_ID_FACEBOOK ?? 'apify~facebook-pages-scraper'
const ACTOR_WEB = process.env.APIFY_ACTOR_ID_WEB ?? 'apify~google-search-scraper'

const TAILLE_LABEL: Record<string, string> = {
  startup: 'startup',
  pme: 'PME',
  grande_entreprise: 'grande entreprise',
}

type ProfilTrouve = {
  nom: string
  entreprise_ou_objectif: string | null
  poste_ou_budget: string | null
  linkedin_url: string | null
  email: string | null
  telephone: string | null
}

// =====================================================================
// Appel generique a un actor Apify (run-sync-get-dataset-items)
// =====================================================================
async function appellerApify(actorId: string, input: Record<string, unknown>) {
  if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN manquant')

  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Erreur Apify ${actorId} (${res.status}): ${detail}`)
  }

  return (await res.json()) as Record<string, unknown>[]
}

// =====================================================================
// SOURCE 1 : LinkedIn (recherche de profils par mots-cles + pays)
// =====================================================================
async function chercherLinkedIn(motsCles: string, pays: string, limite: number): Promise<ProfilTrouve[]> {
  const items = await appellerApify(ACTOR_LINKEDIN, {
    searchQuery: motsCles,
    location: pays,
    maxItems: limite,
  })

  return items.map((item) => ({
    nom: (item.fullName ?? item.name ?? item.title ?? 'Prospect LinkedIn') as string,
    entreprise_ou_objectif: (item.currentCompany ?? item.company ?? null) as string | null,
    poste_ou_budget: (item.headline ?? item.jobTitle ?? item.position ?? null) as string | null,
    linkedin_url: (item.profileUrl ?? item.url ?? item.linkedinUrl ?? null) as string | null,
    email: (item.email ?? null) as string | null,
    telephone: (item.phone ?? null) as string | null,
  }))
}

// =====================================================================
// SOURCE 2 : Google Maps / Google Business (entreprises locales)
// Ideal pour les PME peu presentes sur LinkedIn (tres pertinent en Tunisie)
// =====================================================================
async function chercherGoogleMaps(motsCles: string, pays: string, limite: number): Promise<ProfilTrouve[]> {
  const items = await appellerApify(ACTOR_GOOGLE_MAPS, {
    searchStringsArray: [`${motsCles} ${pays}`],
    maxCrawledPlaces: limite,
    language: 'fr',
  })

  return items.map((item) => ({
    nom: (item.title ?? item.name ?? 'Entreprise trouvee') as string,
    entreprise_ou_objectif: (item.title ?? null) as string | null,
    poste_ou_budget: (item.categoryName ?? item.category ?? null) as string | null,
    linkedin_url: (item.website ?? item.url ?? null) as string | null, // on reutilise ce champ pour le site web / dedoublonnage
    email: (item.email ?? null) as string | null,
    telephone: (item.phone ?? item.phoneNumber ?? null) as string | null,
  }))
}

// =====================================================================
// SOURCE 3 : Facebook Pages (tres utilise par les PME tunisiennes)
// =====================================================================
async function chercherFacebook(motsCles: string, pays: string, limite: number): Promise<ProfilTrouve[]> {
  const items = await appellerApify(ACTOR_FACEBOOK, {
    searchQuery: `${motsCles} ${pays}`,
    maxItems: limite,
  })

  return items.map((item) => ({
    nom: (item.pageName ?? item.title ?? item.name ?? 'Page Facebook') as string,
    entreprise_ou_objectif: (item.pageName ?? item.title ?? null) as string | null,
    poste_ou_budget: (item.category ?? null) as string | null,
    linkedin_url: (item.pageUrl ?? item.url ?? null) as string | null,
    email: (item.email ?? null) as string | null,
    telephone: (item.phone ?? null) as string | null,
  }))
}

// =====================================================================
// SOURCE 4 : Recherche web generale (sites d'entreprises, pages contact)
// Moins fiable (pas de contact direct garanti), utile en complement
// =====================================================================
async function chercherWeb(motsCles: string, pays: string, limite: number): Promise<ProfilTrouve[]> {
  const items = await appellerApify(ACTOR_WEB, {
    queries: `${motsCles} ${pays} contact email`,
    maxPagesPerQuery: 1,
    resultsPerPage: limite,
  })

  return items.map((item) => ({
    nom: (item.title ?? 'Resultat web') as string,
    entreprise_ou_objectif: (item.title ?? null) as string | null,
    poste_ou_budget: null,
    linkedin_url: (item.url ?? null) as string | null,
    email: null, // necessiterait un crawl de la page pour extraire un email, non fait ici
    telephone: null,
  }))
}

const SOURCES: Record<string, (m: string, p: string, l: number) => Promise<ProfilTrouve[]>> = {
  linkedin: chercherLinkedIn,
  google_maps: chercherGoogleMaps,
  facebook: chercherFacebook,
  web: chercherWeb,
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

// Lance le sourcing pour UN client precis, sur tous ses pays selectionnes,
// et sur toutes les sources activees (une seule, ou "tous" = les 4 combinees).
// Utilise a la fois par le cron automatique et par le bouton "Lancer la recherche".
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
    motsCles = typedClient.profil_particulier ?? "Personne en recherche d'accompagnement"
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

  // Determine quelle(s) source(s) utiliser
  const canal = typedClient.canal_sourcing ?? 'linkedin'
  const sourcesActives = canal === 'tous' ? Object.keys(SOURCES) : [canal]

  for (const { country_code } of paysClient) {
    const pays = nomPays(country_code)

    for (const sourceNom of sourcesActives) {
      const chercherFn = SOURCES[sourceNom]
      if (!chercherFn) {
        resultats.push({
          client: typedClient.nom_entreprise,
          pays,
          info: `Source "${sourceNom}" inconnue, ignoree`,
        })
        continue
      }

      try {
        const profils = await chercherFn(motsCles, pays, LIMITE_PROFILS_PAR_PAYS)

        // Dedoublonnage : on compare sur le champ linkedin_url, reutilise pour
        // stocker l'URL de reference (profil LinkedIn, site web, ou page Facebook)
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
              source_scraping: `apify_${sourceNom}`,
              statut: 'nouveau',
            }))
          )
        }

        resultats.push({
          client: typedClient.nom_entreprise,
          pays,
          source: sourceNom,
          mots_cles_utilises: motsCles,
          profils_trouves: profils.length,
          nouveaux_ajoutes: nouveauxProfils.length,
        })
      } catch (err) {
        resultats.push({
          client: typedClient.nom_entreprise,
          pays,
          source: sourceNom,
          erreur: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      }
    }
  }

  return resultats
}
