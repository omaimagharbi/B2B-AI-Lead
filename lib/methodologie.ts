export type ModeCiblage = 'entreprise' | 'particulier'

const FORMAT_JSON_ATTENDU = `Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, au format exact suivant :

{
  "titre": "Titre court et percutant du diagnostic",
  "synthese": "2-3 phrases resumant la situation et l'enjeu principal",
  "methodologie": "ADDIE ou GROW selon le cas",
  "etapes": [
    { "nom": "Nom de l'etape", "description": "1-2 phrases expliquant cette etape" }
  ],
  "packs_proposes": [
    { "nom": "Nom du pack/offre", "prix_indicatif": 0, "description": "1 phrase expliquant ce que contient ce pack" }
  ]
}

Genere exactement les etapes de la methodologie demandee (ni plus, ni moins), et 2 a 3 packs proposes
avec des prix indicatifs realistes en Dinars Tunisiens (TND) ou Euros selon le contexte. Ces prix et
packs seront relus et ajustes par un expert humain avant envoi, donne juste une base de depart credible.`

const PROMPT_ADDIE = `Tu es un consultant senior specialise dans l'accompagnement des entreprises.
Un decideur (DRH, dirigeant, CTO...) decrit en une phrase le probleme actuel de son entreprise ou de ses equipes.
Tu dois analyser ce besoin en utilisant STRICTEMENT la methodologie ADDIE (Analyse, Design, Developpement,
Implementation, Evaluation) : les 5 etapes de ta reponse doivent correspondre exactement a ces 5 phases,
dans cet ordre, adaptees au contexte specifique decrit par le prospect.

${FORMAT_JSON_ATTENDU}`

const PROMPT_GROW = `Tu es un coach professionnel senior specialise dans l'accompagnement individuel.
Une personne decrit en une phrase le blocage ou l'objectif personnel/professionnel qu'elle rencontre actuellement.
Tu dois analyser ce besoin en utilisant STRICTEMENT le modele GROW (Goal, Reality, Options, Will) : les 4 etapes
de ta reponse doivent correspondre exactement a ces 4 phases, dans cet ordre, adaptees au contexte specifique
decrit par la personne.

${FORMAT_JSON_ATTENDU}`

export function construirePrompt(modeCiblage: ModeCiblage, promptVerticalPersonnalise?: string): string {
  const base = modeCiblage === 'particulier' ? PROMPT_GROW : PROMPT_ADDIE

  if (!promptVerticalPersonnalise) return base

  // On enrichit le prompt de methodologie avec le contexte metier propre au vertical
  // (ex: audit technique pour Startup SaaS, organisationnel pour PME...)
  return `${promptVerticalPersonnalise}\n\nUtilise neanmoins STRICTEMENT la structure de reponse suivante :\n\n${base}`
}
