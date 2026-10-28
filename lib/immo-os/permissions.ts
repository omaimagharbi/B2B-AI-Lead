import type { Entity } from './types'

// Roles PiloBrain : proprietaire / admin / directeur_commercial = gestionnaires ; membre = agent.
export const MANAGER_ROLES = ['proprietaire', 'admin', 'directeur_commercial']
export const isManager = (role: string | null | undefined) => !!role && MANAGER_ROLES.includes(role)

export type Viewer = { role: string; name: string }
// Entites dont chaque ligne est rattachee a un agent (colonne "agent") : un agent ne voit/modifie que les siennes.
const AGENT_SCOPED: Entity[] = ['leads', 'clients', 'deals', 'visits']
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

export function filterForViewer<T extends Partial<Record<Entity, any[]>>>(data: T, v: Viewer): T {
  if (isManager(v.role)) return data
  const out: any = { ...data }
  for (const e of AGENT_SCOPED) if (out[e]) out[e] = out[e].filter((r: any) => same(r.agent, v.name))
  out.owners = [] // coordonnees des proprietaires : reservees aux gestionnaires
  if (out.messages) {
    const mine = new Set<string>([...(out.leads ?? []), ...(out.clients ?? [])].map((r: any) => String(r.name).trim().toLowerCase()))
    out.messages = out.messages.filter((m: any) => mine.has(String(m.contact_name).trim().toLowerCase()))
  }
  return out
}

export function canWrite(entity: Entity, op: 'create' | 'update' | 'delete', v: Viewer, existing?: { agent?: string | null } | null): boolean {
  if (isManager(v.role)) return true
  if (op === 'delete') return false
  if (entity === 'owners') return false
  if (op === 'update' && AGENT_SCOPED.includes(entity)) return same(existing?.agent, v.name)
  return true
}
