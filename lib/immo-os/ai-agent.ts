import type { Lead, Message, Property } from './types'
import { matchProperties, parseSearch, qar, type Query } from './helpers'
import { propRef } from './property-detect'
import { pickLang, type PolicyLang } from './optout'

// Lot 7 (n°39 / n°85) : AI Real Estate Agent. Logique PURE (garde-fous, prompt, controle de la reponse, qualification) ;
// l'envoi, le journal et l'appel IA sont dans api/ai-agent-run.ts. Principe : l'IA ne parle seule que si l'agence l'a activee,
// ne dit rien qui ne soit dans les donnees fournies, et passe la main a un humain des qu'un sujet sensible apparait.
export type AgentConfig = { auto_reply: boolean; qualify: boolean; max_replies: number; quality_hints: boolean; negotiation_help: boolean; dispatch_help: boolean }
export const DEFAULT_AGENT_CONFIG: AgentConfig = { auto_reply: false, qualify: true, max_replies: 3, quality_hints: true, negotiation_help: true, dispatch_help: true }
export const CONFIG_BOOLS = ['auto_reply', 'qualify', 'quality_hints', 'negotiation_help', 'dispatch_help'] as const

export function readConfig(raw: unknown): AgentConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_AGENT_CONFIG }
  for (const k of CONFIG_BOOLS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean
  const n = Math.round(Number(r.max_replies))
  if (Number.isFinite(n) && n >= 1 && n <= 5) out.max_replies = n
  return out
}

const norm = (s: string) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/\s+/g, ' ').trim()

// Sujets que l'IA ne traite JAMAIS seule : negociation de prix, juridique, plainte, demande d'un humain
const HANDOFF = [
  /discount|negotiat|lower the price|best price|final price|cheaper price|reduce the price|haggle/, /lawyer|legal|contract|sue\b|complain|refund|scam|fraud|police|court/,
  /speak (to|with) (a |an )?(human|person|agent|manager)|talk to (a |an )?(human|person|agent|manager)|real person|call me/,
  /remise|negocier|baisser le prix|dernier prix|meilleur prix|avocat|juridique|contrat|plainte|rembours|arnaque|parler (a|avec) (un|une|quelqu)|un humain|appelez.?moi|rappelez.?moi/,
  /خصم|تفاوض|تخفيض|اخر سعر|افضل سعر|اقل سعر|محامي|قانون|عقد|شكوي|استرداد|نصب|احتيال|اتكلم مع|ابغي موظف|ابي موظف|كلمني|اتصل بي|مدير/,
]
export const wantsHuman = (text: string): boolean => { const t = norm(text); return HANDOFF.some((re) => re.test(t)) }

export type GuardCtx = { config: AgentConfig; optedOut: boolean; isOwner: boolean; text: string; autoRepliesToday: number; humanRepliedRecently: boolean }
export type GuardResult = { ok: true } | { ok: false; reason: 'disabled' | 'opted_out' | 'owner' | 'empty' | 'media' | 'human_active' | 'limit' | 'handoff' }
export function guard(c: GuardCtx): GuardResult {
  if (!c.config.auto_reply) return { ok: false, reason: 'disabled' }
  if (c.optedOut) return { ok: false, reason: 'opted_out' }
  if (c.isOwner) return { ok: false, reason: 'owner' }                    // jamais avec un proprietaire
  if (!c.text.trim()) return { ok: false, reason: 'empty' }
  if (/^\[(image|video|audio|document|sticker|location|contact|message)\]/.test(c.text.trim())) return { ok: false, reason: 'media' } // un fichier ou un vocal : un humain regarde
  if (c.humanRepliedRecently) return { ok: false, reason: 'human_active' } // un agent a deja repondu : l'IA se tait
  if (wantsHuman(c.text)) return { ok: false, reason: 'handoff' }
  if (c.autoRepliesToday >= c.config.max_replies) return { ok: false, reason: 'limit' }
  return { ok: true }
}

