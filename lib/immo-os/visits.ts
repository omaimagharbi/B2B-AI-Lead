import type { Visit } from './types'

const MIN = 60000
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

// Conflit : meme agent, visite non annulee, creneaux qui se chevauchent (la fin d'une visite = debut d'une autre est OK).
export function findConflict(visits: Visit[], agent: string | null | undefined, startIso: string, durationMin: number, excludeId?: string): Visit | null {
  if (!agent) return null
  const s = new Date(startIso).getTime()
  const e = s + durationMin * MIN
  if (Number.isNaN(s)) return null
  return visits.find((v) => v.id !== excludeId && v.status === 'scheduled' && same(v.agent, agent) && s < new Date(v.starts_at).getTime() + v.duration_min * MIN && new Date(v.starts_at).getTime() < e) ?? null
}

export function confirmationText(v: Pick<Visit, 'contact_name' | 'starts_at'>, propertyTitle: string | null, area: string | null, agentName: string | null): string {
  const d = new Date(v.starts_at)
  const date = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Qatar' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qatar' })
  const where = propertyTitle ? `${propertyTitle}${area ? `, ${area}` : ''}` : 'the property'
  return `Hello ${v.contact_name.split(' ')[0]}, your viewing of ${where} is confirmed for ${date} at ${time} (Qatar time).${agentName ? ` ${agentName} will meet you there.` : ''} Reply here if you need to change the time.`
}

// <input type="datetime-local"> <-> ISO (heure locale du navigateur)
export const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : '')
