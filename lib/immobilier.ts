// Diagnostic IMMOBILIER (Qatar) : questionnaire prospect, scoring par budget/visa, analyse, plan d'acquisition
// en 5 etapes. Remplace la logique "formation" (ADDIE) pour la verticale 'immobilier'.
import type { OffreCatalogue } from '@/lib/methodologie'

export type LangueAffichage = 'fr' | 'en' | 'ar'
export type LangueContenu = 'fr' | 'en' // contenu genere (IA + regles) : l'arabe retombe sur l'anglais

export const SEUIL_VISA_RESIDENCE = 730_000 // QAR - seuil INDICATIF (permis de residence)
export const SEUIL_VISA_PERMANENT = 3_650_000 // QAR - seuil INDICATIF (residence permanente)

type Option = { code: string; fr: string; en: string; ar: string }

export const OBJECTIFS_IMMO: Option[] = [
  { code: 'achat_residence', fr: 'Achat résidence principale', en: 'Primary residence purchase', ar: 'شراء مسكن رئيسي' },
  { code: 'investissement_locatif', fr: 'Investissement locatif (Rendement)', en: 'Rental investment (Yield)', ar: 'استثمار عقاري للإيجار (العائد)' },
  { code: 'relocalisation_entreprise', fr: "Relocalisation d'entreprise (Corporate)", en: 'Corporate relocation', ar: 'نقل شركة (مؤسسي)' },
  { code: 'vente_bien', fr: "Vente d'un bien existant", en: 'Sale of an existing property', ar: 'بيع عقار قائم' },
]

export const ZONES_IMMO: Option[] = [
  { code: 'the_pearl', fr: 'The Pearl', en: 'The Pearl', ar: 'اللؤلؤة' },
  { code: 'lusail', fr: 'Lusail', en: 'Lusail', ar: 'لوسيل' },
  { code: 'west_bay_lagoon', fr: 'West Bay Lagoon', en: 'West Bay Lagoon', ar: 'ويست باي لاجون' },
  { code: 'al_dafna', fr: 'Al Dafna', en: 'Al Dafna', ar: 'الدفنة' },
  { code: 'autre', fr: 'Autre', en: 'Other', ar: 'أخرى' },
]

export const TYPES_BIEN_IMMO: Option[] = [
  { code: 'appartement', fr: 'Appartement', en: 'Apartment', ar: 'شقة' },
  { code: 'villa_luxe', fr: 'Villa de luxe', en: 'Luxury villa', ar: 'فيلا فاخرة' },
  { code: 'bureaux_commercial', fr: 'Bureaux / Commercial', en: 'Offices / Commercial', ar: 'مكاتب / تجاري' },
]

export function libelleOption(liste: Option[], code: string, langue: LangueAffichage): string {
  const o = liste.find((x) => x.code === code)
  return o ? o[langue] : code
}

export type ReponsesImmo = {
  objectif: string
  zone: string
  type_bien: string
  budget_qar: number
}

export type NiveauVisa = 'permanent' | 'residence' | 'aucun'

export function niveauVisa(budget: number): NiveauVisa {
  if (budget >= SEUIL_VISA_PERMANENT) return 'permanent'
  if (budget >= SEUIL_VISA_RESIDENCE) return 'residence'
  return 'aucun'
}

export function reponsesValides(r: unknown): r is ReponsesImmo {
  const x = r as ReponsesImmo | null
  return (
    !!x &&
    OBJECTIFS_IMMO.some((o) => o.code === x.objectif) &&
    ZONES_IMMO.some((z) => z.code === x.zone) &&
    TYPES_BIEN_IMMO.some((t) => t.code === x.type_bien) &&
    typeof x.budget_qar === 'number' &&
    Number.isFinite(x.budget_qar) &&
    x.budget_qar > 0
  )
}

const fmt = (n: number, l: LangueContenu) => n.toLocaleString(l === 'fr' ? 'fr-FR' : 'en-US')

// ---------------------------------------------------------------------------
// Texte du questionnaire prospect -> champ "probleme" (lisible par l'IA et par le cabinet)
export function texteReponses(r: ReponsesImmo, l: LangueContenu): string {
  const lib = (liste: Option[], c: string) => libelleOption(liste, c, l)
  return l === 'fr'
    ? [
        `Objectif principal : ${lib(OBJECTIFS_IMMO, r.objectif)}`,
        `Zone ciblée : ${lib(ZONES_IMMO, r.zone)}`,
        `Type de bien : ${lib(TYPES_BIEN_IMMO, r.type_bien)}`,
        `Budget global : ${fmt(r.budget_qar, l)} QAR`,
      ].join('\n')
    : [
        `Main objective: ${lib(OBJECTIFS_IMMO, r.objectif)}`,
        `Target area: ${lib(ZONES_IMMO, r.zone)}`,
        `Property type: ${lib(TYPES_BIEN_IMMO, r.type_bien)}`,
        `Overall budget: ${fmt(r.budget_qar, l)} QAR`,
      ].join('\n')
}

