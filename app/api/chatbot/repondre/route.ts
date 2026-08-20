import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

// Le chatbot ne repond QU'a partir du manuel d'utilisation redige par
// l'admin (pas de connaissance generale hors-sujet, pas de speculation sur
// des donnees du cabinet) - evite les reponses inventees sur une
// plateforme en evolution constante.
function construirePrompt(manuel: string, question: string): string {
  return `Tu es l'assistant support de la plateforme. Reponds UNIQUEMENT en te basant sur le manuel d'utilisation ci-dessous. Si la reponse n'y figure pas, dis clairement que tu ne sais pas et invite a contacter le support - n'invente jamais de fonctionnalite.\n\n--- MANUEL D'UTILISATION ---\n${manuel}\n--- FIN DU MANUEL ---\n\nQuestion de l'utilisateur : ${question}\n\nReponds en francais, de facon concise et directe.`
}

async function repondreAvecGemini(prompt: string, apiKey: string): Promise<string> {
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

async function repondreAvecAnthropic(prompt: string, apiKey: string): Promise<string> {
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

  const { question } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: 'Question requise' }, { status: 400 })

  const { data: config } = await supabaseAdmin
    .from('chatbot_config')
    .select('manuel_utilisation')
    .eq('id', 1)
    .single()

  const manuel = config?.manuel_utilisation ?? ''
  if (!manuel.trim()) {
    return NextResponse.json({
      reponse:
        "Le manuel d'utilisation n'a pas encore été configuré par l'équipe PiloBrain. Contacte le support directement en attendant.",
    })
  }

  const prompt = construirePrompt(manuel, question)
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (geminiKey) {
    try {
      const reponse = await repondreAvecGemini(prompt, geminiKey)
      if (reponse) return NextResponse.json({ reponse })
    } catch (err) {
      console.error('Gemini indisponible pour le chatbot, on essaie la suite:', err)
    }
  }

  if (anthropicKey) {
    try {
      const reponse = await repondreAvecAnthropic(prompt, anthropicKey)
      if (reponse) return NextResponse.json({ reponse })
    } catch (err) {
      console.error('Anthropic indisponible pour le chatbot:', err)
    }
  }

  return NextResponse.json({
    reponse: "Le service IA est momentanément indisponible. Réessaie dans quelques instants.",
  })
}
