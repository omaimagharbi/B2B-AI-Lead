import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'

const FORMAT_JSON_ATTENDU = `Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, au format exact suivant :

{
  "titre": "Titre court et percutant du diagnostic",
  "synthese": "2-3 phrases resumant le probleme identifie et l'enjeu business associe",
  "modules": [
    { "nom": "Nom du module/axe recommande", "priorite": "haute|moyenne", "description": "1 phrase expliquant l'objectif" }
  ],
  "certification_recommandee": "Nom d'une certification ou reference pertinente",
  "duree_estimee": "Ex: 5 jours / 35 heures"
}

Genere entre 3 et 4 modules maximum, ordonnes par priorite decroissante.`

// Prompt par defaut (vertical Cabinet de Formation & Conseil)
const PROMPT_PAR_DEFAUT = `Tu es un consultant senior en formation professionnelle et developpement des competences.
Un decideur (DRH ou Directeur) decrit en une phrase le probleme actuel de ses equipes.
Tu dois generer un diagnostic pedagogique structure, credible et actionnable.

${FORMAT_JSON_ATTENDU}`

function genererDiagnosticSimule(probleme: string) {
  return {
    titre: 'Diagnostic préliminaire de vos besoins en formation',
    synthese: `D'après votre description ("${probleme.slice(0, 80)}${
      probleme.length > 80 ? '...' : ''
    }"), votre équipe fait face à un enjeu de performance qui peut être adressé par un accompagnement ciblé.`,
    modules: [
      {
        nom: 'Diagnostic approfondi des compétences',
        priorite: 'haute',
        description: "Identifier precisement les ecarts de competences au sein de l'equipe.",
      },
      {
        nom: 'Plan de developpement personnalise',
        priorite: 'haute',
        description: 'Construire un parcours de formation adapte aux objectifs business.',
      },
      {
        nom: 'Suivi et mesure des resultats',
        priorite: 'moyenne',
        description: "Mettre en place des indicateurs de suivi de la progression de l'equipe.",
      },
    ],
    certification_recommandee: "À définir lors de l'entretien de cadrage",
    duree_estimee: 'À définir selon les besoins',
    _simule: true, // indicateur interne : rapport d'exemple, pas une vraie generation IA
  }
}

async function genererDiagnostic(probleme: string, systemPrompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return genererDiagnosticSimule(probleme)
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: probleme }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    const cleanText = rawText.replace(/```json|```/g, '').trim()
    return JSON.parse(cleanText)
  } catch (err) {
    // Cle invalide, credit insuffisant, erreur reseau, JSON malforme...
    // On ne bloque jamais le prospect : on bascule sur un rapport simule
    console.error('Anthropic indisponible, bascule en mode simule:', err)
    return genererDiagnosticSimule(probleme)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, probleme } = await req.json()

    if (!token || !probleme || probleme.trim().length < 10) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    // 1. On verifie que le token correspond a un diagnostic existant,
    // et on recupere au passage le prompt IA propre a son vertical (etape 15)
    const { data: diagnostic, error: findError } = await supabaseAdmin
      .from('diagnostics')
      .select('id, verticals(prompt_ia_config)')
      .eq('token_acces', token)
      .single()

    if (findError || !diagnostic) {
      return NextResponse.json({ error: 'Lien invalide ou expire' }, { status: 404 })
    }

    // @ts-expect-error - jointure Supabase typee dynamiquement
    const promptVertical = diagnostic.verticals?.prompt_ia_config?.system_prompt as
      | string
      | undefined

    const systemPrompt = promptVertical
      ? `${promptVertical}\n\n${FORMAT_JSON_ATTENDU}`
      : PROMPT_PAR_DEFAUT

    // 2. Generation (reelle ou simulee en secours)
    const rapportComplet = await genererDiagnostic(probleme, systemPrompt)

    // 3. On sauvegarde le resultat complet en base (jamais renvoye en entier au front ici)
    await supabaseAdmin
      .from('diagnostics')
      .update({
        reponse_brute_prospect: probleme,
        reponse_ia_complete: rapportComplet,
        statut: 'complete',
      })
      .eq('id', diagnostic.id)

    // 4. On ne renvoie qu'un APERCU au front (le reste reste flouté cote UI,
    // mais surtout non transmis au navigateur avant capture du lead)
    const apercu = {
      titre: rapportComplet.titre,
      synthese: rapportComplet.synthese,
      premier_module: rapportComplet.modules?.[0]?.nom ?? null,
      nombre_modules_total: rapportComplet.modules?.length ?? 0,
    }

    return NextResponse.json({ apercu })
  } catch (err) {
    console.error('Erreur /api/diagnostic:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