// ---------------------------------------------------------------------------
// Les 5 etapes du cycle immobilier au Qatar (remplace ADDIE)
const ETAPES_NOMS: Record<LangueContenu, string[]> = {
  fr: [
    'Analyse foncière & légale',
    'Sélection & visite virtuelle',
    "Structuration de l'offre",
    'Contractualisation numérique',
    'Clôture & démarche résidence',
  ],
  en: [
    'Land & Legal Analysis',
    'Selection & Virtual Tour',
    'Offer Structuring',
    'Digital Contracting',
    'Closing & Residency Process',
  ],
}

export const METHODOLOGIE_IMMO: Record<LangueContenu, string> = {
  fr: 'Cycle immobilier Qatar (5 étapes)',
  en: 'Qatar real estate cycle (5 steps)',
}

function descriptionsEtapes(r: ReponsesImmo, l: LangueContenu): string[] {
  const zone = libelleOption(ZONES_IMMO, r.zone, l)
  const bien = libelleOption(TYPES_BIEN_IMMO, r.type_bien, l).toLowerCase()
  const budget = `${fmt(r.budget_qar, l)} QAR`
  const visa = niveauVisa(r.budget_qar)
  const vente = r.objectif === 'vente_bien'
  const horsPlan = r.objectif === 'investissement_locatif'
  if (l === 'fr') {
    return [
      vente
        ? `Vérification du titre de propriété et de la conformité légale du bien (${bien}, ${zone}) avant sa mise sur le marché.`
        : `Vérification que la zone ${zone} est en Freehold et que le budget de ${budget} est conforme à la réglementation sur la propriété des non-Qataris.`,
      vente
        ? `Préparation du bien (estimation, visite virtuelle 3D Matterport) et sélection d'acquéreurs qualifiés.`
        : `Envoi d'une sélection de ${bien} à ${zone} et planification de la visite virtuelle 3D (Matterport).`,
      horsPlan
        ? `Rédaction de la proposition et validation du plan de paiement, en comparant bien livré et off-plan avec le rendement attendu.`
        : `Rédaction de la proposition d'achat et validation du plan de paiement, y compris si le bien est en off-plan.`,
      `Signature électronique du contrat et préparation de l'enregistrement du titre (SAK).`,
      vente || visa === 'aucun'
        ? `Finalisation de la transaction et suivi après-vente.`
        : `Finalisation de la transaction et dépôt du dossier de visa / résidence${visa === 'permanent' ? ' (seuil de résidence permanente atteint, indicatif)' : ' (seuil de permis de résidence atteint, indicatif)'}.`,
    ]
  }
  return [
    vente
      ? `Check the title deed and the legal compliance of the property (${bien}, ${zone}) before it goes to market.`
      : `Verify that ${zone} is a Freehold zone and that the ${budget} budget complies with the rules on property ownership by non-Qataris.`,
    vente
      ? `Prepare the property (valuation, 3D Matterport virtual tour) and select qualified buyers.`
      : `Send a selection of ${bien} listings in ${zone} and schedule the 3D virtual tour (Matterport).`,
    horsPlan
      ? `Draft the proposal and validate the payment plan, comparing ready vs. off-plan properties against the expected yield.`
      : `Draft the purchase proposal and validate the payment plan, especially if the property is off-plan.`,
    `E-sign the contract and prepare the title registration (SAK).`,
    vente || visa === 'aucun'
      ? `Finalize the transaction and follow up after the sale.`
      : `Finalize the transaction and file the visa / residency application${visa === 'permanent' ? ' (permanent-residency threshold reached, indicative)' : ' (residency-permit threshold reached, indicative)'}.`,
  ]
}

