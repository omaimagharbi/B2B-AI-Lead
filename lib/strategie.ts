// =====================================================================
// MOTEUR DE STRATEGIE COMMERCIALE - 100% base sur des regles (mots-cles,
// conditions), aucun appel a une IA generative. Objectif : a partir du
// texte libre du prospect (phrase_brute_prospect) et de quelques infos
// de la cible, produire :
//   1) une segmentation (categorie de probleme + urgence)
//   2) un score de chaleur du lead (0-100)
//   3) des recommandations commerciales pour le cabinet (usage interne)
//   4) une suggestion de contenu marketing lie a la categorie detectee
//
// Tout est configurable ici (dictionnaires + regles) sans toucher au
// reste de l'application.
// =====================================================================

export type Categorie =
  | 'financier'
  | 'humain'
  | 'strategique'
  | 'organisationnel'
  | 'juridique'
  | 'technique'
  | 'general'

export type Urgence = 'haute' | 'moyenne' | 'basse'

export type Segment = {
  categorie: Categorie
  urgence: Urgence
  budget_mentionne: boolean
}

export type Recommandation = {
  titre: string
  action: string
  priorite: 'haute' | 'moyenne' | 'basse'
  questions?: string[]
}

export type ContenuMarketing = {
  titre: string
  accroche_linkedin: string
  format_suggere: string
}

// ---------------------------------------------------------------------
// 1. DICTIONNAIRES DE MOTS-CLES (a enrichir librement)
// ---------------------------------------------------------------------

const MOTS_CLES_CATEGORIE: Record<Exclude<Categorie, 'general'>, string[]> = {
  financier: [
    'budget', 'tresorerie', 'financement', 'cout', 'couts', 'rentabilite',
    'chiffre d\'affaires', 'marge', 'facturation', 'investissement', 'prix',
  ],
  humain: [
    'equipe', 'rh', 'recrutement', 'personnel', 'management', 'conflit',
    'turnover', 'motivation', 'collaborateur', 'ressources humaines',
  ],
  strategique: [
    'strategie', 'croissance', 'developpement', 'positionnement',
    'concurrence', 'expansion', 'vision', 'objectifs', 'business plan',
  ],
  organisationnel: [
    'process', 'organisation', 'delai', 'planning', 'projet', 'retard',
    'priorisation', 'gestion de projet', 'methode', 'productivite',
  ],
  juridique: [
    'contrat', 'juridique', 'loi', 'conformite', 'litige', 'reglementation',
    'clause', 'avocat', 'legal',
  ],
  technique: [
    'technique', 'outil', 'logiciel', 'systeme', 'digital', 'informatique',
    'plateforme', 'automatisation', 'application',
  ],
}

const MOTS_CLES_URGENCE_HAUTE = [
  'urgent', 'urgence', 'rapide', 'vite', 'immediat', 'des que possible',
  'au plus vite', 'sans tarder', 'tres vite', 'aujourd\'hui', 'cette semaine',
]

const MOTS_CLES_URGENCE_BASSE = [
  'a terme', 'plus tard', 'sans urgence', 'reflexion', 'explorer',
  'me renseigner', 'dans quelques mois', 'pas presse',
]

const MOTS_CLES_BUDGET = ['budget', 'prix', 'cout', 'tarif', 'combien', 'euros', 'dinars', 'tnd']

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // enleve les accents pour un matching plus robuste
}

function contientUnDesMots(texte: string, mots: string[]): boolean {
  return mots.some((mot) => texte.includes(normaliser(mot)))
}

// ---------------------------------------------------------------------
// 2. SEGMENTATION
// ---------------------------------------------------------------------

