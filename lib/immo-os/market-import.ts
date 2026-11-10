// Lot 8 (n°74) : import de donnees de marche par fichier CSV. Pure ; la SOURCE est obligatoire (cle de la confiance dans les chiffres).
export type MarketRow = { area: string | null; type: string | null; listing: 'sale' | 'rent' | null; price: number; size_m2: number | null; beds: number | null; txn_date: string | null }
export const MAX_MARKET_ROWS = 5000

// CSV simple (virgule, point-virgule ou tabulation ; guillemets doubles)
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '')
  const sep = [',', ';', '\t'].map((s) => [s, (t.split('\n')[0].match(new RegExp(s === '\t' ? '\t' : `\\${s}`, 'g')) ?? []).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === sep) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

const HEAD: Record<string, string[]> = {
  area: ['area', 'zone', 'location', 'district', 'quartier', 'المنطقة'], type: ['type', 'property type', 'property_type', 'type de bien', 'النوع'],
  listing: ['listing', 'deal', 'transaction', 'sale/rent', 'achat/location'], price: ['price', 'amount', 'value', 'prix', 'montant', 'السعر', 'price (qar)', 'price_qar'],
  size_m2: ['size', 'size_m2', 'area_m2', 'sqm', 'm2', 'surface', 'surface_m2', 'المساحة'], beds: ['beds', 'bedrooms', 'chambres', 'غرف'], txn_date: ['date', 'transaction date', 'txn_date', 'deal date'],
}
const num = (v: string) => { const n = parseFloat(String(v ?? '').replace(/[,\s\u00a0]/g, '').replace(/qar|qr/i, '')); return Number.isFinite(n) ? n : NaN }
const TYPES = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'compound', 'land', 'office', 'shop', 'showroom', 'warehouse', 'building', 'hotel', 'farm', 'industrial', 'labour_camp', 'mixed_use']

export function parseMarketCsv(text: string): { rows: MarketRow[]; errors: string[]; total: number } {
  const all = parseCsv(text)
  const errors: string[] = []
  if (all.length < 2) return { rows: [], errors: ['The file is empty or has no data rows'], total: 0 }
  const head = all[0].map((h) => h.trim().toLowerCase())
  const col = (k: string) => head.findIndex((h) => HEAD[k].includes(h))
  const ix = Object.fromEntries(Object.keys(HEAD).map((k) => [k, col(k)])) as Record<string, number>
  if (ix.price < 0) return { rows: [], errors: ['Missing column "price"'], total: all.length - 1 }
  const rows: MarketRow[] = []
  for (let i = 1; i < all.length && rows.length < MAX_MARKET_ROWS; i++) {
    const r = all[i]
    const price = num(r[ix.price])
    if (!(price > 0)) { if (errors.length < 5) errors.push(`Line ${i + 1}: invalid price`); continue }
    const lst = ix.listing >= 0 ? r[ix.listing].trim().toLowerCase() : ''
    const ty = ix.type >= 0 ? r[ix.type].trim().toLowerCase().replace(/[\s-]+/g, '_') : ''
    const size = ix.size_m2 >= 0 ? num(r[ix.size_m2]) : NaN
    const beds = ix.beds >= 0 ? Math.round(num(r[ix.beds])) : NaN
    const d = ix.txn_date >= 0 ? new Date(r[ix.txn_date]) : null
    rows.push({
      area: ix.area >= 0 && r[ix.area].trim() ? r[ix.area].trim().slice(0, 80) : null,
      type: TYPES.includes(ty) ? ty : null,
      listing: /^(rent|rental|lease|location|louer|ايجار|إيجار)/.test(lst) ? 'rent' : /^(sale|sell|buy|vente|achat|بيع)/.test(lst) ? 'sale' : null,
      price, size_m2: size > 0 ? size : null, beds: Number.isFinite(beds) && beds >= 0 && beds < 30 ? beds : null,
      txn_date: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null,
    })
  }
  return { rows, errors, total: all.length - 1 }
}

// Prix median au m2 par zone et type (fichier importe) : base de comparaison avec les biens de l'agence
export type MarketStat = { area: string; type: string | null; count: number; medianPrice: number; medianPerM2: number | null }
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
export function summarizeMarket(rows: Pick<MarketRow, 'area' | 'type' | 'price' | 'size_m2' | 'listing'>[]): MarketStat[] {
  const g = new Map<string, typeof rows>()
  for (const r of rows) { const k = `${r.area ?? '-'}|${r.type ?? ''}|${r.listing ?? ''}`; g.set(k, [...(g.get(k) ?? []), r]) }
  return Array.from(g, ([k, v]) => { const [area, type] = k.split('|'); const ppm = v.filter((x) => x.size_m2).map((x) => Number(x.price) / Number(x.size_m2)); return { area, type: type || null, count: v.length, medianPrice: Math.round(median(v.map((x) => Number(x.price)))!), medianPerM2: ppm.length ? Math.round(median(ppm)!) : null } }).sort((a, b) => b.count - a.count)
}
