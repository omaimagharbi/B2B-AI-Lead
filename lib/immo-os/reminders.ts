import { digits, sameNumber } from './inbound-pure'

export type RLead = { id: string; client_id: string; name: string; status: string; agent: string | null; last_contact: string; reminded_at: string | null }
export type RMember = { client_id: string; nom_complet: string | null; telephone: string | null }
export type RAgency = { id: string; nom_entreprise: string | null; whatsapp_directeur: string | null }
export type RMessage = { clientId: string; to: string; text: string; leadIds: string[] }

export const ACTIVE_STATUSES = ['new', 'qualified', 'viewing', 'negotiation']
const H = 3600000
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
const days = (iso: string, now: number) => Math.max(2, Math.floor((now - new Date(iso).getTime()) / (24 * H)))

// Un lead est "du" pour un rappel s'il est actif, sans contact depuis staleHours, et pas deja relance pour cette periode
// de silence (nouveau rappel seulement s'il y a eu un contact depuis, ou apres repeatAfterHours).
export function dueLeads(leads: RLead[], now: number, staleHours = 48, repeatAfterHours = 72): RLead[] {
  return leads
    .filter((l) => ACTIVE_STATUSES.includes(l.status) && now - new Date(l.last_contact).getTime() >= staleHours * H)
    .filter((l) => !l.reminded_at || new Date(l.reminded_at).getTime() < new Date(l.last_contact).getTime() || now - new Date(l.reminded_at).getTime() >= repeatAfterHours * H)
    .sort((a, b) => a.last_contact.localeCompare(b.last_contact))
}

const line = (l: RLead, now: number) => `${l.name} (${days(l.last_contact, now)} days)`

export function planReminders(due: RLead[], members: RMember[], agencies: RAgency[], now: number, maxPerAgent = 8, maxDigest = 10): RMessage[] {
  const out: RMessage[] = []
  for (const ag of agencies) {
    const mine = due.filter((l) => l.client_id === ag.id)
    if (!mine.length) continue
    const dirDigits = digits(ag.whatsapp_directeur ?? '')
    const people = members.filter((m) => m.client_id === ag.id)
    // 1) chaque agent : ses propres leads
    const byAgent = new Map<string, RLead[]>()
    for (const l of mine) if (l.agent) byAgent.set(l.agent.trim().toLowerCase(), [...(byAgent.get(l.agent.trim().toLowerCase()) ?? []), l])
    const reminded = new Set<string>()
    for (const [key, ls] of byAgent) {
      const m = people.find((p) => same(p.nom_complet, key))
      const phone = digits(m?.telephone ?? '')
      if (phone.length < 8 || sameNumber(m?.telephone, ag.whatsapp_directeur)) continue // pas de numero, ou c'est le directeur (il recoit le recap)
      const shown = ls.slice(0, maxPerAgent)
      out.push({ clientId: ag.id, to: m!.telephone!, leadIds: shown.map((l) => l.id), text: `Reminder: ${ls.length} lead${ls.length > 1 ? 's are' : ' is'} waiting for your follow-up - ${shown.map((l) => line(l, now)).join(', ')}${ls.length > shown.length ? ` and ${ls.length - shown.length} more` : ''}. Open PiloBrain Real Estate to reply.` })
      shown.forEach((l) => reminded.add(l.id))
    }
    // 2) directeur : recap de tout ce qui est en retard (y compris les leads sans agent)
    if (dirDigits.length >= 8) {
      const shown = mine.slice(0, maxDigest)
      out.push({ clientId: ag.id, to: ag.whatsapp_directeur!, leadIds: shown.map((l) => l.id), text: `Daily follow-up check${ag.nom_entreprise ? ` - ${ag.nom_entreprise}` : ''}: ${mine.length} lead${mine.length > 1 ? 's' : ''} without contact for 48h+. ${shown.map((l) => `${line(l, now)}${l.agent ? ` - ${l.agent}` : ' - unassigned'}`).join('; ')}${mine.length > shown.length ? `; and ${mine.length - shown.length} more` : ''}.` })
    }
  }
  return out
}
