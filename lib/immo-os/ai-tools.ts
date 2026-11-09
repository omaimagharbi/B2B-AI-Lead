import type { Data, Deal, Lead, Message, Property } from './types'
import { parseSearch } from './helpers'

// Lot 7 : outils de l'AI Real Estate Agent calcules SANS IA (gratuits, instantanes) ; l'IA n'est appelee que sur demande, pour rediger.
const H = 3600000
const norm = (x?: string | null) => String(x ?? '').trim().toLowerCase()

// ---- n°29 / n°84 : qualite d'une conversation (note /100, expliquee)
export type QualityFlag = 'slow' | 'unanswered' | 'no_next_step' | 'too_short' | 'too_long' | 'no_reply'
export type Quality = { score: number; parts: { speed: number; coverage: number; followup: number; clarity: number }; flags: QualityFlag[]; replies: number; medianMin: number | null }
export function scoreConversation(msgs: Pick<Message, 'direction' | 'body' | 'created_at'>[], now = Date.now()): Quality {
  const s = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const waits: number[] = []
  let open: number | null = null, turns = 0, answered = 0
  for (const m of s) {
    const t = new Date(m.created_at).getTime()
    if (m.direction === 'in') { if (open === null) { open = t; turns++ } }
    else if (open !== null) { waits.push((t - open) / 60000); answered++; open = null }
  }
  const flags: QualityFlag[] = []
  const out = s.filter((m) => m.direction === 'out')
  if (!turns) return { score: 0, parts: { speed: 0, coverage: 0, followup: 0, clarity: 0 }, flags: [], replies: out.length, medianMin: null }
  const sorted = [...waits].sort((a, b) => a - b)
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null
  // vitesse (40) : mediane des delais de reponse
  const speed = median === null ? 0 : median <= 15 ? 40 : median <= 60 ? 32 : median <= 240 ? 20 : median <= 1440 ? 8 : 0
  if (median === null) flags.push('no_reply'); else if (median > 240) flags.push('slow')
  // couverture (25) : part des messages du client qui ont recu une reponse
  const coverage = Math.round((answered / turns) * 25)
  // suivi (15) : pas de message client sans reponse depuis plus de 24 h
  const pending = open !== null && now - open > 24 * H
  if (pending) flags.push('unanswered')
  const followup = pending ? 0 : 15
  // clarte (20) : reponses ni trop courtes ni trop longues, avec une prochaine etape (question, visite, appel)
  let clarity = 0
  if (out.length) {
    const avg = out.reduce((n, m) => n + m.body.length, 0) / out.length
    const lenOk = avg >= 25 && avg <= 600
    if (!lenOk) flags.push(avg < 25 ? 'too_short' : 'too_long')
    const next = out.some((m) => /\?|؟|visit|viewing|call|appel|rendez|visite|معاينة|موعد|اتصال/i.test(m.body))
    if (!next) flags.push('no_next_step')
    clarity = (lenOk ? 10 : 4) + (next ? 10 : 0)
  }
  return { score: Math.max(0, Math.min(100, speed + coverage + followup + clarity)), parts: { speed, coverage, followup, clarity }, flags, replies: out.length, medianMin: median === null ? null : Math.round(median) }
}

// ---- n°87 : dispatch (quel agent recoit le lead). Regles transparentes : charge, connaissance de la zone, reactivite.
export type DispatchSuggestion = { agent: string; score: number; load: number; areaFit: number; closed: number }
export function dispatchSuggestions(lead: Pick<Lead, 'interest' | 'property_id' | 'name'>, data: Pick<Data, 'leads' | 'deals' | 'clients' | 'properties'>, activeAgents: string[], areas?: string[]): DispatchSuggestion[] {
  const prop = data.properties.find((p) => p.id === lead.property_id)
  const area = prop?.area ?? parseSearch(String(lead.interest ?? ''), areas).area
  const areaOf = (l: Lead) => data.properties.find((p) => p.id === l.property_id)?.area ?? parseSearch(String(l.interest ?? ''), areas).area
  return activeAgents.map((agent) => {
    const mine = data.leads.filter((l) => norm(l.agent) === norm(agent))
    const load = mine.filter((l) => ['new', 'qualified', 'viewing', 'negotiation'].includes(l.status)).length
    const areaFit = area ? mine.filter((l) => areaOf(l) === area).length : 0
    const closed = data.deals.filter((d) => norm(d.agent) === norm(agent) && d.status === 'closed').length
    return { agent, load, areaFit, closed, score: Math.round(100 - load * 6 + Math.min(areaFit, 5) * 8 + Math.min(closed, 5) * 3) }
  }).sort((a, b) => b.score - a.score || a.load - b.load || a.agent.localeCompare(b.agent))
}

// ---- n°87 : faits de negociation (calcules, sans IA) ; l'IA ne fait que les mettre en phrases
export type NegotiationBrief = { listPrice: number | null; offer: number; gapPct: number | null; medianPerM2: number | null; offerPerM2: number | null; counterMin: number | null; counterMax: number | null; daysInStage: number | null }
export function negotiationBrief(deal: Pick<Deal, 'value' | 'status' | 'created_at'>, prop: Property | undefined, all: Property[], lastStageAt?: string | null, now = Date.now()): NegotiationBrief {
  const list = prop?.price ?? null
  const offer = Number(deal.value) || 0
  const comps = prop ? all.filter((p) => p.id !== prop.id && p.area === prop.area && p.type === prop.type && p.listing === prop.listing && p.size_m2 > 0 && p.price > 0) : []
  const ppm = comps.map((p) => p.price / p.size_m2).sort((a, b) => a - b)
  const median = ppm.length ? ppm[Math.floor(ppm.length / 2)] : null
  const gap = list && offer ? Math.round(((list - offer) / list) * 1000) / 10 : null
  // contre-offre : entre l'offre et 97 % du prix affiche (jamais au-dessus du prix affiche)
  const counterMin = list && offer && offer < list ? Math.round(offer + (list - offer) * 0.4) : null
  const counterMax = list && offer && offer < list ? Math.round(Math.min(list, list * 0.97)) : null
  return { listPrice: list, offer, gapPct: gap, medianPerM2: median ? Math.round(median) : null, offerPerM2: prop?.size_m2 && offer ? Math.round(offer / prop.size_m2) : null, counterMin, counterMax: counterMax && counterMin && counterMax < counterMin ? counterMin : counterMax, daysInStage: Math.floor((now - new Date(lastStageAt ?? deal.created_at).getTime()) / (24 * H)) }
}
