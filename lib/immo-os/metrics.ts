import type { Data, Lead } from './types'

// Indicateurs par agent (lot 3). Fonctions pures : meme calcul pour le manager (tous les agents) et pour l'agent
// (ses donnees sont deja filtrees cote serveur par api/all.ts : il ne voit que ses leads, clients, deals, visites et conversations).
export const H = 3600000
export const FOLLOWUP_HOURS = 48          // un lead actif sans contact depuis 48 h = "sans suivi" (meme seuil que le cron de rappels)
export const RISK = { silentHours: 120, coolingHours: 72, stuckNewHours: 72 } as const
export type RiskReason = 'orphan' | 'silent' | 'cooling' | 'stuck_new'
const ACTIVE = ['new', 'qualified', 'viewing', 'negotiation']
const norm = (x?: string | null) => String(x ?? '').trim().toLowerCase()
const same = (a?: string | null, b?: string | null) => !!norm(a) && norm(a) === norm(b)
const median = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

export type AgentMetrics = {
  agent: string
  conversations: number; unanswered: number
  replyMedianMin: number | null; repliedWithinHourPct: number | null
  visitsDone: number; visitsPlanned: number
  activeLeads: number; followed: number; noFollowUp: number; followUpPct: number | null
  relancesToday: number; offers: number; closedDeals: number
  atRisk: number
  chatThreads: number; chatToVisit: number; chatToVisitPct: number | null
  weekPoints: number; weekDeals: number; weekVisits: number; weekConv: number
}
export type RiskLead = { lead: Lead; reasons: RiskReason[]; idleDays: number }

export function riskReasons(l: Lead, now: number, activeAgents: string[]): RiskReason[] {
  if (!ACTIVE.includes(l.status)) return []
  const out: RiskReason[] = []
  const idleH = (now - new Date(l.last_contact).getTime()) / H
  if (activeAgents.length && (!l.agent || !activeAgents.some((a) => same(a, l.agent)))) out.push('orphan')
  if (idleH >= RISK.silentHours) out.push('silent')
  else if (['viewing', 'negotiation'].includes(l.status) && idleH >= RISK.coolingHours) out.push('cooling')
  if (l.status === 'new' && (now - new Date(l.created_at).getTime()) / H >= RISK.stuckNewHours && idleH >= RISK.stuckNewHours) out.push('stuck_new')
  return out
}
export function riskLeads(leads: Lead[], now: number, activeAgents: string[]): RiskLead[] {
  return leads
    .map((lead) => ({ lead, reasons: riskReasons(lead, now, activeAgents), idleDays: Math.floor((now - new Date(lead.last_contact).getTime()) / (24 * H)) }))
    .filter((r) => r.reasons.length)
    .sort((a, b) => b.reasons.length - a.reasons.length || b.idleDays - a.idleDays)
}

type Turn = { at: number; replyAt: number | null }
// Un "tour" = un message client sans reponse de notre part entre-temps ; sa reponse = le prochain message sortant du meme contact.
function turnsOf(msgs: { direction: string; created_at: string }[]): Turn[] {
  const s = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const out: Turn[] = []
  let open: Turn | null = null
  for (const m of s) {
    const t = new Date(m.created_at).getTime()
    if (m.direction === 'in') { if (!open) { open = { at: t, replyAt: null }; out.push(open) } }
    else if (open) { open.replyAt = t; open = null }
  }
  return out
}

