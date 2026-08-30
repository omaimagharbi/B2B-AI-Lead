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

const EXIGENCE_QUALITE = `EXIGENCE DE QUALITE (tres important) : le contenu doit etre concret, specifique et percutant - jamais generique. Interdiction absolue de phrases creuses type "identifier precisement les causes du probleme" ou "mesurer l'impact et ajuster si necessaire" sans lien direct avec le cas reel. Chaque etape doit :
- reprendre des mots/details precis de la description du prospect (pas juste la paraphraser en langage vague),
- nommer concretement ce qui sera fait (canaux, outils, livrables, chiffres si pertinent),
- laisser sentir au lecteur qu'on a compris SON probleme specifique et qu'on sait exactement comment le resoudre, pas un probleme generique de son secteur.
Le titre et la synthese doivent donner envie de lire la suite, pas sonner comme un rapport administratif.`

const PROMPT_ADDIE = `Tu es un consultant senior specialise dans l'accompagnement des entreprises.
Un decideur (DRH, dirigeant, CTO...) decrit en une phrase le probleme actuel de son entreprise ou de ses equipes.
Tu dois analyser ce besoin en utilisant STRICTEMENT la methodologie ADDIE (Analyse, Design, Developpement,
Implementation, Evaluation) : les 5 etapes de ta reponse doivent correspondre exactement a ces 5 phases,
dans cet ordre, adaptees au contexte specifique decrit par le prospect.

${EXIGENCE_QUALITE}

${FORMAT_JSON_ATTENDU}`

const PROMPT_GROW = `Tu es un coach professionnel senior specialise dans l'accompagnement individuel.
Une personne decrit en une phrase le blocage ou l'objectif personnel/professionnel qu'elle rencontre actuellement.
Tu dois analyser ce besoin en utilisant STRICTEMENT le modele GROW (Goal, Reality, Options, Will) : les 4 etapes
de ta reponse doivent correspondre exactement a ces 4 phases, dans cet ordre, adaptees au contexte specifique
decrit par la personne.

${EXIGENCE_QUALITE}

${FORMAT_JSON_ATTENDU}`

export type OffreCatalogue = {
  nom: string
  description: string | null
  prix: number | null
  devise: string | null
  duree: string | null
}

export function construirePrompt(
  modeCiblage: ModeCiblage,
  promptVerticalPersonnalise?: string,
  catalogueOffres?: OffreCatalogue[]
): string {
  const base = modeCiblage === 'particulier' ? PROMPT_GROW : PROMPT_ADDIE

  let promptFinal = base

  if (promptVerticalPersonnalise) {
    // On enrichit le prompt de methodologie avec le contexte metier propre au vertical
    // (ex: audit technique pour Startup SaaS, organisationnel pour PME...)
    promptFinal = `${promptVerticalPersonnalise}\n\nUtilise neanmoins STRICTEMENT la structure de reponse suivante :\n\n${base}`
  }

  if (catalogueOffres && catalogueOffres.length > 0) {
    const listeOffres = catalogueOffres
      .map(
        (o) =>
          `- ${o.nom}${o.prix ? ` (${o.prix} ${o.devise ?? 'TND'})` : ''}${o.duree ? ` — ${o.duree}` : ''}${
            o.description ? ` : ${o.description}` : ''
          }`
      )
      .join('\n')

    promptFinal += `\n\nIMPORTANT : pour le champ "packs_proposes", tu DOIS choisir 2 a 3 offres PARMI CELLES-CI (les vraies offres de ce cabinet), en gardant leur nom et prix exacts. N'invente pas d'autre offre tant que celles-ci existent :\n${listeOffres}`
  }

  return promptFinal
}
