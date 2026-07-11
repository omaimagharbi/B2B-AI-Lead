import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SYSTEM_PROMPT = `Tu es un consultant senior en formation professionnelle et developpement des competences.
Un decideur (DRH ou Directeur) decrit en une phrase le probleme actuel de ses equipes.
Tu dois generer un diagnostic pedagogique structure, credible et actionnable.

Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, au format exact suivant :

{
  "titre": "Titre court et percutant du diagnostic",
  "synthese": "2-3 phrases resumant le probleme identifie et l'enjeu business associe",
  "modules": [
    { "nom": "Nom du module de formation", "priorite": "haute|moyenne", "description": "1 phrase expliquant l'objectif de ce module" }
  ],
  "certification_recommandee": "Nom d'une certification pertinente (ex: PMP, Scrum Master, etc.)",
  "duree_estimee": "Ex: 5 jours / 35 heures"
}

Genere entre 3 et 4 modules maximum, ordonnes par priorite decroissante.`

export async function POST(req: NextRequest) {
  try {
    const { token, probleme } = await req.json()

    if (!token || !probleme || probleme.trim().length < 10) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    // 1. On verifie que le token correspond a un diagnostic existant
    const { data: diagnostic, error: findError } = await supabaseAdmin
      .from('diagnostics')
      .select('id')
      .eq('token_acces', token)
      .single()

    if (findError || !diagnostic) {
      return NextResponse.json({ error: 'Lien invalide ou expire' }, { status: 404 })
    }

    // 2. Appel a l'API Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: probleme }],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '{}'
    const cleanText = rawText.replace(/```json|```/g, '').trim()
    const rapportComplet = JSON.parse(cleanText)

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
