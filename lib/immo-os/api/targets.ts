import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { isUuid } from '@/lib/immo-os/server'
import { planImport, type Target } from '@/lib/immo-os/bridge'
import { sameNumber } from '@/lib/immo-os/inbound-pure'

const COLS = 'id, nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, statut'

async function existingLeads(clientId: string) {
  let { data, error } = await supabaseAdmin.from('re_leads').select('phone, origin_target_id').eq('client_id', clientId).limit(5000)
  if (error) ({ data, error } = (await supabaseAdmin.from('re_leads').select('phone').eq('client_id', clientId).limit(5000)) as any) // migration 72 pas faite
  return ((data ?? []) as any[]).map((l) => ({ phone: l.phone ?? null, origin_target_id: l.origin_target_id ?? null }))
}

// Liste des prospects de la machine B2B de l'agence (avec telephone), marques "deja importes".
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'Only managers can import prospects' }, { status: 403 })
  const { data, error } = await supabaseAdmin.from('targets').select(COLS).eq('client_id', auth.clientId).not('telephone', 'is', null).order('created_at', { ascending: false }).limit(300)
  if (error) return NextResponse.json({ error: 'Could not load prospects' }, { status: 500 })
  const ex = await existingLeads(auth.clientId)
  const items = ((data ?? []) as Target[]).map((t) => ({ ...t, imported: ex.some((l) => l.origin_target_id === t.id || sameNumber(l.phone, t.telephone)) }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'Only managers can import prospects' }, { status: 403 })
  const { ids } = await req.json().catch(() => ({}))
  const list = (Array.isArray(ids) ? ids : []).filter(isUuid).slice(0, 50) as string[]
  if (!list.length) return NextResponse.json({ error: 'No prospect selected' }, { status: 400 })

  const { data: targets } = await supabaseAdmin.from('targets').select(COLS).eq('client_id', auth.clientId).in('id', list)
  const { toInsert, skipped } = planImport((targets ?? []) as Target[], await existingLeads(auth.clientId), process.env.IMMO_DEFAULT_COUNTRY_CODE || '974')
  if (toInsert.length) {
    const rows = toInsert.map((l) => ({ ...l, client_id: auth.clientId, last_contact: new Date().toISOString() }))
    let { error } = await supabaseAdmin.from('re_leads').insert(rows)
    if (error?.code === 'PGRST204' || error?.code === '42703') {
      ({ error } = await supabaseAdmin.from('re_leads').insert(rows.map(({ origin_target_id, ...r }) => r))) // sans anti-doublon par origine (migration 72 pas faite)
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ imported: toInsert.length, skipped: skipped.length })
}
