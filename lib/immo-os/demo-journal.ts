import type { Activity, Assignment, Data, Entity } from './types'

// Mode demo : reproduit en local ce que le serveur fait dans api/entity.ts et api/reassign.ts (journal + historique d'affectation).
// En mode reel, RIEN de ceci n'est utilise : le journal est alimente cote serveur.
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2))
const labelOf = (r: any): string => String(r?.name ?? r?.title ?? r?.contact_name ?? r?.party_name ?? '').trim()
export type DemoActor = { id: string; name: string; role: string }

export function demoLog(d: Data, who: DemoActor, e: { action: string; entity?: string; record?: any; details?: Record<string, any>; label?: string }): Data {
  const row: Activity = { id: uid(), actor_id: who.id, actor_name: who.name, actor_role: who.role, action: e.action, entity: e.entity ?? null, record_id: e.record?.id ?? null, label: e.label ?? labelOf(e.record), details: e.details ?? {}, created_at: new Date().toISOString() }
  return { ...d, activity: [row, ...(d.activity ?? [])].slice(0, 300) }
}
export function demoAssign(d: Data, who: DemoActor, x: { lead: any; from?: string | null; to?: string | null; reason: string }): Data {
  const row: Assignment = { id: uid(), lead_id: x.lead.id, lead_name: x.lead.name, from_agent: x.from || null, to_agent: x.to || null, by_name: who.name, reason: x.reason, created_at: new Date().toISOString() }
  return { ...d, assignments: [row, ...(d.assignments ?? [])].slice(0, 500) }
}
// Champs dont la valeur a change (noms seulement)
export const changedFields = (before: any, patch: Record<string, any>) => Object.keys(patch).filter((k) => k !== 'photos' && JSON.stringify(before?.[k] ?? null) !== JSON.stringify(patch[k] ?? null))
export const SCOPED_ENTITIES: Entity[] = ['leads', 'clients', 'deals', 'visits']
