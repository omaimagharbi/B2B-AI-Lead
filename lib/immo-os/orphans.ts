import type { Lead } from './types'

// Lead orphelin = actif ET (sans agent OU agent absent de l'equipe actuelle : agent retire / parti).
// Meme regle que le serveur (reminders.ts / api/reassign.ts). Si l'equipe n'est pas chargee, on ne declare personne orphelin.
const norm = (x?: string | null) => String(x ?? '').trim().toLowerCase()
export const isActiveLead = (l: Pick<Lead, 'status'>) => !['won', 'lost'].includes(l.status)
export function orphanLeadsOf(leads: Lead[], activeAgents: string[]): Lead[] {
  if (!activeAgents.length) return []
  const known = new Set(activeAgents.map(norm))
  return leads.filter((l) => isActiveLead(l) && (!l.agent || !known.has(norm(l.agent))))
}
export const isOrphan = (l: Lead, activeAgents: string[]) => !!activeAgents.length && (!l.agent || !activeAgents.map(norm).includes(norm(l.agent)))

// Repartition proposee des leads orphelins : chaque lead va a l'agent le MOINS charge (leads actifs), un par un.
export function suggestSplit(orphans: Lead[], activeAgents: string[], allLeads: Lead[]): { lead: Lead; to: string }[] {
  if (!activeAgents.length) return []
  const load = new Map(activeAgents.map((a) => [a, allLeads.filter((l) => isActiveLead(l) && norm(l.agent) === norm(a)).length]))
  const first = [...orphans].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0)) // les plus gros budgets en premier
  return first.map((lead) => {
    const to = [...load.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0]
    load.set(to, (load.get(to) ?? 0) + 1)
    return { lead, to }
  })
}
