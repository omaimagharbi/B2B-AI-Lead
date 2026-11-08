import type { Data, Deal, Lead, StageEvent, Visit } from './types'
import { planDealTransition, taskDate, taskMarker } from './deal-flow'
import { uid } from './helpers'

// Mode demo : memes regles que le serveur (api/deal-steps.ts), appliquees aux donnees locales du navigateur.
export const demoStage = (d: Data, kind: 'lead' | 'deal', rec: { id: string; name?: string; title?: string }, from: string | null, to: string, by: string, auto: string[] = []): Data => {
  const ev: StageEvent = { id: uid(), kind, record_id: rec.id, record_name: rec.name ?? rec.title ?? '', from_status: from, to_status: to, by_name: by, auto, created_at: new Date().toISOString() }
  return { ...d, stages: [ev, ...(d.stages ?? [])] }
}

export function demoDealTransition(d: Data, deal: Deal, from: Deal['status'] | null, by: string, tr: (k: string) => string): Data {
  if (from === deal.status) return d
  const prop = d.properties.find((p) => p.id === deal.property_id)
  const lead = deal.party_name ? d.leads.find((l) => l.name.trim().toLowerCase() === deal.party_name!.trim().toLowerCase() && ['new', 'qualified', 'viewing', 'negotiation'].includes(l.status)) : undefined
  const mk = taskMarker(deal.id, deal.status)
  const plan = planDealTransition({ id: deal.id, kind: deal.kind }, from, deal.status, { propertyStatus: prop?.status ?? null, leadActive: !!lead, existingMarkers: new Set(d.visits.some((v) => (v.notes ?? '').includes(mk)) ? [mk] : []) })
  let n: Data = { ...d }
  const off = -new Date().getTimezoneOffset() / 60
  const visits: Visit[] = plan.tasks.map((t) => ({ id: uid(), category: t.category, property_id: deal.property_id ?? null, lead_id: lead?.id ?? null, contact_name: deal.party_name || deal.title, contact_phone: null, agent: deal.agent ?? null, starts_at: taskDate(Date.now(), t.inDays, t.hour, off), duration_min: 30, status: 'scheduled', notes: `${tr(t.noteKey)} ${t.marker}`, calendar_event_id: null, created_at: new Date().toISOString() }))
  if (visits.length) n = { ...n, visits: [...visits, ...n.visits] }
  if (plan.propertyStatus && prop) n = { ...n, properties: n.properties.map((p) => (p.id === prop.id ? { ...p, status: plan.propertyStatus! } : p)) }
  if (plan.leadWon && lead) { n = { ...n, leads: n.leads.map((l) => (l.id === lead.id ? { ...l, status: 'won' } as Lead : l)) }; n = demoStage(n, 'lead', lead, null, 'won', by, ['deal_closed']) }
  return demoStage(n, 'deal', deal, from, deal.status, by, plan.auto.filter((c) => c !== 'lead_won' || true))
}