// ---------------------------------------------------------------------------
// Analyse (moteur de regles) : score, segment, besoin sous-jacent, strategie commerciale, contenu marketing
export type AnalyseImmo = {
  segment: { categorie: string; urgence: 'haute' | 'moyenne' | 'basse'; budget_mentionne: boolean }
  score: number
  recommandations: { titre: string; action: string; priorite: 'haute' | 'moyenne' | 'basse'; questions?: string[] }[]
  contenuMarketing: { titre: string; accroche_linkedin: string; format_suggere: string }
  explicationScore: string
  besoinSousJacent: string
  immobilier: ReponsesImmo & { visa: NiveauVisa }
}

export function analyserProspectImmobilier(r: ReponsesImmo, l: LangueContenu): AnalyseImmo {
  const visa = niveauVisa(r.budget_qar)
  const achat = r.objectif !== 'vente_bien'
  const zone = libelleOption(ZONES_IMMO, r.zone, l)
  const bien = libelleOption(TYPES_BIEN_IMMO, r.type_bien, l).toLowerCase()
  const budget = `${fmt(r.budget_qar, l)} QAR`

  // --- score : budget (seuils visa) + objectif + zone precise
  let score = visa === 'permanent' ? 70 : visa === 'residence' ? 50 : 20
  score += { achat_residence: 10, investissement_locatif: 10, relocalisation_entreprise: 15, vente_bien: 5 }[r.objectif] ?? 0
  if (r.zone !== 'autre') score += 5
  score = Math.min(100, score)

  const urgence: 'haute' | 'moyenne' | 'basse' =
    achat && visa !== 'aucun' ? 'haute' : visa !== 'aucun' || !achat ? 'moyenne' : 'basse'

  // --- phrase visa
  const phraseVisa =
    l === 'fr'
      ? !achat
        ? ''
        : visa === 'permanent'
          ? ` Besoin de visa détecté : le budget (${budget}) atteint le seuil indicatif de résidence permanente (${fmt(SEUIL_VISA_PERMANENT, l)} QAR).`
          : visa === 'residence'
            ? ` Besoin de visa détecté : le budget (${budget}) atteint le seuil indicatif de permis de résidence (${fmt(SEUIL_VISA_RESIDENCE, l)} QAR).`
            : ` Le budget (${budget}) est sous les seuils indicatifs de visa (${fmt(SEUIL_VISA_RESIDENCE, l)} / ${fmt(SEUIL_VISA_PERMANENT, l)} QAR).`
      : !achat
        ? ''
        : visa === 'permanent'
          ? ` Visa need detected: the budget (${budget}) reaches the indicative permanent-residency threshold (QAR ${fmt(SEUIL_VISA_PERMANENT, l)}).`
          : visa === 'residence'
            ? ` Visa need detected: the budget (${budget}) reaches the indicative residency-permit threshold (QAR ${fmt(SEUIL_VISA_RESIDENCE, l)}).`
            : ` The budget (${budget}) is below the indicative visa thresholds (QAR ${fmt(SEUIL_VISA_RESIDENCE, l)} / ${fmt(SEUIL_VISA_PERMANENT, l)}).`

  const intention: Record<string, { fr: string; en: string }> = {
    achat_residence: {
      fr: `Intention d'achat claire : résidence principale (${bien}) à ${zone}.`,
      en: `Clear purchase intent: primary residence (${bien}) in ${zone}.`,
    },
    investissement_locatif: {
      fr: `Recherche de rendement locatif : ${bien} à ${zone} (budget ${budget}) — prioriser rendement net, taux d'occupation et plans de paiement.`,
      en: `Rental-yield search: ${bien} in ${zone} (budget ${budget}) — prioritise net yield, occupancy and payment plans.`,
    },
    relocalisation_entreprise: {
      fr: `Besoin de relocalisation d'entreprise : ${bien} à ${zone} (budget ${budget}).`,
      en: `Corporate relocation need: ${bien} in ${zone} (budget ${budget}).`,
    },
    vente_bien: {
      fr: `Vendeur : souhaite vendre un ${bien} existant à ${zone} (référence de valeur ${budget}) — prioriser avis de valeur et acquéreurs qualifiés.`,
      en: `Seller lead: wants to sell an existing ${bien} in ${zone} (value reference ${budget}) — prioritise a pricing opinion and qualified buyers.`,
    },
  }
  const besoinSousJacent = `🎯 ${intention[r.objectif]?.[l] ?? ''}${phraseVisa}`.trim()

  // --- strategie commerciale
  const reco: AnalyseImmo['recommandations'] = []
  if (achat && visa !== 'aucun') {
    reco.push(
      l === 'fr'
        ? {
            titre: 'Qualifier l’éligibilité au visa',
            action: `Le budget atteint un seuil indicatif de visa : confirmez l’intérêt du prospect pour un permis de résidence avant de présenter les biens.`,
            priorite: 'haute',
            questions: [
              'Souhaitez-vous obtenir un permis de résidence grâce à cet achat ?',
              'Quels documents (passeport, justificatifs de fonds) pouvez-vous fournir rapidement ?',
            ],
          }
        : {
            titre: 'Qualify visa eligibility',
            action: `The budget reaches an indicative visa threshold: confirm the prospect's interest in a residency permit before presenting properties.`,
            priorite: 'haute',
            questions: [
              'Do you want to obtain a residency permit through this purchase?',
              'Which documents (passport, proof of funds) can you provide quickly?',
            ],
          }
    )
  }
  reco.push(
    l === 'fr'
      ? {
          titre: achat ? 'Envoyer une sélection + visite 3D' : 'Proposer un avis de valeur + shooting 3D',
          action: achat
            ? `Envoyez 3 à 5 ${bien} correspondant à ${zone} issus de votre catalogue et proposez un créneau de visite virtuelle 3D (Matterport) sous 48 h.`
            : `Proposez un avis de valeur gratuit et la réalisation d'une visite virtuelle 3D du bien pour accélérer la mise en vente.`,
          priorite: 'haute',
        }
      : {
          titre: achat ? 'Send a shortlist + 3D tour' : 'Offer a valuation + 3D tour shoot',
          action: achat
            ? `Send 3–5 matching ${bien} listings in ${zone} from your catalogue and propose a 3D virtual tour slot (Matterport) within 48h.`
            : `Offer a free pricing opinion and a 3D virtual tour of the property to speed up the listing.`,
          priorite: 'haute',
        }
  )
  if (r.objectif === 'investissement_locatif' || r.objectif === 'relocalisation_entreprise') {
    reco.push(
      l === 'fr'
        ? {
            titre: 'Préparer le comparatif des plans de paiement',
            action: `Comparez bien livré et off-plan (échéancier, rendement attendu) pour structurer l'offre.`,
            priorite: 'moyenne',
          }
        : {
            titre: 'Prepare the payment-plan comparison',
            action: `Compare ready and off-plan properties (schedule, expected yield) to structure the offer.`,
            priorite: 'moyenne',
          }
    )
  }

  const contenuMarketing =
    l === 'fr'
      ? {
          titre: `Acheter en Freehold à ${zone} : ce que les acheteurs étrangers doivent savoir`,
          accroche_linkedin: `Zones Freehold, seuils indicatifs de résidence, visite 3D à distance : le parcours d'achat au Qatar expliqué en 5 étapes.`,
          format_suggere: 'Carrousel LinkedIn ou courte vidéo (visite 3D)',
        }
      : {
          titre: `Buying Freehold in ${zone}: what foreign buyers need to know`,
          accroche_linkedin: `Freehold zones, indicative residency thresholds, remote 3D tours: the Qatar buying journey explained in 5 steps.`,
          format_suggere: 'LinkedIn carousel or short video (3D tour)',
        }

  const statutVisa =
    l === 'fr'
      ? visa === 'permanent' ? 'seuil résidence permanente atteint' : visa === 'residence' ? 'seuil permis de résidence atteint' : 'sous les seuils de visa'
      : visa === 'permanent' ? 'permanent-residency threshold reached' : visa === 'residence' ? 'residency-permit threshold reached' : 'below visa thresholds'
  const explicationScore =
    l === 'fr'
      ? `Score basé sur : budget ${budget} (${statutVisa}) + objectif renseigné${r.zone !== 'autre' ? ' + zone précise' : ''}`
      : `Score based on: budget ${budget} (${statutVisa}) + stated objective${r.zone !== 'autre' ? ' + specific zone' : ''}`

  return {
    segment: { categorie: r.objectif, urgence, budget_mentionne: true },
    score,
    recommandations: reco,
    contenuMarketing,
    explicationScore,
    besoinSousJacent,
    immobilier: { ...r, visa },
  }
}