export function calculerSegment(phraseProspect: string, posteOuBudget?: string | null): Segment {
  const texte = normaliser(`${phraseProspect} ${posteOuBudget ?? ''}`)

  let categorie: Categorie = 'general'
  let meilleurScore = 0

  for (const [cat, mots] of Object.entries(MOTS_CLES_CATEGORIE) as [
    Exclude<Categorie, 'general'>,
    string[]
  ][]) {
    const nbMatches = mots.filter((mot) => texte.includes(normaliser(mot))).length
    if (nbMatches > meilleurScore) {
      meilleurScore = nbMatches
      categorie = cat
    }
  }

  let urgence: Urgence = 'moyenne'
  if (contientUnDesMots(texte, MOTS_CLES_URGENCE_HAUTE)) urgence = 'haute'
  else if (contientUnDesMots(texte, MOTS_CLES_URGENCE_BASSE)) urgence = 'basse'

  const budget_mentionne = contientUnDesMots(texte, MOTS_CLES_BUDGET)

  return { categorie, urgence, budget_mentionne }
}

// ---------------------------------------------------------------------
// 3. SCORE DE CHALEUR DU LEAD (0-100)
// ---------------------------------------------------------------------

export function calculerScoreChaleur(params: {
  phraseProspect: string
  segment: Segment
  nbRelancesDejaEnvoyees?: number
}): number {
  const { phraseProspect, segment, nbRelancesDejaEnvoyees = 0 } = params
  let score = 40 // le prospect a repondu au diagnostic = deja engage

  // Plus la description est detaillee, plus l'engagement est fort (jusqu'a +20)
  const nbMots = phraseProspect.trim().split(/\s+/).filter(Boolean).length
  score += Math.min(20, Math.floor(nbMots / 5) * 2)

  // Urgence exprimee = lead plus chaud
  if (segment.urgence === 'haute') score += 20
  else if (segment.urgence === 'basse') score -= 10

  // Budget deja mentionne = signal d'achat fort
  if (segment.budget_mentionne) score += 10

  // Chaque relance sans reponse fait redescendre la temperature du lead
  score -= nbRelancesDejaEnvoyees * 10

  return Math.max(0, Math.min(100, score))
}

// ---------------------------------------------------------------------
// 4. RECOMMANDATIONS COMMERCIALES (usage interne cabinet, jamais montrees
//    au prospect)
// ---------------------------------------------------------------------

// Questions de clarification pre-ecrites (pas d'IA generative) : a poser au prospect
// quand le besoin reste flou (categorie "general" faute de mots-cles suffisants).
const QUESTIONS_CLARIFICATION: string[] = [
  "Quel est le principal impact de ce problème aujourd'hui (temps perdu, argent, stress) ?",
  'Depuis combien de temps cette situation dure-t-elle ?',
  'Avez-vous déjà essayé une solution, et pourquoi ça n\'a pas suffi ?',
]

export function genererRecommandations(segment: Segment, score: number): Recommandation[] {
  const recos: Recommandation[] = []

  if (segment.urgence === 'haute') {
    recos.push({
      titre: 'Contact rapide recommande',
      action:
        "L'urgence exprimee justifie un appel telephonique ou un message vocal plutot qu'un simple email, dans les 24h.",
      priorite: 'haute',
    })
  }

  if (segment.budget_mentionne) {
    recos.push({
      titre: 'Prospect deja en reflexion budgetaire',
      action:
        'Proposer directement une offre chiffree et precise plutot que du contenu generaliste : le prospect a deja depasse la phase de decouverte.',
      priorite: 'haute',
    })
  }

  switch (segment.categorie) {
    case 'financier':
      recos.push({
        titre: 'Angle financier',
        action: "Mettre en avant le retour sur investissement (ROI) chiffre de l'accompagnement.",
        priorite: 'moyenne',
      })
      break
    case 'humain':
      recos.push({
        titre: 'Angle humain / RH',
        action:
          'Partager un temoignage ou cas client similaire en gestion RH avant de parler tarifs.',
        priorite: 'moyenne',
      })
      break
    case 'strategique':
      recos.push({
        titre: 'Angle strategique',
        action: 'Proposer un premier echange de cadrage strategique gratuit avant de vendre.',
        priorite: 'moyenne',
      })
      break
    case 'organisationnel':
      recos.push({
        titre: 'Angle organisationnel',
        action: 'Insister sur le gain de temps et la reduction des delais dans le premier message.',
        priorite: 'moyenne',
      })
      break
    case 'juridique':
      recos.push({
        titre: 'Angle conformite',
        action: 'Rassurer sur la fiabilite/expertise avant toute proposition commerciale.',
        priorite: 'moyenne',
      })
      break
    case 'technique':
      recos.push({
        titre: 'Angle outillage',
        action: 'Proposer une demonstration concrete de l\'outil/solution plutot qu\'un discours theorique.',
        priorite: 'moyenne',
      })
      break
    default:
      recos.push({
        titre: 'Besoin encore flou',
        action:
          "Poser ces questions de clarification avant de proposer une offre, le besoin n'est pas encore precis.",
        priorite: 'basse',
        questions: QUESTIONS_CLARIFICATION,
      })
  }

  if (segment.urgence === 'basse' && score < 50) {
    recos.push({
      titre: 'Pas pret a l\'achat immediat',
      action:
        "Privilegier une relance nourrie de contenu (etude de cas, article) plutot qu'une offre commerciale directe.",
      priorite: 'basse',
    })
  }

  if (score >= 70) {
    recos.push({
      titre: 'Lead chaud - a prioriser',
      action: 'Ce prospect doit passer devant les autres dans la file de suivi commercial.',
      priorite: 'haute',
    })
  }

  return recos
}