// Qualification sans IA : ce que le client a deja dit (budget, zone, chambres, type, achat / location) lu dans ses messages
export type Qual = { budget?: number; beds?: number; area?: string; type?: string; listing?: 'sale' | 'rent' }
export function qualify(clientTexts: string[], areas?: string[]): { query: Query; qual: Qual; missing: ('listing' | 'type' | 'area' | 'budget' | 'beds')[] } {
  const query = parseSearch(clientTexts.join(' . '), areas)
  const qual: Qual = { budget: query.maxPrice, beds: query.minBeds, area: query.area, type: query.type, listing: query.listing }
  const missing = (['listing', 'type', 'area', 'budget', 'beds'] as const).filter((k) => (k === 'budget' ? !qual.budget : k === 'beds' ? !qual.beds : !qual[k]))
  return { query, qual, missing }
}

// Complete le lead avec ce que le client a dit, SANS ecraser ce que l'agent a deja saisi
export function leadPatchFromQual(lead: Pick<Lead, 'budget' | 'beds_wanted' | 'interest'>, q: Qual): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (!lead.budget && q.budget) p.budget = q.budget
  if (!lead.beds_wanted && q.beds) p.beds_wanted = q.beds
  if (!String(lead.interest ?? '').trim() && (q.type || q.area)) p.interest = [q.type, q.area].filter(Boolean).join(' - ')
  return p
}

export const langOf = (text: string, fallback: PolicyLang = 'en'): PolicyLang => pickLang(text, fallback)
const LANG_NAME: Record<PolicyLang, string> = { en: 'English', fr: 'French', ar: 'Arabic (Modern Standard)' }

export function buildAgentPrompt(o: { agency: string; lang: PolicyLang; thread: Pick<Message, 'direction' | 'body'>[]; props: Property[]; missing: string[] }): string {
  const list = o.props.slice(0, 4).map((p) => `- ${p.title} | ${p.area} | ${p.beds} bed | ${qar(p.price)}${p.listing === 'rent' ? ' per month' : ''} | ${propRef(p.id)}`).join('\n') || '(no matching property in the database)'
  return `You are the virtual assistant of ${o.agency}, a real estate agency in Qatar. You talk to a client on WhatsApp.
STRICT RULES:
- Use ONLY the properties listed below. Never invent a property, a price, a discount, an availability, a date or a promise.
- Never give owner names, owner phone numbers, addresses of owners, e-mails, web links or any phone number.
- Never negotiate a price or give legal advice: say an agent will take over.
- Reply in ${LANG_NAME[o.lang]}, in at most 3 short sentences (under 450 characters), warm and professional, plain text.
- If criteria are missing (${o.missing.join(', ') || 'none'}), ask for ONE of them. If matching properties exist, mention at most 2 with their reference.
- End by saying one of our agents will follow up personally.

PROPERTIES FROM THE DATABASE:
${list}

CONVERSATION (latest last):
${o.thread.slice(-8).map((m) => `${m.direction === 'in' ? 'Client' : 'Agency'}: ${m.body.slice(0, 400)}`).join('\n')}

Write only the next reply of the agency.`
}

// Controle de la reponse AVANT envoi : pas de lien, e-mail ni numero de telephone ; pas de proprietaire ; aucun montant qui ne soit pas dans les donnees.
export function validateReply(reply: string, o: { allowedPrices: number[]; clientText: string }): { ok: true } | { ok: false; reason: string } {
  const r = reply.trim()
  if (!r) return { ok: false, reason: 'empty' }
  if (r.length > 700) return { ok: false, reason: 'too_long' }
  if (/https?:\/\/|www\.|@[\w-]+\.\w/i.test(r)) return { ok: false, reason: 'link' }
  if (/\+?\d[\d\s().-]{7,}\d/.test(r.replace(/REF-[0-9A-F]{8}/gi, ''))) return { ok: false, reason: 'phone' }
  if (/\b(owner|landlord)\b|propri[eé]taire|\bمالك\b|صاحب العقار/i.test(r)) return { ok: false, reason: 'owner' }
  const known = new Set<number>([...o.allowedPrices, ...(o.clientText.replace(/[,\s]/g, '').match(/\d{4,}/g) ?? []).map(Number)])
  for (const m of r.replace(/REF-[0-9A-F]{8}/gi, '').replace(/(\d)[,\s](?=\d{3}\b)/g, '$1').matchAll(/\d{4,}/g)) if (!known.has(Number(m[0]))) return { ok: false, reason: 'unknown_amount' }
  return { ok: true }
}

export const AGENT_REASON_KEYS = ['disabled', 'opted_out', 'owner', 'empty', 'media', 'human_active', 'limit', 'handoff'] as const
export { matchProperties }
