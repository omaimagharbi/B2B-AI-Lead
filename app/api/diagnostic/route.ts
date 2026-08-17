import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { construirePrompt, type ModeCiblage, type OffreCatalogue } from '@/lib/methodologie'
import { envoyerEmail } from '@/lib/notifications'
import { logErreur } from '@/lib/erreurs'
import { analyserProspect, genererExplicationScore, genererBesoinSousJacent } from '@/lib/strategie'
import { zonePourPays, argumentVenteParZone, deviseParZone } from '@/lib/pays'
import { genererSignalIA } from '@/lib/classification'
import { enregistrerSanteApi } from '@/lib/sante-api'
import { enregistrerUsageIA } from '@/lib/usage-ia'

function genererBrouillonSimule(probleme: string, modeCiblage: ModeCiblage) {
  // Meme en mode simule (pas de cle IA configuree), on evite le texte 100%
  // generique en reinjectant le probleme reellement decrit par le prospect
  // dans chaque etape - ca reste un brouillon a affiner par l'expert (voir
  // le badge "Mode simule" affiche cote validation), mais un point de
  // depart deja lie au cas concret plutot qu'une definition de dictionnaire.
  const probremeCourt = probleme.trim().slice(0, 140)
  const etapesAddie = [
    { nom: 'Analyse', description: `Auditer la situation decrite ("${probremeCourt}") pour en identifier precisement les causes racines.` },
    { nom: 'Design', description: `Concevoir un parcours d'accompagnement sur-mesure adapte a ce contexte specifique.` },
    { nom: 'Developpement', description: 'Construire les contenus, outils et supports necessaires a cet accompagnement.' },
    { nom: 'Implementation', description: "Deployer l'accompagnement aupres des equipes concernees, avec mise en pratique reelle." },
    { nom: 'Evaluation', description: "Mesurer l'impact obtenu sur ce probleme precis et ajuster si necessaire." },
  ]
  const etapesGrow = [
    { nom: 'Goal', description: `Clarifier l'objectif reel poursuivi derriere : "${probremeCourt}".` },
    { nom: 'Reality', description: 'Faire un etat des lieux honnete de la situation actuelle et de ses blocages.' },
    { nom: 'Options', description: 'Explorer les options concretes possibles pour avancer sur ce point precis.' },
    { nom: 'Will', description: "Definir un plan d'action concret et engageant, avec une premiere etape claire." },
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
  return {
    brouillon: JSON.parse(cleanText),
    tokensEntree: data.usageMetadata?.promptTokenCount ?? 0,
    tokensSortie: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
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
  return {
    brouillon: JSON.parse(cleanText),
    tokensEntree: message.usage?.input_tokens ?? 0,
    tokensSortie: message.usage?.output_tokens ?? 0,
  }
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
      const resultat = await genererBrouillonGemini(probleme, systemPrompt, geminiKey)
      await enregistrerSanteApi('ia_diagnostic', true, 'gemini')
      return { ...resultat, fournisseur: 'gemini' as const }
    } catch (err) {
      console.error('Gemini indisponible, on essaie la suite:', err)
      await enregistrerSanteApi('ia_diagnostic', false, `gemini: ${String(err)}`)
    }
  }

  if (anthropicKey) {
    try {
      const resultat = await genererBrouillonAnthropic(probleme, systemPrompt, anthropicKey)
      await enregistrerSanteApi('ia_diagnostic', true, 'anthropic')
      return { ...resultat, fournisseur: 'anthropic' as const }
    } catch (err) {
      console.error('Anthropic indisponible, bascule en mode simule:', err)
      await enregistrerSanteApi('ia_diagnostic', false, `anthropic: ${String(err)}`)
    }
  }

  return {
    brouillon: genererBrouillonSimule(probleme, modeCiblage),
    tokensEntree: 0,
    tokensSortie: 0,
    fournisseur: null,
  }
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
        'id, target_id, client_id, clients(mode_ciblage, email, nom_entreprise), verticals(prompt_ia_config), targets(poste_ou_budget, entreprise_ou_objectif, country)'
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

    // Catalogue reel du cabinet (formations/services) : si non vide, l'IA doit
    // piocher dedans plutot que d'inventer des packs generiques.
    const { data: catalogueData } = await supabaseAdmin
      .from('catalogue_offres')
      .select('nom, description, prix, devise, duree')
      .eq('client_id', diagnostic.client_id)

    // @ts-ignore - jointures Supabase typees dynamiquement
    const countryCible = diagnostic.targets?.country as string | null | undefined
    const zone = zonePourPays(countryCible)
    const devise = deviseParZone(zone)
    const contexteZone =
      `${argumentVenteParZone(zone)} Devise a utiliser pour tout montant chiffre dans ce ` +
      `diagnostic (packs, tarifs) : ${devise}.`
    const promptVerticalAvecZone = promptVertical
      ? `${promptVertical}\n\n${contexteZone}`
      : contexteZone

    const systemPrompt = construirePrompt(
      modeCiblage,
      promptVerticalAvecZone,
      (catalogueData ?? []) as OffreCatalogue[]
    )

    // 2. Generation du brouillon (reel ou simule en secours) - JAMAIS montre au prospect
    const resultatGeneration = await genererBrouillon(probleme, systemPrompt, modeCiblage)
    const brouillon = resultatGeneration.brouillon

    if (resultatGeneration.fournisseur) {
      await enregistrerUsageIA({
        clientId: diagnostic.client_id ?? null,
        fournisseur: resultatGeneration.fournisseur,
        tokensEntree: resultatGeneration.tokensEntree,
        tokensSortie: resultatGeneration.tokensSortie,
      })
    }

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
    // @ts-ignore - jointure Supabase typee dynamiquement
    const entrepriseOuObjectif = diagnostic.targets?.entreprise_ou_objectif as
      | string
      | null
      | undefined
    const { segment, score, recommandations, contenuMarketing } = analyserProspect({
      phraseProspect: probleme,
      posteOuBudget,
    })
    const explicationScore = genererExplicationScore({
      segment,
      phraseProspect: probleme,
    })
    const besoinSousJacent = genererBesoinSousJacent(segment.categorie)

    if (diagnostic.target_id) {
      await supabaseAdmin
        .from('targets')
        .update({
          segment_categorie: segment.categorie,
          segment_urgence: segment.urgence,
          score_chaleur: score,
          signal_ia: genererSignalIA({
            poste: posteOuBudget ?? null,
            entreprise: entrepriseOuObjectif ?? null,
            segmentCategorie: segment.categorie,
            segmentUrgence: segment.urgence,
          }),
        })
        .eq('id', diagnostic.target_id)
    }

    await supabaseAdmin
      .from('diagnostics')
      .update({
        recommandations_json: {
          segment,
          score,
          recommandations,
          contenuMarketing,
          explicationScore,
          besoinSousJacent,
        },
      })
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
