import type { DealStatus, PropStatus, Listing } from './types'

// n°48 / n°86 : parcours guide d'un deal. Fonctions pures : le MEME calcul est utilise par le serveur (api/deal-steps.ts)
// et par le mode demo (store.tsx), pour que les deux se comportent pareil.
export const DEAL_FLOW: DealStatus[] = ['negotiation', 'offer', 'contract', 'closed']
export const nextStep = (s: DealStatus): DealStatus | null => { const i = DEAL_FLOW.indexOf(s); return i >= 0 && i < DEAL_FLOW.length - 1 ? DEAL_FLOW[i + 1] : null }
export const stepIndex = (s: DealStatus) => DEAL_FLOW.indexOf(s)

export type TaskPlan = { category: 'followup' | 'signing'; inDays: number; hour: number; marker: string; noteKey: string }
export type DealPlan = {
  auto: string[]                                        // codes affiches dans l'historique (traduits par l'ecran)
  tasks: TaskPlan[]                                     // taches creees dans le calendrier (re_visits)
  propertyStatus: PropStatus | null                     // nouveau statut du bien lie
  leadWon: boolean                                      // le lead de ce client passe en "won"
}
export type DealInfo = { id: string; kind: Listing }
export type PlanCtx = { propertyStatus?: PropStatus | null; leadActive?: boolean; existingMarkers?: Set<string> }

export const taskMarker = (dealId: string, to: DealStatus) => `[auto:deal:${dealId}:${to}]`

export function planDealTransition(deal: DealInfo, from: DealStatus | null, to: DealStatus, ctx: PlanCtx = {}): DealPlan {
  const plan: DealPlan = { auto: [], tasks: [], propertyStatus: null, leadWon: false }
  if (from === to) return plan
  const mk = taskMarker(deal.id, to)
  const addTask = (t: Omit<TaskPlan, 'marker'>) => { if (!ctx.existingMarkers?.has(mk)) { plan.tasks.push({ ...t, marker: mk }); plan.auto.push(`task_${to}`) } }
  if (to === 'negotiation') addTask({ category: 'followup', inDays: 1, hour: 10, noteKey: 'ds.task.negotiation' })
  if (to === 'offer') addTask({ category: 'followup', inDays: 2, hour: 10, noteKey: 'ds.task.offer' })
  if (to === 'contract') addTask({ category: 'signing', inDays: 7, hour: 11, noteKey: 'ds.task.contract' })

  const ps = ctx.propertyStatus ?? null
  if (to === 'contract' && ps === 'available') { plan.propertyStatus = 'reserved'; plan.auto.push('property_reserved') }
  else if (to === 'closed' && ps && ps !== (deal.kind === 'rent' ? 'rented' : 'sold')) { plan.propertyStatus = deal.kind === 'rent' ? 'rented' : 'sold'; plan.auto.push(deal.kind === 'rent' ? 'property_rented' : 'property_sold') }
  else if ((to === 'cancelled' || to === 'negotiation' || to === 'offer') && ps === 'reserved') { plan.propertyStatus = 'available'; plan.auto.push('property_released') }
  if (to === 'closed' && ctx.leadActive) { plan.leadWon = true; plan.auto.push('lead_won') }
  return plan
}

// Date d'une tache : jour J+inDays a l'heure locale `hour` (decalage UTC de l'agence : Qatar = +3).
export function taskDate(now: number, inDays: number, hour: number, utcOffsetHours: number): string {
  const d = new Date(now + inDays * 86400000)
  d.setUTCHours(hour - utcOffsetHours, 0, 0, 0)
  return d.toISOString()
}
