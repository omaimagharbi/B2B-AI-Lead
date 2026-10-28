import { NextRequest, NextResponse } from 'next/server'
import { authentifierClientUser } from '@/lib/auth-api'
import { quotaIAImmo } from '@/lib/immo-os/ai-quota'
import { enregistrerUsageIA } from '@/lib/usage-ia'

const TIMEOUT_MS = 20_000

const MODES: Record<string, string> = {
  chat: 'Answer the agent question using ONLY the data provided. If something is not in the data, say so.',
  market: 'Write a short market analysis for the agent (key trends, price bands, demand by area, 3 concrete recommended actions). Use only the data provided; flag anything that is an assumption.',
  ad: 'Write a ready-to-post property advertisement for the requested channel, language and tone. Use only facts from the property data. Include a headline, 3-5 key selling points and a call to action. Never invent amenities.',
  reply: 'Write a short, warm, professional reply to the client message, as the agent. Propose one clear next step (viewing, documents, call). Use only facts from the data.',
  report: 'Write an executive summary report (5-8 lines) of the agency performance from the data, followed by 3 recommended actions.',
}
const LANGS: Record<string, string> = { en: 'English', fr: 'French', ar: 'Arabic (Modern Standard)' }

type Rep = { text: string; tin: number; tout: number }
const approx = (s: string) => Math.ceil(s.length / 4) // repli si le fournisseur ne renvoie pas les tokens

async function gemini(prompt: string, key: string): Promise<Rep> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }), signal: c.signal }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const d = await res.json()
    const text: string = d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return { text, tin: d.usageMetadata?.promptTokenCount ?? approx(prompt), tout: d.usageMetadata?.candidatesTokenCount ?? approx(text) }
  } finally {
    clearTimeout(t)
  }
}
async function anthropic(prompt: string, key: string): Promise<Rep> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const a = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS })
  const m = await a.messages.create({ model: 'claude-sonnet-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  const b = m.content.find((x) => x.type === 'text')
  const text = b && 'text' in b ? b.text : ''
  return { text, tin: m.usage?.input_tokens ?? approx(prompt), tout: m.usage?.output_tokens ?? approx(text) }
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const body = await req.json().catch(() => ({}))
  const mode = typeof body.mode === 'string' && body.mode in MODES ? body.mode : 'chat'
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 2000) : ''
  const context = typeof body.context === 'string' ? body.context.slice(0, 12000) : ''
  const lang = LANGS[body.language as string] ?? LANGS.en
  const extra = typeof body.extra === 'string' ? body.extra.slice(0, 2000) : ''
  if (!prompt && mode !== 'market' && mode !== 'report') return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  const full = `You are the AI assistant of a real estate agency in Qatar (QAR currency). ${MODES[mode]}\nRespond in ${lang}. Be concise, concrete and professional. Plain text, no markdown tables.\n\n--- AGENCY DATA ---\n${context}\n${extra ? `\n--- DETAILS ---\n${extra}\n` : ''}--- END DATA ---\n\nRequest: ${prompt || '(generate)'}`

  // Quota mensuel par agence (compte les requetes IA immobilier du mois)
  const q = await quotaIAImmo(auth.clientId)
  if (!q.allowed) {
    return NextResponse.json({ error: `Monthly AI limit reached (${q.used}/${q.limit}). Contact PiloBrain to increase it.` }, { status: 429 })
  }

  const g = process.env.GEMINI_API_KEY
  const a = process.env.ANTHROPIC_API_KEY
  if (g) {
    try {
      const r = await gemini(full, g)
      if (r.text) {
        await enregistrerUsageIA({ clientId: auth.clientId, fournisseur: 'gemini', tokensEntree: r.tin, tokensSortie: r.tout, source: 'immo' })
        return NextResponse.json({ reply: r.text, provider: 'gemini' })
      }
    } catch (e) {
      console.error('immo assistant gemini:', e)
    }
  }
  if (a) {
    try {
      const r = await anthropic(full, a)
      if (r.text) {
        await enregistrerUsageIA({ clientId: auth.clientId, fournisseur: 'anthropic', tokensEntree: r.tin, tokensSortie: r.tout, source: 'immo' })
        return NextResponse.json({ reply: r.text, provider: 'anthropic' })
      }
    } catch (e) {
      console.error('immo assistant anthropic:', e)
    }
  }
  return NextResponse.json({ reply: null, provider: 'none' })
}
