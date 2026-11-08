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
  const mine = new Set<string>([...(out.leads ?? []), ...(out.clients ?? [])].map((r: any) => String(r.name).trim().toLowerCase()))
  if (out.messages) out.messages = out.messages.filter((m: any) => mine.has(String(m.contact_name).trim().toLowerCase()))
  // Lot 4 : resultats de contact et biens envoyes suivent les conversations de l'agent ; l'historique d'etapes suit ses leads et deals
  if (out.outcomes) out.outcomes = out.outcomes.filter((m: any) => mine.has(String(m.contact_name).trim().toLowerCase()))
  if (out.sends) out.sends = out.sends.filter((m: any) => mine.has(String(m.contact_name).trim().toLowerCase()))
  if (out.stages) {
    const ids = new Set<string>([...(out.leads ?? []), ...(out.deals ?? [])].map((r: any) => String(r.id)))
    out.stages = out.stages.filter((s: any) => ids.has(String(s.record_id)))
  }
  return out
}

export function canWrite(entity: Entity, op: 'create' | 'update' | 'delete', v: Viewer, existing?: { agent?: string | null } | null): boolean {
  if (isManager(v.role)) return true
  if (op === 'delete') return false
  if (entity === 'owners' || entity === 'zones' || entity === 'hierarchy') return false // proprietaires et zones : gestionnaires seulement
  if (entity === 'sends' || entity === 'stages') return false // ecrits par le serveur uniquement
  if (entity === 'outcomes' && op !== 'create') return false // un resultat de contact se corrige en en ajoutant un nouveau
  if (op === 'update' && AGENT_SCOPED.includes(entity)) return same(existing?.agent, v.name)
  return true
}
