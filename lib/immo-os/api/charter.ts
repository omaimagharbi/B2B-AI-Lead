import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { tableAbsente } from '@/lib/immo-os/server'
import { CHARTER_VERSION } from '@/lib/immo-os/policy'
import { logActivity } from '@/lib/immo-os/activity'

// n°101 : charte d'utilisation (numero WhatsApp de la societe, echanges enregistres). Chaque membre doit l'accepter ; la preuve est conservee.
// GET  /api/immo?r=charter  -> gestionnaires : qui a accepte la version courante
// POST /api/immo?r=charter  -> le membre connecte accepte la version courante
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const [{ data: team }, acc] = await Promise.all([
    supabaseAdmin.from('client_users').select('id, nom_complet, role').eq('client_id', auth.clientId),
    supabaseAdmin.from('re_charter_acceptances').select('user_id, accepted_at, lang').eq('client_id', auth.clientId).eq('version', CHARTER_VERSION),
  ])
  if (acc.error) return NextResponse.json({ version: CHARTER_VERSION, rows: [], missing: tableAbsente(acc.error) })
  const by = new Map((acc.data ?? []).map((a) => [a.user_id as string, a]))
  return NextResponse.json({ version: CHARTER_VERSION, rows: (team ?? []).map((m) => ({ id: m.id, name: m.nom_complet ?? '', role: m.role, accepted_at: by.get(m.id)?.accepted_at ?? null })) })
}

export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const body = await req.json().catch(() => ({}))
  const lang = body?.lang === 'fr' || body?.lang === 'ar' ? body.lang : 'en'
  const { error } = await supabaseAdmin.from('re_charter_acceptances').upsert(
    { client_id: auth.clientId, user_id: auth.clientUserId, user_name: auth.name, version: CHARTER_VERSION, lang },
    { onConflict: 'client_id,user_id,version', ignoreDuplicates: true },
  )
  if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 78 first' : error.message }, { status: tableAbsente(error) ? 503 : 400 })
  await logActivity({ clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }, { action: 'charter_accept', entity: 'team', label: auth.name, details: { version: CHARTER_VERSION } })
  return NextResponse.json({ ok: true, version: CHARTER_VERSION })
}