// ---------------------------------------------------------------------------
// Brouillon (plan d'acquisition) : prompt IA, brouillon simule, normalisation
export function construirePromptImmobilier(
  promptVertical: string | undefined,
  catalogue: OffreCatalogue[],
  l: LangueContenu
): string {
  const noms = ETAPES_NOMS[l].map((n, i) => `${i + 1}. ${n}`).join('\n')
  const langueTxt = l === 'fr' ? 'français' : 'anglais'
  const liste = catalogue
    .map(
      (o) =>
        `- ${o.nom}${o.prix ? ` (${o.prix} ${o.devise ?? 'QAR'})` : ''}${o.duree ? ` — ${o.duree}` : ''}${o.description ? ` : ${o.description}` : ''}`
    )
    .join('\n')
  return `${promptVertical ?? 'Tu es consultant senior en transactions immobilieres au Qatar.'}

Contexte : marché immobilier du Qatar (zones Freehold, résidence par l'investissement immobilier — seuils INDICATIFS de 730 000 QAR et 3 650 000 QAR, visites virtuelles 3D Matterport, enregistrement du titre via SAK). Ne donne aucune garantie juridique : reste factuel et indicatif.

Le prospect a répondu à un questionnaire (objectif, zone, type de bien, budget en QAR). Construis un plan d'acquisition en EXACTEMENT 5 étapes, dans cet ordre et avec ces noms :
${noms}

Chaque description (1-2 phrases) doit reprendre les détails précis du prospect (zone, type de bien, budget, objectif) et nommer concrètement ce qui sera fait.

${
    catalogue.length > 0
      ? `Pour "packs_proposes", choisis 2 à 3 FICHES DE PROPRIÉTÉS PARMI CELLES-CI (le vrai catalogue de l'agence), avec nom et prix exacts. N'invente aucun bien :\n${liste}`
      : `Le catalogue de l'agence est vide : renvoie "packs_proposes" comme un tableau vide []. N'invente aucun bien.`
  }

Réponds en ${langueTxt}, UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown, au format :
{
  "titre": "Titre court et percutant",
  "synthese": "2-3 phrases résumant le projet et l'enjeu principal",
  "methodologie": "${METHODOLOGIE_IMMO[l]}",
  "etapes": [ { "nom": "…", "description": "…" } ],
  "packs_proposes": [ { "nom": "…", "prix_indicatif": 0, "description": "…" } ]
}`
}

type BrouillonBrut = {
  titre?: string
  synthese?: string
  etapes?: { nom?: string; description?: string }[]
  packs_proposes?: { nom?: string; prix_indicatif?: number; description?: string }[]
  [k: string]: unknown
}

export function normaliserBrouillonImmobilier(
  brut: BrouillonBrut | null | undefined,
  r: ReponsesImmo,
  catalogue: OffreCatalogue[],
  l: LangueContenu,
  simule: boolean
) {
  const defauts = descriptionsEtapes(r, l)
  const zone = libelleOption(ZONES_IMMO, r.zone, l)
  const bien = libelleOption(TYPES_BIEN_IMMO, r.type_bien, l).toLowerCase()
  const etapes = ETAPES_NOMS[l].map((nom, i) => {
    const d = brut?.etapes?.[i]?.description
    return { nom, description: d && d.trim().length > 15 ? d.trim() : defauts[i] }
  })

  // Packs = vraies fiches du catalogue de l'agence (jamais des packs "formation" generiques)
  const parNom = new Map(catalogue.map((o) => [o.nom.trim().toLowerCase(), o]))
  let packs: { nom: string; prix_indicatif: number; description: string }[] = []
  for (const p of brut?.packs_proposes ?? []) {
    const o = p?.nom ? parNom.get(p.nom.trim().toLowerCase()) : undefined
    if (o) packs.push({ nom: o.nom, prix_indicatif: o.prix ?? p.prix_indicatif ?? 0, description: o.description ?? p.description ?? '' })
  }
  if (packs.length === 0) {
    packs = catalogue.slice(0, 3).map((o) => ({ nom: o.nom, prix_indicatif: o.prix ?? 0, description: o.description ?? '' }))
  }

  return {
    titre:
      brut?.titre?.trim() ||
      (l === 'fr' ? `Projet immobilier à ${zone} — plan d'acquisition personnalisé` : `${zone} real estate project — personalised acquisition plan`),
    synthese:
      brut?.synthese?.trim() ||
      (l === 'fr'
        ? `Projet : ${libelleOption(OBJECTIFS_IMMO, r.objectif, l).toLowerCase()} — ${bien} à ${zone}, budget ${fmt(r.budget_qar, l)} QAR.`
        : `Project: ${libelleOption(OBJECTIFS_IMMO, r.objectif, l).toLowerCase()} — ${bien} in ${zone}, budget QAR ${fmt(r.budget_qar, l)}.`),
    methodologie: METHODOLOGIE_IMMO[l],
    etapes,
    packs_proposes: packs,
    ...(simule ? { _simule: true } : {}),
  }
}
