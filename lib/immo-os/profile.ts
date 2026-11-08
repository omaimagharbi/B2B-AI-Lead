import type { Assignment, Deal, Message, Outcome, Send, StageEvent, Visit } from './types'
import { sameNumber } from './inbound-pure'

// n°98 : fiche client complete. Assemble tout ce que l'on sait d'un contact en une seule chronologie (fonction pure).
export type ContactRef = { name: string; phone?: string | null }
const norm = (s?: string | null) => String(s ?? '').trim().toLowerCase()
export const sameContact = (c: ContactRef, name?: string | null, phone?: string | null) => (!!norm(name) && norm(name) === norm(c.name)) || sameNumber(c.phone, phone)

export type TimelineKind = 'message' | 'visit' | 'deal' | 'stage' | 'outcome' | 'send' | 'assign'
export type TimelineItem = { id: string; at: string; kind: TimelineKind; key: string; vars: Record<string, string | number>; text?: string; by?: string | null; auto?: string[] }

export type ProfileInput = {
  contact: ContactRef
  messages: Message[]; visits: Visit[]; deals: Deal[]; stages: StageEvent[]; outcomes: Outcome[]; sends: Send[]; assignments: Assignment[]
  propertyName: (id?: string | null) => string
}

export function buildTimeline(x: ProfileInput): TimelineItem[] {
  const out: TimelineItem[] = []
  for (const m of x.messages.filter((m) => sameContact(x.contact, m.contact_name, m.contact_phone)))
    out.push({ id: `m${m.id}`, at: m.created_at, kind: 'message', key: m.direction === 'in' ? 'pf.ev.msg_in' : 'pf.ev.msg_out', vars: {}, text: m.body.slice(0, 160) })
  for (const v of x.visits.filter((v) => sameContact(x.contact, v.contact_name, v.contact_phone)))
    out.push({ id: `v${v.id}`, at: v.starts_at, kind: 'visit', key: `pf.ev.visit_${v.status}`, vars: { prop: x.propertyName(v.property_id) }, by: v.agent })
  for (const d of x.deals.filter((d) => sameContact(x.contact, d.party_name, null)))
    out.push({ id: `d${d.id}`, at: d.created_at, kind: 'deal', key: 'pf.ev.deal', vars: { title: d.title } , by: d.agent })
  const dealIds = new Set(x.deals.filter((d) => sameContact(x.contact, d.party_name, null)).map((d) => d.id))
  for (const s of x.stages.filter((s) => (s.kind === 'deal' && dealIds.has(s.record_id)) || (s.kind === 'lead' && norm(s.record_name) === norm(x.contact.name))))
    out.push({ id: `s${s.id}`, at: s.created_at, kind: 'stage', key: s.from_status ? 'pf.ev.stage' : 'pf.ev.stage_new', vars: { what: s.kind, name: s.record_name ?? '', from: s.from_status ?? '', to: s.to_status }, by: s.by_name, auto: Array.isArray(s.auto) ? s.auto : [] })
  for (const o of x.outcomes.filter((o) => sameContact(x.contact, o.contact_name, o.contact_phone)))
    out.push({ id: `o${o.id}`, at: o.created_at, kind: 'outcome', key: 'pf.ev.outcome', vars: { outcome: o.outcome }, text: o.note ?? undefined, by: o.agent })
  for (const s of x.sends.filter((s) => sameContact(x.contact, s.contact_name, s.contact_phone)))
    out.push({ id: `p${s.id}`, at: s.created_at, kind: 'send', key: 'pf.ev.send', vars: { prop: s.property_title || x.propertyName(s.property_id) }, by: s.agent })
  for (const a of x.assignments)
    out.push({ id: `a${a.id}`, at: a.created_at, kind: 'assign', key: 'pf.ev.assign', vars: { from: a.from_agent ?? '', to: a.to_agent ?? '', reason: a.reason ?? '' }, by: a.by_name })
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

// Qui a traite ce client : agents cites dans les affectations, les etapes, les resultats, les envois et les visites, avec le nombre d'interventions.
export function handledBy(items: TimelineItem[], currentAgents: (string | null | undefined)[]): { name: string; actions: number; last: string; current: boolean }[] {
  const m = new Map<string, { name: string; actions: number; last: string; current: boolean }>()
  const touch = (name: string | null | undefined, at: string, cur = false) => {
    const k = norm(name)
    if (!k) return
    const e = m.get(k) ?? { name: String(name).trim(), actions: 0, last: at, current: false }
    if (!cur) e.actions++
    if (at > e.last) e.last = at
    if (cur) e.current = true
    m.set(k, e)
  }
  for (const it of items) { if (it.kind === 'assign') { touch(it.vars.to as string, it.at); } else if (it.by) touch(it.by, it.at) }
  for (const a of currentAgents) touch(a, new Date(0).toISOString(), true)
  return Array.from(m.values()).sort((a, b) => Number(b.current) - Number(a.current) || b.actions - a.actions)
}
