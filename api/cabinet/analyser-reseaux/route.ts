import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

// Meme logique que /api/cabinet/analyser-site, mais pour les reseaux sociaux
// (LinkedIn + Facebook) plutot que le site web.
//
// LIMITE IMPORTANTE (a connaitre avant de compter dessus) : contrairement a
// un site web classique, LinkedIn et Facebook bloquent tres largement le
// contenu aux visiteurs non connectes - un simple fetch() recupere souvent
// une page de connexion ou un contenu tres partiel (juste le nom/tagline),
// pas les posts recents. Ca marche mieux pour Facebook (pages publiques
// parfois partiellement visibles) que pour LinkedIn (quasi toujours bloque
// sans connexion). Un resultat pauvre ou une erreur "pas assez de contenu"
// est donc attendu dans une partie des cas - ce n'est pas un bug, c'est la
// realite de ce qui est accessible sans un vrai scraper tiers (Apify avec
// authentification, hors scope ici).

function extraireTexteHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000)
}

function construirePrompt(contenu: string): string {
  return `Voici le contenu texte brut recupere depuis la/les page(s) reseaux sociaux (LinkedIn et/ou Facebook) d'un cabinet de formation/conseil. Analyse le ton et le style de communication employe, et renvoie UNIQUEMENT un JSON avec cette structure exacte, sans aucun commentaire autour :
{"ton": "description du ton/style de communication en 1-2 phrases (ex: professionnel et pedagogue, decontracte et proche du terrain, technique et expert...)", "themes_recurrents": ["liste", "de", "themes", "ou", "sujets", "recurrents", "si", "identifiables"]}

Si le contenu est trop pauvre pour en tirer quoi que ce soit (page de connexion, quasi vide), renvoie {"ton": "", "themes_recurrents": []}.

Contenu recupere :
${contenu}`
}

function extraireJson(texte: string): { ton: string; themes_recurrents: string[] } | null {
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
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
}

async function recupererTexte(url: string): Promise<string> {
  try {
    const resFetch = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PiloBrainBot/1.0)' },
    })
    if (!resFetch.ok) return ''
    return extraireTexteHtml(await resFetch.text())
  } catch (err) {
    console.error(`Erreur fetch reseau social (${url}):`, err)
    return ''
  }
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('linkedin_url, facebook_url')
    .eq('id', auth.clientId)
    .single()

  if (!client?.linkedin_url && !client?.facebook_url) {
    return NextResponse.json(
      { error: 'Ajoute au moins une page LinkedIn ou Facebook dans Équipe & Paramètres' },
      { status: 400 }
    )
  }

  const [texteLinkedin, texteFacebook] = await Promise.all([
    client.linkedin_url ? recupererTexte(client.linkedin_url) : Promise.resolve(''),
    client.facebook_url ? recupererTexte(client.facebook_url) : Promise.resolve(''),
  ])
  const contenu = [texteLinkedin, texteFacebook].filter(Boolean).join('\n---\n')

  if (contenu.length < 30) {
    return NextResponse.json(
      {
        error:
          "Impossible de récupérer assez de contenu depuis ces pages (LinkedIn/Facebook bloquent souvent l'accès sans connexion). Tu peux remplir ce champ toi-même à la place, plus bas.",
      },
      { status: 422 }
    )
  }

  const prompt = construirePrompt(contenu)
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  let resultatBrut = ''
  if (geminiKey) {
    try {
      resultatBrut = await analyserAvecGemini(prompt, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible pour analyse reseaux:', err)
    }
  }
  if (!resultatBrut && anthropicKey) {
    try {
      resultatBrut = await analyserAvecAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible pour analyse reseaux:', err)
    }
  }

  if (!resultatBrut) {
    return NextResponse.json(
      { error: 'Aucun service IA disponible (ajoute une clé GEMINI_API_KEY ou ANTHROPIC_API_KEY)' },
      { status: 503 }
    )
  }

  const analyse = extraireJson(resultatBrut)
  if (!analyse || !analyse.ton) {
    return NextResponse.json(
      {
        error:
          "Le contenu récupéré n'était pas assez riche pour en tirer un ton exploitable. Tu peux remplir ce champ toi-même à la place, plus bas.",
      },
      { status: 422 }
    )
  }

  const ligneEditoriale = [
    analyse.ton,
    analyse.themes_recurrents?.length ? `Thèmes récurrents : ${analyse.themes_recurrents.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  await supabaseAdmin.from('clients').update({ ligne_editoriale_reseaux: ligneEditoriale }).eq('id', auth.clientId)

  return NextResponse.json({ ligne_editoriale_reseaux: ligneEditoriale })
}