// ---------------------------------------------------------------------
// 5. CONTENU MARKETING SUGGERE (pont commercial <-> marketing digital)
// ---------------------------------------------------------------------

const CONTENUS_MARKETING: Record<Categorie, ContenuMarketing> = {
  financier: {
    titre: 'Etude de cas : optimisation budgetaire',
    accroche_linkedin:
      "Comment un accompagnement structure peut reduire vos couts sans sacrifier la qualite.",
    format_suggere: 'Post LinkedIn + étude de cas chiffrée',
  },
  humain: {
    titre: 'Cas client : cohesion et performance d\'equipe',
    accroche_linkedin: 'Ce qui fait vraiment la difference dans la gestion d\'une equipe en tension.',
    format_suggere: 'Témoignage vidéo ou post LinkedIn',
  },
  strategique: {
    titre: 'Guide : structurer sa croissance',
    accroche_linkedin: 'Les 3 erreurs strategiques qui freinent la croissance des PME.',
    format_suggere: 'Article de blog + carrousel LinkedIn',
  },
  organisationnel: {
    titre: 'Checklist : gagner du temps sur vos projets',
    accroche_linkedin: 'Et si votre plus gros probleme de delai venait de votre organisation ?',
    format_suggere: 'Checklist téléchargeable + post LinkedIn',
  },
  juridique: {
    titre: 'Point de vigilance conformite',
    accroche_linkedin: 'Un point de conformite mal gere peut couter cher : ce qu\'il faut verifier.',
    format_suggere: 'Article court + infographie',
  },
  technique: {
    titre: 'Demo : gagner du temps avec les bons outils',
    accroche_linkedin: 'La difference entre un outil et le bon outil, en 2 minutes.',
    format_suggere: 'Video demo courte',
  },
  general: {
    titre: 'Contenu de decouverte generaliste',
    accroche_linkedin: 'Un accompagnement sur-mesure commence toujours par les bonnes questions.',
    format_suggere: 'Post LinkedIn generique',
  },
}

export function suggererContenuMarketing(categorie: Categorie): ContenuMarketing {
  return CONTENUS_MARKETING[categorie]
}

// ---------------------------------------------------------------------
// 6. FONCTION GROUPEE (pratique pour un seul appel depuis les routes API)
// ---------------------------------------------------------------------

export function analyserProspect(params: {
  phraseProspect: string
  posteOuBudget?: string | null
  nbRelancesDejaEnvoyees?: number
}) {
  const segment = calculerSegment(params.phraseProspect, params.posteOuBudget)
  const score = calculerScoreChaleur({
    phraseProspect: params.phraseProspect,
    segment,
    nbRelancesDejaEnvoyees: params.nbRelancesDejaEnvoyees,
  })
  const recommandations = genererRecommandations(segment, score)
  const contenuMarketing = suggererContenuMarketing(segment.categorie)

  return { segment, score, recommandations, contenuMarketing }
}
