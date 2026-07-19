import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { construirePrompt, type ModeCiblage } from '@/lib/methodologie'
import { envoyerEmail } from '@/lib/notifications'
import { logErreur } from '@/lib/erreurs'
import { analyserProspect } from '@/lib/strategie'

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

async function genererBrouillonGemini(probleme: string, systemPrompt: string, apiKey: string) {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: probleme }] }],
      }),
    }
  )

  if (!res.ok) {
    throw new Error(`Gemini a repondu ${res.status} : ${await res.text()}`)
  }

  const data = await res.json()
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const cleanText = rawText.replace(/```json|```/g, '').trim()
  return JSON.parse(cleanText)
}

async function genererBrouillonAnthropic(probleme: string, systemPrompt: string, apiKey: string) {
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
}

// Ordre d'essai : Gemini (palier gratuit, ideal pour tester) -> Anthropic (payant, meilleure
// qualite en prod) -> mode simule (gratuit, sans aucun appel IA, toujours disponible en secours).
// Pour tester avec Gemini : mettre GEMINI_API_KEY dans les variables d'environnement Vercel.
// Cle Google AI Studio gratuite : https://aistudio.google.com/apikey
async function genererBrouillon(probleme: string, systemPrompt: string, modeCiblage: ModeCiblage) {
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (geminiKey) {
    try {
      return await genererBrouillonGemini(probleme, systemPrompt, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible, on essaie la suite:', err)
    }
  }

  if (anthropicKey) {
    try {
      return await genererBrouillonAnthropic(probleme, systemPrompt, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible, bascule en mode simule:', err)
    }
  }

  return genererBrouillonSimule(probleme, modeCiblage)
}

export async function POST(req: NextRequest) {
  try {
    const { token, probleme } = await req.json()

    if (!token || !probleme || probleme.trim().length < 10) {
      return NextResponse.json({ error: 'Donnees invalides' }, { status: 400 })
    }

    // 0. Rate-limiting anti-abus : max 5 diagnostics par IP toutes les 10 minutes
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu'
    const { data: autorise } = await supabaseAdmin.rpc('verifier_rate_limit', {
      p_identifiant: ip,
      p_max: 5,
      p_fenetre_minutes: 10,
    })

    if (autorise === false) {
      return NextResponse.json(
        { error: 'Trop de demandes recentes. Merci de reessayer dans quelques minutes.' },
        { status: 429 }
      )
    }

    // 1. On recupere le diagnostic + le client (mode de ciblage + email) + le vertical (prompt metier)
    const { data: diagnostic, error: findError } = await supabaseAdmin
      .from('diagnostics')
      .select(
        'id, target_id, clients(mode_ciblage, email, nom_entreprise), verticals(prompt_ia_config), targets(poste_ou_budget)'
      )
      .eq('token_acces', token)
      .single()

    if (findError || !diagnostic) {
      return NextResponse.json({ error: 'Lien invalide ou expire' }, { status: 404 })
    }

    // @ts-ignore - jointures Supabase typees dynamiquement
    const modeCiblage = (diagnostic.clients?.mode_ciblage ?? 'entreprise') as ModeCiblage
    // @ts-ignore - jointures Supabase typees dynamiquement
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

    // 3bis. Strategie commerciale (sans IA generative) : segmentation, score de
    // chaleur et recommandations internes pour le cabinet, calculees par un
    // moteur de regles a partir du texte brut du prospect.
    // @ts-ignore - jointure Supabase typee dynamiquement
    const posteOuBudget = diagnostic.targets?.poste_ou_budget as string | null | undefined
    const { segment, score, recommandations, contenuMarketing } = analyserProspect({
      phraseProspect: probleme,
      posteOuBudget,
    })

    if (diagnostic.target_id) {
      await supabaseAdmin
        .from('targets')
        .update({
          segment_categorie: segment.categorie,
          segment_urgence: segment.urgence,
          score_chaleur: score,
        })
        .eq('id', diagnostic.target_id)
    }

    await supabaseAdmin
      .from('diagnostics')
      .update({ recommandations_json: { segment, score, recommandations, contenuMarketing } })
      .eq('id', diagnostic.id)

    // 3bis. On notifie le cabinet par email qu'un nouveau diagnostic attend sa validation
    // (best-effort : si l'envoi echoue, on ne bloque pas le prospect pour autant)
    // @ts-ignore - jointure Supabase typee dynamiquement
    const emailCabinet = diagnostic.clients?.email as string | undefined
    // @ts-ignore - jointure Supabase typee dynamiquement
    const nomCabinet = diagnostic.clients?.nom_entreprise as string | undefined
    const dashboardUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/dashboard`

    if (emailCabinet) {
      try {
        await envoyerEmail(
          emailCabinet,
          `Bonjour ${nomCabinet ?? ''},\n\nUn nouveau diagnostic attend votre validation sur votre dashboard :\n${dashboardUrl}`
        )
      } catch (err) {
        console.error('Notification email cabinet echouee (non bloquant):', err)
      }
    }

    // 4. Le prospect ne recoit qu'une confirmation d'attente, jamais le contenu genere
    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/diagnostic:', err)
    await logErreur('/api/diagnostic', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
