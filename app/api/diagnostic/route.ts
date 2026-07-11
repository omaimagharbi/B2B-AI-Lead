import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { construirePrompt, type ModeCiblage } from '@/lib/methodologie'

function genererBrouillonSimule(probleme: string, modeCiblage: ModeCiblage) {
  const etapesAddie = [
    { nom: 'Analyse', description: 'Identifier precisement les causes du probleme rencontre.' },
    { nom: 'Design', description: "Concevoir un parcours d'accompagnement adapte au contexte." },
    { nom: 'Developpement', description: 'Construire les contenus et outils necessaires.' },
    { nom: 'Implementation', description: "Deployer l'accompagnement aupres des equipes concernees." },
    { nom: 'Evaluation', description: "Mesurer l'impact et ajuster si necessaire." },
  ]
  const etapesGrow = [
    { nom: 'Goal', description: "Clarifier l'objectif reel poursuivi." },
    { nom: 'Reality', description: 'Faire un etat des lieux honnete de la situation actuelle.' },
    { nom: 'Options', description: 'Explorer les options possibles pour avancer.' },
    { nom: 'Will', description: "Definir un plan d'action concret et engageant." },
  ]

  return {
    titre: 'Diagnostic préliminaire (brouillon en attente de validation)',
    synthese: `D'après votre description ("${probleme.slice(0, 80)}${
      probleme.length > 80 ? '...' : ''
    }"), un accompagnement structuré semble pertinent.`,
    methodologie: modeCiblage === 'particulier' ? 'GROW' : 'ADDIE',
    etapes: modeCiblage === 'particulier' ? etapesGrow : etapesAddie,
    packs_proposes: [
      { nom: 'Pack Découverte', prix_indicatif: 0, description: "Entretien de cadrage initial." },
      { nom: 'Pack Standard', prix_indicatif: 0, description: "À ajuster par l'expert." },
    ],
    _simule: true,
  }
}

async function genererBrouillon(probleme: string, systemPrompt: string, modeCiblage: ModeCiblage) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return genererBrouillonSimule(probleme, modeCiblage)

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: probleme }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    const cleanText = rawText.replace(/```json|```/g, '').trim()
    return JSON.parse(cleanText)
  } catch (err) {
    console.error('Anthropic indisponible, bascule en mode simule:', err)
    return genererBrouillonSimule(probleme, modeCiblage)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, probleme } = await req.json()

    if (!token || !probleme || probleme.trim().length < 10) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    // 1. On recupere le diagnostic + le client (mode de ciblage) + le vertical (prompt metier)
    const { data: diagnostic, error: findError } = await supabaseAdmin
      .from('diagnostics')
      .select('id, clients(mode_ciblage), verticals(prompt_ia_config)')
      .eq('token_acces', token)
      .single()

    if (findError || !diagnostic) {
      return NextResponse.json({ error: 'Lien invalide ou expire' }, { status: 404 })
    }

    // @ts-expect-error - jointures Supabase typees dynamiquement
    const modeCiblage = (diagnostic.clients?.mode_ciblage ?? 'entreprise') as ModeCiblage
    // @ts-expect-error - jointures Supabase typees dynamiquement
    const promptVertical = diagnostic.verticals?.prompt_ia_config?.system_prompt as
      | string
      | undefined

    const systemPrompt = construirePrompt(modeCiblage, promptVertical)

    // 2. Generation du brouillon (reel ou simule en secours) - JAMAIS montre au prospect
    const brouillon = await genererBrouillon(probleme, systemPrompt, modeCiblage)

    // 3. On sauvegarde et on passe le diagnostic en attente de validation humaine
    await supabaseAdmin
      .from('diagnostics')
      .update({
        phrase_brute_prospect: probleme,
        json_ia_brouillon: brouillon,
        statut_validation: 'en_attente_validation',
      })
      .eq('id', diagnostic.id)

    // 4. Le prospect ne recoit qu'une confirmation d'attente, jamais le contenu genere
    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/diagnostic:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
