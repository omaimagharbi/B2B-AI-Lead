import type { Data, Lead, Property, PropType, Tenure } from './types'
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

// Recherche en langage naturel (n°36) : EN, FR et AR. "villa in Lusail under 3m with 4 beds" / "villa à Lusail moins de 3 millions 4 chambres" / "فيلا في لوسيل أقل من 3 مليون 4 غرف"
export type Query = { tenure?: Tenure; type?: PropType; area?: string; maxPrice?: number; minBeds?: number; listing?: 'sale' | 'rent' }
// Chiffres arabes-indiens, virgules arabes, accents latins, voyelles breves : meme texte normalise pour toutes les langues
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export const normSearch = (x: string) =>
  String(x ?? '').toLowerCase().replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[٬،]/g, ',').replace(/٫/g, '.')
    .normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ')
const TYPE_RULES: [RegExp, PropType][] = [
  [/hotel|hospitality|فندق|فنادق/, 'hotel'], [/industrial|factory|industriel|usine|صناعي|مصنع/, 'industrial'], [/mixed.?use|usage mixte|متعدد الاستخدام/, 'mixed_use'],
  [/penthouse|بنتهاوس/, 'penthouse'], [/duplex|دوبلكس/, 'duplex'], [/compound|complexe residentiel|مجمع سكني/, 'compound'],
  [/labou?r camp|staff accommodation|camp de travailleurs|سكن عمال/, 'labour_camp'], [/showroom|salle d.exposition|معرض/, 'showroom'],
  [/warehouse|storage|entrepot|depot|مستودع|مخزن/, 'warehouse'], [/farm|ferme|مزرعه|عزبه/, 'farm'], [/building|tower|immeuble|tour\b|عماره|برج|مبني/, 'building'],
  [/villa|فيلا|فلل/, 'villa'], [/townhouse|maison de ville|تاون ?هاوس/, 'townhouse'], [/apartment|flat|studio|appartement|appart\b|شقه|شقق|استوديو/, 'apartment'],
  [/office|bureau|مكتب|مكاتب/, 'office'], [/shop|retail|boutique|magasin|local commercial|محل|دكان|متجر/, 'shop'], [/\bland\b|plot|terrain|parcelle|ارض|قطعه/, 'land'],
]
// Noms de zones en arabe et en francais -> nom de zone du systeme
const AREA_ALIASES: [RegExp, string][] = [
  [/لاجون الخليج الغربي|west bay lagoon|lagune de west bay/, 'West Bay Lagoon'], [/الخليج الغربي|west bay/, 'West Bay'], [/اللولوه|the pearl|la perle|\bpearl\b/, 'The Pearl'],
  [/لوسيل|lusail/, 'Lusail'], [/الدفنه|al dafna|dafna/, 'Al Dafna'], [/\bالسد\b|al sadd|\bsadd\b/, 'Al Sadd'], [/الخور|al khor/, 'Al Khor'], [/الريان|al rayyan|rayyan/, 'Al Rayyan'],
  [/مشيرب|msheireb/, 'Msheireb'], [/المطار القديم|old airport|vieil aeroport|ancien aeroport/, 'Old Airport'],
]
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, واحد: 1, غرفه: 1, اثنين: 2, غرفتين: 2, ثلاث: 3, ثلاثه: 3, اربع: 4, اربعه: 4, خمس: 5, خمسه: 5, ست: 6 }
const NUM_RE = '(\\d+(?:[.,]\\d+)?|(?:one|two|three|four|five|six|une?|deux|trois|quatre|cinq)(?![a-z])|واحد|اثنين|ثلاثه?|اربعه?|خمسه?)'
export function parseSearch(text: string, areas?: string[]): Query {
  const t = normSearch(text)
  const q: Query = {}
  for (const [re, ty] of TYPE_RULES) if (re.test(t)) { q.type = ty; break }
  if (/freehold|pleine propriete|تملك حر/.test(t)) q.tenure = 'freehold'
  else if (/usufruct|usufruit|حق انتفاع/.test(t)) q.tenure = 'usufruct'
  // zones : les noms les plus longs d'abord ("West Bay Lagoon" avant "West Bay")
  const alias = AREA_ALIASES.find(([re]) => re.test(t))?.[1]
  const known = Array.from(new Set([...(areas ?? []), ...AREAS])).sort((a, b) => b.length - a.length)
  q.area = alias ?? known.find((a) => t.includes(normSearch(a)))
  if (/\b(rent|rental|lease)\b|\blouer\b|location|a louer|ايجار|للايجار|استئجار|تاجير/.test(t)) q.listing = 'rent'
  else if (/\b(buy|sale|purchase)\b|acheter|achat|vente|a vendre|شراء|للبيع|بيع|تملك/.test(t)) q.listing = 'sale'
  const m = t.match(new RegExp(`(?:under|below|max|budget|up to|<|moins de|sous|jusqu.?a|maximum|اقل من|حتي|بحدود|ميزانيه|لا تتجاوز|بميزانيه)\\s*(?:qar|qr|ر\\.?ق|ريال)?\\s*${NUM_RE}\\s*(m\\b|million|millions|مليون|k\\b|thousand|mille|الف)?`))
  if (m) {
    let v = NUM_WORDS[m[1]] ?? parseFloat(m[1].replace(/,/g, (c, o, str) => (/^\d{1,3}(,\d{3})+/.test(str.slice(str.indexOf(m[1]))) ? '' : '.')))
    const u = m[2]
    if (u === 'm' || u === 'million' || u === 'millions' || u === 'مليون') v *= 1_000_000
    else if (u === 'k' || u === 'thousand' || u === 'mille' || u === 'الف') v *= 1000
    if (v > 0) q.maxPrice = v
  }
  const b = t.match(new RegExp(`${NUM_RE}\\s*(?:\\+)?\\s*(?:bed|br\\b|bedroom|bedrooms|chambres?|ch\\b|غرف|غرفه|غرفتين)`)) ?? (/غرفتين/.test(t) ? ['', '2'] : null)
  if (b) { const n = NUM_WORDS[b[1]] ?? parseInt(b[1], 10); if (n > 0 && n < 20) q.minBeds = n }
  return q
}
// Question de suivi : "moins cher", "plus de chambres", "en location"... complete la recherche precedente au lieu de la remplacer
export function refineQuery(prev: Query | null, text: string, areas?: string[]): Query {
  const next = parseSearch(text, areas)
  if (!prev) return next
  const t = normSearch(text)
  const merged: Query = { ...prev, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) }
  if (!next.maxPrice && prev.maxPrice && /cheaper|less expensive|moins cher|اقل سعرا|ارخص/.test(t)) merged.maxPrice = Math.round(prev.maxPrice * 0.8)
  if (!next.minBeds && prev.minBeds && /more (bed|room)|plus de chambres|اكثر غرف/.test(t)) merged.minBeds = prev.minBeds + 1
  return merged
}
export function matchProperties(props: Property[], q: Query): Property[] {
  return props
    .filter((p) => p.status === 'available')
    .filter((p) => (!q.type || p.type === q.type) && (!q.tenure || p.tenure === q.tenure) && (!q.area || p.area === q.area) && (!q.listing || p.listing === q.listing))
    .filter((p) => (!q.maxPrice || p.price <= q.maxPrice) && (!q.minBeds || p.beds >= q.minBeds))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.price - b.price)
}

// Resume compact des donnees, envoye a l'IA comme contexte (jamais de cle, jamais de donnees d'autres cabinets).
export function contextSummary(d: Data): string {
  const avail = d.properties.filter((p) => p.status === 'available')
  const props = avail.slice(0, 25).map((p) => `${p.title} | ${p.type} | ${p.listing} | ${p.area} | ${qar(p.price)} | ${p.beds}bd/${p.baths}ba | ${p.size_m2}m2${p.tenure ? ` | ${p.tenure}${p.tenure === 'usufruct' && p.usufruct_years ? ` ${p.usufruct_years}y` : ''}` : ''}`).join('\n')
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
