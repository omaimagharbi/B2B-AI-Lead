// =====================================================================
// SPRINT 3 - Vocabulaire dynamique par secteur (point 15 de la roadmap).
//
// Objectif : sortir le texte specifique a un metier (Formation vs
// Comptable vs Service) du code de l'interface, pour qu'ajouter un
// nouveau secteur plus tard = ajouter une entree ici, pas modifier
// app/dashboard/page.tsx.
//
// Meme pattern que lib/templates.ts et lib/professions.ts (deja dans le
// projet) : un dictionnaire cote code, indexe par le slug de la verticale.
// Le comportement pour 'cabinet-formation' reste identique a avant
// (memes textes), donc aucun changement visible pour ce secteur.
//
// Pour ajouter un secteur plus tard (ex: cabinet-comptable) : ajouter une
// entree ici avec les bons textes, rien d'autre a toucher dans le code
// de l'interface tant que ce vocabulaire suffit.
// =====================================================================

export type VocabulaireVertical = {
  // Onglet et section catalogue
  labelCatalogue: string // ex: "Catalogue", "Prestations"
  introCatalogue: string // texte d'intro de l'onglet Catalogue
  placeholderNomOffre: string // placeholder du champ "nom de l'offre"

  // Utilise dans les rapports/communications quand on parle de ce que le
  // cabinet vend
  labelOffreSingulier: string // "formation", "mission", "prestation"
  labelOffrePluriel: string // "formations", "missions", "prestations"

  // Utilise pour designer le decideur qu'on cible (texte generique, en
  // plus des exemples deja geres par lib/professions.ts)
  labelDecideur: string // "DRH", "décideur", "client potentiel"
}

const VOCABULAIRE_PAR_DEFAUT: VocabulaireVertical = {
  labelCatalogue: 'Catalogue',
  introCatalogue:
    "Tes vraies formations/services. Tant que le catalogue est vide, l'IA continue de " +
    'proposer des packs génériques dans les diagnostics. Dès qu\'il y a des offres ici, ' +
    'elle pioche dedans en priorité.',
  placeholderNomOffre: 'Nom de la formation/service',
  labelOffreSingulier: 'formation',
  labelOffrePluriel: 'formations',
  labelDecideur: 'décideur',
}

export const VOCABULAIRE_PAR_VERTICAL: Record<string, VocabulaireVertical> = {
  'cabinet-formation': VOCABULAIRE_PAR_DEFAUT,
  'startup-saas': {
    labelCatalogue: 'Offres',
    introCatalogue:
      "Tes vraies offres/services techniques. Tant que le catalogue est vide, l'IA continue " +
      "de proposer des packs génériques dans les diagnostics. Dès qu'il y a des offres ici, " +
      'elle pioche dedans en priorité.',
    placeholderNomOffre: "Nom de l'offre/du service",
    labelOffreSingulier: 'offre',
    labelOffrePluriel: 'offres',
    labelDecideur: 'décideur technique',
  },
  'pme-services': {
    labelCatalogue: 'Prestations',
    introCatalogue:
      "Tes vraies prestations. Tant que le catalogue est vide, l'IA continue de proposer " +
      "des packs génériques dans les diagnostics. Dès qu'il y a des offres ici, elle pioche " +
      'dedans en priorité.',
    placeholderNomOffre: 'Nom de la prestation',
    labelOffreSingulier: 'prestation',
    labelOffrePluriel: 'prestations',
    labelDecideur: 'dirigeant',
  },
  'investisseur-incubateur': {
    labelCatalogue: "Critères d'investissement",
    introCatalogue:
      "Ta thèse d'investissement : ticket moyen, secteurs recherchés, maturité des projets " +
      "visés. Utilise ce catalogue comme une liste de critères plutôt que d'offres à vendre — " +
      "chaque ligne peut représenter un secteur ou un type de deal que tu recherches.",
    placeholderNomOffre: 'Ex: SaaS B2B en amorçage',
    labelOffreSingulier: "critère d'investissement",
    labelOffrePluriel: "critères d'investissement",
    labelDecideur: 'fondateur',
  },
}

export function vocabulairePourVertical(verticalSlug: string | null | undefined): VocabulaireVertical {
  if (!verticalSlug) return VOCABULAIRE_PAR_DEFAUT
  return VOCABULAIRE_PAR_VERTICAL[verticalSlug] ?? VOCABULAIRE_PAR_DEFAUT
}

// Etapes du pipeline (Kanban), adaptees au vocabulaire metier de chaque
// secteur. Les valeurs 'etape' restent identiques partout (colonnes reelles
// en base sur targets.etape_pipeline) : seul le libelle affiche change.
export type EtapePipeline = { etape: string; label: string }

const ETAPES_PAR_DEFAUT: EtapePipeline[] = [
  { etape: 'contacte', label: '📨 Contacté' },
  { etape: 'qualifie', label: '✅ Qualifié' },
  { etape: 'proposition', label: '📄 Proposition envoyée' },
  { etape: 'negociation', label: '🤝 Négociation' },
  { etape: 'gagne', label: '🏆 Gagné' },
  { etape: 'perdu', label: '❌ Perdu' },
]

const ETAPES_PAR_VERTICAL: Record<string, EtapePipeline[]> = {
  'investisseur-incubateur': [
    { etape: 'contacte', label: '📨 Approche envoyée' },
    { etape: 'qualifie', label: '🔁 Relance note de financement' },
    { etape: 'proposition', label: '🏛️ Comité d\'investissement engagé' },
    { etape: 'negociation', label: '🤝 Négociation des termes' },
    { etape: 'gagne', label: '💰 Contrat signé (Closing)' },
    { etape: 'perdu', label: '❌ Perdu' },
  ],
}

export function etapesPipelinePourVertical(verticalSlug: string | null | undefined): EtapePipeline[] {
  if (!verticalSlug) return ETAPES_PAR_DEFAUT
  return ETAPES_PAR_VERTICAL[verticalSlug] ?? ETAPES_PAR_DEFAUT
}