export function computeMetrics(data: Data, agents: string[], opts: { now?: number; days?: number } = {}): Record<string, AgentMetrics> {
  const now = opts.now ?? Date.now()
  const days = opts.days ?? 7
  const from = now - days * 24 * H
  const week = now - 7 * 24 * H
  // Rattachement d'une conversation a un agent : via le lead, sinon le client portant le meme nom
  const agentOfContact = (name: string) => data.leads.find((l) => same(l.name, name))?.agent ?? data.clients.find((c) => same(c.name, name))?.agent ?? null
  const threads = new Map<string, { agent: string | null; msgs: Data['messages'] }>()
  for (const m of data.messages) {
    const k = norm(m.contact_name)
    const th = threads.get(k) ?? { agent: agentOfContact(m.contact_name), msgs: [] }
    th.msgs.push(m)
    threads.set(k, th)
  }
  const activeAgents = agents
  const res: Record<string, AgentMetrics> = {}
  for (const a of agents) {
    const mine = data.leads.filter((l) => same(l.agent, a))
    const active = mine.filter((l) => ACTIVE.includes(l.status))
    const followed = active.filter((l) => now - new Date(l.last_contact).getTime() <= FOLLOWUP_HOURS * H)
    const myThreads = Array.from(threads.values()).filter((t) => same(t.agent, a))
    const inWin = (iso: string, f = from) => new Date(iso).getTime() >= f
    const convIn = (f: number) => myThreads.filter((t) => t.msgs.some((m) => inWin(m.created_at, f)))
    const turns = myThreads.flatMap((t) => turnsOf(t.msgs)).filter((x) => x.at >= from)
    const answered = turns.filter((x) => x.replyAt !== null)
    const deltas = answered.map((x) => (x.replyAt! - x.at) / 60000)
    const unanswered = turns.filter((x) => x.replyAt === null && now - x.at > H).length
    const judged = answered.length + unanswered
    const myVisits = data.visits.filter((v) => same(v.agent, a))
    const viewings = myVisits.filter((v) => (v.category ?? 'viewing') === 'viewing')
    const chat = myThreads.filter((t) => t.msgs.some((m) => m.direction === 'in' && inWin(m.created_at)))
    const converted = chat.filter((t) => {
      const first = Math.min(...t.msgs.filter((m) => m.direction === 'in').map((m) => new Date(m.created_at).getTime()))
      const name = t.msgs[0].contact_name
      const lead = data.leads.find((l) => same(l.name, name))
      return viewings.some((v) => v.status !== 'cancelled' && (v.lead_id && lead ? v.lead_id === lead.id : same(v.contact_name, name)) && new Date(v.starts_at).getTime() >= first - 6 * H)
    })
    const closedIn = (f: number) => data.deals.filter((d) => same(d.agent, a) && d.status === 'closed' && new Date(d.closed_at ?? d.created_at).getTime() >= f)
    const visitsDoneIn = (f: number) => myVisits.filter((v) => v.status === 'done' && new Date(v.starts_at).getTime() >= f).length
    const wDeals = closedIn(week).length, wVisits = visitsDoneIn(week), wConv = convIn(week).length
    res[a] = {
      agent: a,
      conversations: convIn(from).length, unanswered,
      replyMedianMin: median(deltas) === null ? null : Math.round(median(deltas)!),
      repliedWithinHourPct: judged ? Math.round((deltas.filter((d) => d <= 60).length / judged) * 100) : null,
      visitsDone: visitsDoneIn(from), visitsPlanned: myVisits.filter((v) => v.status === 'scheduled' && new Date(v.starts_at).getTime() >= now).length,
      activeLeads: active.length, followed: followed.length, noFollowUp: active.length - followed.length,
      followUpPct: active.length ? Math.round((followed.length / active.length) * 100) : null,
      relancesToday: myVisits.filter((v) => v.status === 'scheduled' && ['followup', 'call'].includes(v.category ?? '') && sameDay(new Date(v.starts_at).getTime(), now)).length,
      offers: data.deals.filter((d) => same(d.agent, a) && d.status === 'offer').length,
      closedDeals: closedIn(from).length,
      atRisk: riskLeads(mine, now, activeAgents).length,
      chatThreads: chat.length, chatToVisit: converted.length, chatToVisitPct: chat.length ? Math.round((converted.length / chat.length) * 100) : null,
      // Meilleur employe de la semaine : 5 pts par vente conclue, 2 pts par visite effectuee, 1 pt par conversation active (7 derniers jours)
      weekDeals: wDeals, weekVisits: wVisits, weekConv: wConv, weekPoints: wDeals * 5 + wVisits * 2 + wConv,
    }
  }
  return res
}

// Meilleur de la semaine : le plus de points ; a egalite, la reponse la plus rapide. Null si personne n'a de point.
export function bestOfWeek(m: Record<string, AgentMetrics>): AgentMetrics | null {
  const list = Object.values(m).filter((x) => x.weekPoints > 0)
  list.sort((a, b) => b.weekPoints - a.weekPoints || (a.replyMedianMin ?? 1e9) - (b.replyMedianMin ?? 1e9) || a.agent.localeCompare(b.agent))
  return list[0] ?? null
}
export const fmtMinutes = (m: number | null, h = 'h', min = 'min'): string => (m === null ? '-' : m < 60 ? `${m} ${min}` : `${Math.floor(m / 60)}${h} ${String(m % 60).padStart(2, '0')}`)
