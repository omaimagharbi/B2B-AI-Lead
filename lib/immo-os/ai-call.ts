import { claudeModel, geminiModel, FALLBACK_CLAUDE_MODEL } from '@/lib/immo-os/ai-model'
import { quotaIAImmo } from '@/lib/immo-os/ai-quota'
import { enregistrerUsageIA } from '@/lib/usage-ia'

const TIMEOUT_MS = 20_000

type Rep = { text: string; tin: number; tout: number }
const approx = (s: string) => Math.ceil(s.length / 4) // repli si le fournisseur ne renvoie pas les tokens

export async function gemini(prompt: string, key: string): Promise<Rep> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
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
export async function anthropic(prompt: string, key: string): Promise<Rep & { model: string }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const a = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS })
  const ask = (model: string) => a.messages.create({ model, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
  let model = claudeModel()
  let m
  try {
    m = await ask(model)
  } catch (e: any) {
    // Nom de modele inconnu (404) : on retente une fois avec l'ancien nom avant d'abandonner
    if (e?.status === 404 && model !== FALLBACK_CLAUDE_MODEL) { model = FALLBACK_CLAUDE_MODEL; m = await ask(model) } else throw e
  }
  const b = m.content.find((x) => x.type === 'text')
  const text = b && 'text' in b ? b.text : ''
  return { text, model, tin: m.usage?.input_tokens ?? approx(prompt), tout: m.usage?.output_tokens ?? approx(text) }
}


// Appel IA cote serveur hors requete d'un utilisateur (agent IA, lot 7) : meme quota mensuel et meme comptage d'usage que l'assistant.
export async function askAi(clientId: string, prompt: string): Promise<{ text: string; provider: 'gemini' | 'anthropic' } | null> {
  const q = await quotaIAImmo(clientId)
  if (!q.allowed) return null
  const g = process.env.GEMINI_API_KEY
  const a = process.env.ANTHROPIC_API_KEY
  if (g) {
    try { const r = await gemini(prompt, g); if (r.text) { await enregistrerUsageIA({ clientId, fournisseur: 'gemini', tokensEntree: r.tin, tokensSortie: r.tout, source: 'immo' }); return { text: r.text.trim(), provider: 'gemini' } } } catch (e) { console.error('immo ai gemini:', e) }
  }
  if (a) {
    try { const r = await anthropic(prompt, a); if (r.text) { await enregistrerUsageIA({ clientId, fournisseur: 'anthropic', tokensEntree: r.tin, tokensSortie: r.tout, source: 'immo' }); return { text: r.text.trim(), provider: 'anthropic' } } } catch (e) { console.error('immo ai anthropic:', e) }
  }
  return null
}
