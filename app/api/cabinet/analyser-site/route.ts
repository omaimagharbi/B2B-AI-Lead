import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

// Extraction texte brute d'une page HTML (pas de dependance lourde type
// cheerio/jsdom : on retire scripts/styles puis les balises, suffisant pour
// nourrir un prompt IA - pas besoin d'un DOM structure).
function extraireTexteHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000) // on garde large mais borne pour le prompt IA
}

function construirePrompt(texteSite: string): string {
  return `Voici le contenu texte brut du site web d'un cabinet de formation/conseil. Analyse-le et renvoie UNIQUEMENT un JSON avec cette structure exacte, sans aucun commentaire autour :
{"positionnement": "description du positionnement de marque en 2-3 phrases", "expertises": ["liste", "brute", "des", "expertises", "mentionnees"], "references_clients": ["noms", "de", "clients", "ou", "partenaires", "mentionnes", "si", "presents"]}

Contenu du site :
${texteSite}`
}

function extraireJson(texte: string): { positionnement: string; expertises: string[]; references_clients: string[] } | null {
  const match = texte.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

async function analyserAvecGemini(prompt: string, apiKey: string) {
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

async function analyserAvecAnthropic(prompt: string, apiKey: string) {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('site_web')
    .eq('id', auth.clientId)
    .single()

  if (!client?.site_web) {
    return NextResponse.json({ error: 'Aucun site web renseigné dans le profil du cabinet' }, { status: 400 })
  }

  let html: string
  try {
    const url = client.site_web.startsWith('http') ? client.site_web : `https://${client.site_web}`
    const resFetch = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!resFetch.ok) throw new Error(`Statut ${resFetch.status}`)
    html = await resFetch.text()
  } catch (err) {
    console.error('Erreur fetch site cabinet:', err)
    return NextResponse.json({ error: "Impossible d'accéder au site web renseigné" }, { status: 502 })
  }

  const texteSite = extraireTexteHtml(html)
  if (texteSite.length < 50) {
    return NextResponse.json({ error: 'Le site ne contient pas assez de texte exploitable' }, { status: 422 })
  }

  const prompt = construirePrompt(texteSite)
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  let resultatBrut = ''
  if (geminiKey) {
    try {
      resultatBrut = await analyserAvecGemini(prompt, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible pour analyse cabinet:', err)
    }
  }
  if (!resultatBrut && anthropicKey) {
    try {
      resultatBrut = await analyserAvecAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible pour analyse cabinet:', err)
    }
  }

  if (!resultatBrut) {
    return NextResponse.json({ error: 'Aucun service IA disponible (ajoute une clé GEMINI_API_KEY ou ANTHROPIC_API_KEY)' }, { status: 503 })
  }

  const analyse = extraireJson(resultatBrut)
  if (!analyse) {
    return NextResponse.json({ error: "La réponse IA n'a pas pu être interprétée, réessaie" }, { status: 500 })
  }

  const positionnementTexte = [
    analyse.positionnement,
    analyse.expertises?.length ? `Expertises : ${analyse.expertises.join(', ')}` : '',
    analyse.references_clients?.length ? `Références citées : ${analyse.references_clients.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  await supabaseAdmin
    .from('clients')
    .update({ positionnement_site: positionnementTexte, derniere_analyse_cabinet_at: new Date().toISOString() })
    .eq('id', auth.clientId)

  return NextResponse.json({ positionnement_site: positionnementTexte })
}
