import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { isUuid, tableAbsente } from '@/lib/immo-os/server'
import { MAX_MARKET_ROWS, summarizeMarket, type MarketRow } from '@/lib/immo-os/market-import'
import { logActivity } from '@/lib/immo-os/activity'

// Lot 8 (n°74) : donnees de marche importees par fichier. /api/immo?r=market-import
// GET : liste des imports (source, date, nombre de lignes) + statistiques par zone ; POST (gestionnaires) : { source (obligatoire), source_url, as_of, rows } ou { action: 'delete_import', import_id }.
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const { data, error } = await supabaseAdmin.from('re_market_data').select('import_id, source, source_url, as_of, area, type, listing, price, size_m2, imported_by, created_at').eq('client_id', auth.clientId).limit(20000)
  if (error) return NextResponse.json({ imports: [], stats: [], missing: tableAbsente(error) })
  const by = new Map<string, any>()
  for (const r of data ?? []) { const e = by.get(r.import_id) ?? { import_id: r.import_id, source: r.source, source_url: r.source_url, as_of: r.as_of, imported_by: r.imported_by, created_at: r.created_at, rows: 0 }; e.rows++; by.set(r.import_id, e) }
  return NextResponse.json({ imports: Array.from(by.values()).sort((a, b) => b.created_at.localeCompare(a.created_at)), stats: summarizeMarket(data ?? []).slice(0, 40) })
}

export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const who = { clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }
  if (b.action === 'delete_import') {
    if (!isUuid(b.import_id)) return NextResponse.json({ error: 'import_id required' }, { status: 400 })
    const { error } = await supabaseAdmin.from('re_market_data').delete().eq('client_id', auth.clientId).eq('import_id', b.import_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await logActivity(who, { action: 'delete', entity: 'market', label: 'market import' })
    return NextResponse.json({ ok: true })
  }
  const source = typeof b.source === 'string' ? b.source.trim().slice(0, 120) : ''
  if (source.length < 2) return NextResponse.json({ error: 'The source of the data is required (who published these figures?)' }, { status: 400 })
  const url = typeof b.source_url === 'string' && /^https?:\/\//i.test(b.source_url.trim()) ? b.source_url.trim().slice(0, 500) : null
  const asOf = typeof b.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.as_of) ? b.as_of : null
  const rows: MarketRow[] = (Array.isArray(b.rows) ? b.rows : []).slice(0, MAX_MARKET_ROWS).filter((r: any) => Number(r?.price) > 0)
  if (!rows.length) return NextResponse.json({ error: 'No valid row to import' }, { status: 400 })
  const importId = crypto.randomUUID()
  const clean = rows.map((r) => ({ client_id: auth.clientId, import_id: importId, source, source_url: url, as_of: asOf, area: r.area ? String(r.area).slice(0, 80) : null, type: r.type ? String(r.type).slice(0, 30) : null, listing: r.listing === 'rent' || r.listing === 'sale' ? r.listing : null, price: Number(r.price), size_m2: Number(r.size_m2) > 0 ? Number(r.size_m2) : null, beds: Number.isFinite(Number(r.beds)) ? Math.round(Number(r.beds)) : null, txn_date: typeof r.txn_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.txn_date) ? r.txn_date : null, imported_by: auth.name }))
  for (let i = 0; i < clean.length; i += 500) {
    const { error } = await supabaseAdmin.from('re_market_data').insert(clean.slice(i, i + 500))
    if (error) { await supabaseAdmin.from('re_market_data').delete().eq('import_id', importId); return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 82 first' : error.message }, { status: tableAbsente(error) ? 503 : 400 }) }
  }
  await logActivity(who, { action: 'create', entity: 'market', label: source, details: { rows: clean.length } })
  return NextResponse.json({ ok: true, import_id: importId, rows: clean.length })
}
