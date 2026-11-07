import type { Data, Property, PropType } from './types'

// Market Intelligence INTERNE (n°37, 51, 73, 57) : tout est calcule a partir des biens et leads de l'agence.
// Aucune donnee externe du marche (voir n°74, hors lot). La demande utilise tous les leads : reservee aux gestionnaires.
const med = (v: number[]) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2) }
const avg = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null)
const norm = (x?: string | null) => String(x ?? '').trim().toLowerCase()
const live = (p: Property) => p.status !== 'sold' && p.status !== 'rented'

export type ZoneRow = { zone: string; listings: number; avgSale: number | null; avgRent: number | null; ppm2: number | null; available: number; leads: number; ratio: number | null; change90: number | null }

export function zoneStats(data: Data, includeDemand: boolean, now = Date.now()): ZoneRow[] {
  const zones = Array.from(new Set(data.properties.map((p) => p.area).filter((a): a is string => !!a)))
  const cut = now - 90 * 86400000
  return zones.map((zone) => {
    const ps = data.properties.filter((p) => p.area === zone)
    const sale = ps.filter((p) => p.listing === 'sale'), rent = ps.filter((p) => p.listing === 'rent')
    const ppm = sale.filter((p) => p.size_m2 > 0).map((p) => p.price / p.size_m2)
    const recent = sale.filter((p) => new Date(p.created_at).getTime() >= cut).map((p) => p.price)
    const older = sale.filter((p) => new Date(p.created_at).getTime() < cut).map((p) => p.price)
    const change = recent.length >= 1 && older.length >= 1 ? Math.round(((avg(recent)! - avg(older)!) / avg(older)!) * 1000) / 10 : null
    const available = ps.filter((p) => p.status === 'available').length
    // Demande = leads lies a un bien de la zone + leads / clients dont le texte cite la zone
    let leads = 0
    if (includeDemand) {
      const ids = new Set(ps.map((p) => p.id))
      const z = norm(zone)
      leads = data.leads.filter((l) => (l.property_id && ids.has(l.property_id)) || norm(l.interest).includes(z)).length
        + data.clients.filter((c) => norm(c.preferred_areas).includes(z)).length
    }
    return { zone, listings: ps.length, avgSale: avg(sale.map((p) => p.price)), avgRent: avg(rent.map((p) => p.price)), ppm2: avg(ppm), available, leads, ratio: includeDemand && available ? Math.round((leads / available) * 10) / 10 : null, change90: change }
  }).sort((a, b) => b.listings - a.listings || a.zone.localeCompare(b.zone))
}

// Prix moyen de vente mois par mois (biens inscrits jusqu'a ce mois) - tendance interne
export function priceTrend(data: Data, months: { key: string; label: string }[]) {
  return months.map((m) => {
    const upto = data.properties.filter((p) => p.listing === 'sale' && p.created_at.slice(0, 7) <= m.key)
    return { month: m.label, price: avg(upto.map((p) => p.price)) ?? 0 }
  }).filter((x, i, arr) => x.price > 0 || arr.slice(i).some((y) => y.price > 0))
}
export const momChange = (series: { price: number }[]): number | null => {
  const v = series.map((x) => x.price).filter(Boolean)
  return v.length >= 2 && v[v.length - 2] > 0 ? Math.round(((v[v.length - 1] - v[v.length - 2]) / v[v.length - 2]) * 1000) / 10 : null
}
export function budgetGap(data: Data, includeLeads: boolean) {
  const budgets = includeLeads ? data.leads.filter((l) => l.budget > 0).map((l) => l.budget) : []
  const prices = data.properties.filter((p) => p.listing === 'sale' && live(p)).map((p) => p.price)
  const mb = med(budgets), mp = med(prices)
  return { medianBudget: mb, medianPrice: mp, gapPct: mb && mp ? Math.round(((mb - mp) / mp) * 100) : null }
}
export function typeMix(data: Data): { type: PropType; n: number }[] {
  const c = new Map<PropType, number>()
  data.properties.forEach((p) => c.set(p.type, (c.get(p.type) ?? 0) + 1))
  return Array.from(c, ([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n)
}
// Contexte compact pour l'analyse IA (aucune coordonnee de client)
export function marketContext(data: Data, includeDemand: boolean): string {
  const z = zoneStats(data, includeDemand)
  const g = budgetGap(data, includeDemand)
  return [
    `Zones (listings | avg sale price QAR | avg rent QAR/month | price per m2${includeDemand ? ' | leads | leads per available listing' : ''} | 90-day price change %):`,
    ...z.slice(0, 15).map((r) => [r.zone, r.listings, r.avgSale ?? '-', r.avgRent ?? '-', r.ppm2 ?? '-', ...(includeDemand ? [r.leads, r.ratio ?? '-'] : []), r.change90 ?? '-'].join(' | ')),
    `Median asking price (sale): ${g.medianPrice ?? 'n/a'}${includeDemand ? `; median lead budget: ${g.medianBudget ?? 'n/a'}` : ''}`,
    `Property mix: ${typeMix(data).map((t) => `${t.type} ${t.n}`).join(', ')}`,
  ].join('\n')
}
