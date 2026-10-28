import type { Data, Lead, Property, PropType } from './types'
import { AREAS } from './types'

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

export const qar = (n: number | null | undefined) => `QAR ${Math.round(Number(n) || 0).toLocaleString('en-US')}`
export const qarShort = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n))

export function ago(iso?: string | null): string {
  if (!iso) return '-'
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  if (s < 172800) return 'Yesterday'
  return `${Math.floor(s / 86400)} days ago`
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

export const monthKey = (iso: string) => iso.slice(0, 7)
export function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({
      key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`,
      label: x.toLocaleString('en-US', { month: 'short' }),
    })
  }
  return out
}

// Score IA (regles) : budget vs biens dispo, recence du contact, avancement pipeline, source.
export function scoreLead(l: Pick<Lead, 'budget' | 'status' | 'last_contact' | 'source'>, props: Property[]): number {
  let s = 30
  const days = (Date.now() - new Date(l.last_contact).getTime()) / 86400000
  s += days < 1 ? 20 : days < 3 ? 12 : days < 7 ? 5 : -5
  const match = props.filter((p) => p.status === 'available' && l.budget > 0 && p.price <= l.budget * 1.1 && p.price >= l.budget * 0.5)
  s += Math.min(15, match.length * 5)
  s += { new: 0, qualified: 10, viewing: 18, negotiation: 25, won: 30, lost: -30 }[l.status]
  s += l.source === 'referral' ? 8 : l.source === 'whatsapp' ? 4 : 0
  return Math.max(0, Math.min(100, Math.round(s)))
}
export const isHot = (l: Lead) => l.score >= 75 && l.status !== 'won' && l.status !== 'lost'

// Recherche en langage naturel : "villa in Lusail under 3m with 4 beds"
export type Query = { type?: PropType; area?: string; maxPrice?: number; minBeds?: number; listing?: 'sale' | 'rent' }
export function parseSearch(text: string): Query {
  const t = text.toLowerCase()
  const q: Query = {}
  if (/villa/.test(t)) q.type = 'villa'
  else if (/townhouse/.test(t)) q.type = 'townhouse'
  else if (/apartment|flat|studio/.test(t)) q.type = 'apartment'
  else if (/office/.test(t)) q.type = 'office'
  else if (/shop|retail/.test(t)) q.type = 'shop'
  else if (/land|plot/.test(t)) q.type = 'land'
  q.area = AREAS.find((a) => t.includes(a.toLowerCase()))
  if (/\b(rent|rental|lease)\b/.test(t)) q.listing = 'rent'
  else if (/\b(buy|sale|purchase)\b/.test(t)) q.listing = 'sale'
  const m = t.match(/(?:under|below|max|budget|up to|<)\s*(?:qar\s*)?([\d.,]+)\s*(m|million|k|thousand)?/)
  if (m) {
    let v = parseFloat(m[1].replace(/,/g, ''))
    if (m[2] === 'm' || m[2] === 'million') v *= 1_000_000
    else if (m[2] === 'k' || m[2] === 'thousand') v *= 1000
    if (v > 0) q.maxPrice = v
  }
  const b = t.match(/(\d)\s*(?:\+)?\s*(?:bed|br|bedroom)/)
  if (b) q.minBeds = parseInt(b[1], 10)
  return q
}
export function matchProperties(props: Property[], q: Query): Property[] {
  return props
    .filter((p) => p.status === 'available')
    .filter((p) => (!q.type || p.type === q.type) && (!q.area || p.area === q.area) && (!q.listing || p.listing === q.listing))
    .filter((p) => (!q.maxPrice || p.price <= q.maxPrice) && (!q.minBeds || p.beds >= q.minBeds))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.price - b.price)
}

// Resume compact des donnees, envoye a l'IA comme contexte (jamais de cle, jamais de donnees d'autres cabinets).
export function contextSummary(d: Data): string {
  const avail = d.properties.filter((p) => p.status === 'available')
  const props = avail.slice(0, 25).map((p) => `${p.title} | ${p.type} | ${p.listing} | ${p.area} | ${qar(p.price)} | ${p.beds}bd/${p.baths}ba | ${p.size_m2}m2`).join('\n')
  const open = d.leads.filter((l) => l.status !== 'won' && l.status !== 'lost')
  const byStatus = ['new', 'qualified', 'viewing', 'negotiation'].map((s) => `${s}:${open.filter((l) => l.status === s).length}`).join(', ')
  const closed = d.deals.filter((x) => x.status === 'closed')
  return [
    `Available properties (${avail.length}):\n${props}`,
    `Open leads by stage: ${byStatus}`,
    `Closed deals: ${closed.length}, total value ${qar(closed.reduce((s, x) => s + x.value, 0))}`,
  ].join('\n\n')
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
