import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { tableAbsente } from '@/lib/immo-os/server'
import { fetchTemplates, metaEnv, metaReady } from '@/lib/immo-os/wa-meta'
import { logActivity } from '@/lib/immo-os/activity'

// Reglages WhatsApp Business de l'agence : /api/immo?r=wa
// GET  (tous les membres) : canal utilise (meta / greenapi), modeles approuves ; gestionnaires : numeros + etat des variables d'environnement.
// POST (gestionnaires)    : { action: 'add_number' | 'remove_number' | 'sync_templates', ... }
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const manager = isManager(auth.role)
  const [nums, tpls] = await Promise.all([
    supabaseAdmin.from('re_wa_numbers').select('id, phone_number_id, waba_id, display_phone, label, active').eq('client_id', auth.clientId).order('created_at'),
    supabaseAdmin.from('re_wa_templates').select('name, language, category, status, body').eq('client_id', auth.clientId).order('name'),
  ])
  const missing = !!nums.error && tableAbsente(nums.error)
  const active = (nums.data ?? []).filter((n) => n.active)
  const channel = metaReady() && active.length ? 'meta' : 'greenapi'
  const templates = (tpls.data ?? []).filter((t) => manager || t.status === 'APPROVED')
  return NextResponse.json({
    channel, missing, templates,
    ...(manager ? { numbers: nums.data ?? [], env: metaEnv() } : { numbers: [] }),
  })
}

export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const who = { clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

  if (b.action === 'add_number') {
    const pid = str(b.phone_number_id, 40)
    if (!/^\d{6,25}$/.test(pid)) return NextResponse.json({ error: 'Phone number ID must contain only digits' }, { status: 400 })
    const { error } = await supabaseAdmin.from('re_wa_numbers').insert({ client_id: auth.clientId, phone_number_id: pid, waba_id: str(b.waba_id, 40) || null, display_phone: str(b.display_phone, 30) || null, label: str(b.label, 60) || null })
    if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 79 first' : error.code === '23505' ? 'This phone number ID is already registered' : error.message }, { status: tableAbsente(error) ? 503 : 400 })
    await logActivity(who, { action: 'create', entity: 'wa_numbers', label: pid, details: { fields: ['phone_number_id'] } })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'remove_number') {
    const { error } = await supabaseAdmin.from('re_wa_numbers').delete().eq('id', str(b.id, 64)).eq('client_id', auth.clientId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await logActivity(who, { action: 'delete', entity: 'wa_numbers', label: 'wa number' })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'sync_templates') {
    if (!metaReady()) return NextResponse.json({ error: 'META_WA_ACCESS_TOKEN is not configured' }, { status: 400 })
    const { data: nums } = await supabaseAdmin.from('re_wa_numbers').select('waba_id').eq('client_id', auth.clientId).eq('active', true).not('waba_id', 'is', null)
    const wabas = Array.from(new Set((nums ?? []).map((n) => n.waba_id as string)))
    if (!wabas.length) return NextResponse.json({ error: 'Add a number with its WhatsApp Business Account ID first' }, { status: 400 })
    let count = 0
    for (const w of wabas) {
      const list = await fetchTemplates(w)
      if (!list) return NextResponse.json({ error: 'Meta refused the request (check the access token and the account ID)' }, { status: 502 })
      if (list.length) {
        const { error } = await supabaseAdmin.from('re_wa_templates').upsert(list.map((t) => ({ client_id: auth.clientId, ...t, synced_at: new Date().toISOString() })), { onConflict: 'client_id,name,language' })
        if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 79 first' : error.message }, { status: 400 })
        count += list.length
      }
    }
    return NextResponse.json({ ok: true, count })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
