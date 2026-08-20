import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

type EntreeCalendrier = { semaine: number; theme: string; format_suggere: string; angle_accroche: string }
type EntreeMatrice = { objection: string; angle_contenu: string; format_suggere: string }

function construirePrompt(params: {
  motsCles: string | null
  ideesRecues: string | null
  positionnement: string | null
  ligneEditoriale: string | null
}): string {
  const { motsCles, ideesRecues, positionnement, ligneEditoriale } = params
  return `Tu es strategiste content marketing B2B pour un cabinet de formation/conseil. Contexte du cabinet :
${positionnement ? `Positionnement : ${positionnement}` : ''}
${motsCles ? `Perimetre technique (rester dans ce cadre) : ${motsCles}` : ''}
${ligneEditoriale ? `Ton observe sur ses reseaux : ${ligneEditoriale}` : ''}
${ideesRecues ? `Idees recues du marche a contrer : ${ideesRecues}` : "Pas d'idee recue precisee - deduis-en une ou deux plausibles pour ce secteur."}

Genere deux livrables et renvoie UNIQUEMENT un JSON avec cette structure exacte, sans commentaire autour :
{
  "calendrier": [
    {"semaine": 1, "theme": "...", "format_suggere": "...", "angle_accroche": "..."},
    ... (4 entrees, une par semaine du mois)
  ],
  "matrice": [
    {"objection": "...", "angle_contenu": "...", "format_suggere": "..."},
    ... (2 a 4 entrees, une par idee recue/objection identifiee)
  ]
}
Reponds en francais, contenu concret et specifique au secteur (pas de generalites vagues type "publier du contenu de qualite").`
}

async function genererAvecGemini(prompt: string, apiKey: string): Promise<string> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function genererAvecAnthropic(prompt: string, apiKey: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
}

function extraireJson(texte: string): { calendrier: EntreeCalendrier[]; matrice: EntreeMatrice[] } | null {
  const match = texte.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('mots_cles_expertise, idees_recues_marche, positionnement_site, ligne_editoriale_reseaux')
    .eq('id', auth.clientId)
    .single()

  const prompt = construirePrompt({
    motsCles: client?.mots_cles_expertise ?? null,
    ideesRecues: client?.idees_recues_marche ?? null,
    positionnement: client?.positionnement_site ?? null,
    ligneEditoriale: client?.ligne_editoriale_reseaux ?? null,
  })

  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  let texteBrut = ''

  if (geminiKey) {
    try {
      texteBrut = await genererAvecGemini(prompt, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible pour calendrier editorial:', err)
    }
  }
  if (!texteBrut && anthropicKey) {
    try {
      texteBrut = await genererAvecAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible pour calendrier editorial:', err)
    }
  }

  if (!texteBrut) {
    return NextResponse.json(
      { error: 'Aucun service IA disponible (ajoute une clé GEMINI_API_KEY ou ANTHROPIC_API_KEY)' },
      { status: 503 }
    )
  }

  const resultat = extraireJson(texteBrut)
  if (!resultat) {
    return NextResponse.json({ error: "La réponse IA n'a pas pu être interprétée, réessaie" }, { status: 500 })
  }

  // Regeneration = on remplace le calendrier/la matrice du mois precedent
  await supabaseAdmin.from('calendrier_editorial').delete().eq('client_id', auth.clientId)
  await supabaseAdmin.from('matrice_contre_objection').delete().eq('client_id', auth.clientId)

  if (resultat.calendrier?.length) {
    await supabaseAdmin.from('calendrier_editorial').insert(
      resultat.calendrier.map((e) => ({
        client_id: auth.clientId,
        semaine: e.semaine,
        theme: e.theme,
        format_suggere: e.format_suggere,
        angle_accroche: e.angle_accroche,
      }))
    )
  }

  if (resultat.matrice?.length) {
    await supabaseAdmin.from('matrice_contre_objection').insert(
      resultat.matrice.map((e) => ({
        client_id: auth.clientId,
        objection: e.objection,
        angle_contenu: e.angle_contenu,
        format_suggere: e.format_suggere,
      }))
    )
  }

  return NextResponse.json({ calendrier: resultat.calendrier ?? [], matrice: resultat.matrice ?? [] })
}

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data: calendrier } = await supabaseAdmin
    .from('calendrier_editorial')
    .select('id, semaine, theme, format_suggere, angle_accroche, statut')
    .eq('client_id', auth.clientId)
    .order('semaine', { ascending: true })

  const { data: matrice } = await supabaseAdmin
    .from('matrice_contre_objection')
    .select('id, objection, angle_contenu, format_suggere')
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ calendrier: calendrier ?? [], matrice: matrice ?? [] })
}

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { id, statut } = await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('calendrier_editorial')
    .update({ statut: statut === 'publie' ? 'publie' : 'a_faire' })
    .eq('id', id)
    .eq('client_id', auth.clientId)

  if (error) return NextResponse.json({ error: 'Erreur de mise à jour' }, { status: 500 })
  return NextResponse.json({ succes: true })
}
