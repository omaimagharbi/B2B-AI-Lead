import { createHmac, timingSafeEqual } from 'node:crypto'

// Lot 6a : WhatsApp Business officiel (Meta Cloud API). Partie PURE (analyse du webhook, signature, fenetre de 24 h, rendu des modeles)
// + petits appels HTTP vers graph.facebook.com. Aucune cle dans le code : META_WA_ACCESS_TOKEN, META_WA_APP_SECRET, META_WA_VERIFY_TOKEN.
export type MetaMsg = { phoneNumberId: string; from: string; name: string | null; id: string; type: string; text: string; ts: number }
export type MetaStatus = { phoneNumberId: string; id: string; status: 'sent' | 'delivered' | 'read' | 'failed'; recipient: string; error: string | null; code: number | null }

const cap = (s: unknown, n = 4000) => String(s ?? '').slice(0, n)
// Texte lisible d'un message entrant : texte, reponse a un bouton / une liste, legende d'un media ; autrement [type]
function textOf(m: any): string {
  switch (m.type) {
    case 'text': return cap(m.text?.body)
    case 'button': return cap(m.button?.text)
    case 'interactive': return cap(m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '')
    case 'image': case 'video': case 'document': case 'audio': case 'sticker': return cap(`[${m.type}]${m[m.type]?.caption ? ` ${m[m.type].caption}` : ''}`)
    case 'location': return '[location]'
    case 'contacts': return '[contact]'
    default: return `[${cap(m.type, 30) || 'message'}]`
  }
}

export function parseMetaWebhook(body: any): { messages: MetaMsg[]; statuses: MetaStatus[] } {
  const out = { messages: [] as MetaMsg[], statuses: [] as MetaStatus[] }
  if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return out
  for (const e of body.entry) for (const c of e?.changes ?? []) {
    const v = c?.value
    const pid = String(v?.metadata?.phone_number_id ?? '')
    if (!pid) continue
    const names = new Map<string, string>((v.contacts ?? []).map((x: any) => [String(x.wa_id), String(x.profile?.name ?? '')]))
    for (const m of v.messages ?? []) {
      if (!m?.id || !m?.from) continue
      out.messages.push({ phoneNumberId: pid, from: String(m.from).replace(/\D/g, ''), name: names.get(String(m.from)) || null, id: String(m.id), type: String(m.type ?? 'text'), text: textOf(m), ts: Number(m.timestamp) * 1000 || Date.now() })
    }
    for (const s of v.statuses ?? []) {
      if (!s?.id || !['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue
      const err = s.errors?.[0]
      out.statuses.push({ phoneNumberId: pid, id: String(s.id), status: s.status, recipient: String(s.recipient_id ?? ''), error: err ? cap(`${err.title ?? ''} ${err.message ?? ''}`.trim(), 300) : null, code: err?.code != null ? Number(err.code) : null })
    }
  }
  return out
}

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corps brut, secret de l'application Meta)
export function verifySignature(raw: string, header: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !header || !header.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest('hex')
  const got = header.slice(7)
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected))
}

export { WINDOW_MS, windowState, templateVars, renderTemplate } from './wa-window'

// Erreurs "techniques" (jeton expire, panne Meta, reseau) : GreenAPI peut prendre le relais. Les erreurs de REGLE (fenetre, modele, spam)
// ne declenchent jamais le repli : on ne contourne pas les regles de Meta avec un canal non officiel.
export const isTechnicalFailure = (status: number, code: number | null) => status === 0 || status >= 500 || status === 401 || code === 190 || code === 10
export const normalizeTo = (phone: string) => phone.replace(/\D/g, '')

export const metaReady = () => !!process.env.META_WA_ACCESS_TOKEN
export const metaEnv = () => ({ token: !!process.env.META_WA_ACCESS_TOKEN, appSecret: !!process.env.META_WA_APP_SECRET, verifyToken: !!process.env.META_WA_VERIFY_TOKEN })
const base = () => `https://graph.facebook.com/${process.env.META_WA_API_VERSION || 'v21.0'}`

export type SendPayload = { kind: 'text'; text: string } | { kind: 'template'; name: string; language: string; params: string[] }
export type SendResult = { ok: true; id: string } | { ok: false; status: number; code: number | null; message: string }

export async function sendMeta(phoneNumberId: string, to: string, p: SendPayload): Promise<SendResult> {
  const body = p.kind === 'text'
    ? { messaging_product: 'whatsapp', to: normalizeTo(to), type: 'text', text: { body: p.text.slice(0, 4096), preview_url: true } }
    : { messaging_product: 'whatsapp', to: normalizeTo(to), type: 'template', template: { name: p.name, language: { code: p.language }, ...(p.params.length ? { components: [{ type: 'body', parameters: p.params.map((x) => ({ type: 'text', text: x })) }] } : {}) } }
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(phoneNumberId)}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.META_WA_ACCESS_TOKEN}` }, body: JSON.stringify(body) })
    const j = await res.json().catch(() => null)
    const id = j?.messages?.[0]?.id
    if (res.ok && id) return { ok: true, id: String(id) }
    return { ok: false, status: res.status, code: j?.error?.code != null ? Number(j.error.code) : null, message: cap(j?.error?.message ?? `HTTP ${res.status}`, 300) }
  } catch (e) { return { ok: false, status: 0, code: null, message: e instanceof Error ? e.message : 'network error' } }
}

// Modeles d'un compte WhatsApp Business (Meta > Message templates)
export async function fetchTemplates(wabaId: string): Promise<{ name: string; language: string; category: string | null; status: string; body: string | null }[] | null> {
  try {
    const res = await fetch(`${base()}/${encodeURIComponent(wabaId)}/message_templates?limit=200&fields=name,language,status,category,components`, { headers: { Authorization: `Bearer ${process.env.META_WA_ACCESS_TOKEN}` } })
    const j = await res.json().catch(() => null)
    if (!res.ok || !Array.isArray(j?.data)) return null
    return j.data.map((t: any) => ({ name: String(t.name), language: String(t.language), category: t.category ?? null, status: String(t.status ?? 'PENDING'), body: (t.components ?? []).find((c: any) => c.type === 'BODY')?.text ?? null }))
  } catch { return null }
}
