import { digits, sameNumber } from './inbound-pure'

// n°41 / n°81 : alerte "lead chaud, contactez-le maintenant". Logique pure ; l'envoi et l'anti-doublon sont dans api/hot-alerts.ts.
export const HOT_SCORE = 75                       // meme seuil que le badge "Hot" du kanban (helpers.ts : isHot)
export const HOT_ACTIVE = ['new', 'qualified', 'viewing', 'negotiation']
export const DEFAULT_PERIOD_HOURS = 72            // une alerte par lead et par periode de 72 h (variable IMMO_HOT_ALERT_PERIOD_HOURS)
export const DEFAULT_STALE_HOURS = 12             // le balayage quotidien ne relance que les leads chauds sans contact depuis 12 h

type L = { score: number; status: string }
export const isHotLead = (l: L | null | undefined): boolean => !!l && Number(l.score) >= HOT_SCORE && HOT_ACTIVE.includes(l.status)
// Declencheur immediat : le lead VIENT de devenir chaud (il ne l'etait pas avant l'ecriture)
export const becameHot = (before: L | null | undefined, after: L | null | undefined): boolean => isHotLead(after) && !isHotLead(before)

export const periodKey = (now: number, hours = DEFAULT_PERIOD_HOURS): number => Math.floor(now / (Math.max(1, hours) * 3600000))
export const readHours = (v: string | undefined, dflt: number) => { const n = Number(v); return Number.isFinite(n) && n >= 1 && n <= 24 * 30 ? n : dflt }

export type AlertLead = { id: string; client_id: string; name: string; phone?: string | null; interest?: string | null; budget?: number | null; score: number; status: string; agent: string | null; last_contact?: string | null; do_not_contact?: boolean | null }
export type AlertMember = { client_id: string; nom_complet: string | null; telephone: string | null }
export type AlertAgency = { id: string; nom_entreprise?: string | null; whatsapp_directeur: string | null; langue_preferee?: string | null }
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

// Destinataire : l'agent du lead s'il a un numero, sinon le directeur (lead sans agent, agent retire ou sans numero).
// Jamais d'alerte pour un lead "ne plus contacter" : on ne pousse pas l'agent a relancer quelqu'un qui a dit STOP.
export function alertRecipient(l: AlertLead, members: AlertMember[], agency: AlertAgency): string | null {
  if (l.do_not_contact) return null
  const m = members.find((x) => x.client_id === l.client_id && same(x.nom_complet, l.agent))
  if (m && digits(m.telephone ?? '').length >= 8) return m.telephone
  if (digits(agency.whatsapp_directeur ?? '').length >= 8) return agency.whatsapp_directeur
  return null
}

export function hotAlertText(tr: (k: string) => string, fmt: (t: string, v: Record<string, string | number>) => string, l: AlertLead, toDirector: boolean): string {
  const bits = [l.interest ? String(l.interest).slice(0, 80) : '', l.budget ? `QAR ${Math.round(Number(l.budget)).toLocaleString('en-US')}` : '', l.phone ?? ''].filter(Boolean).join(' · ')
  return fmt(tr(toDirector && l.agent ? 'hot.msg.dir' : 'hot.msg'), { name: l.name, score: Math.round(l.score), agent: l.agent ?? '-', info: bits ? ` ${bits}` : '' }).slice(0, 600)
}
export { sameNumber }
