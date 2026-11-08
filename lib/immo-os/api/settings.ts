import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { tableAbsente } from '@/lib/immo-os/server'
import { DEFAULT_UNKNOWN_RULE, isUnknownRule } from '@/lib/immo-os/unknown-rule'
import { logActivity } from '@/lib/immo-os/activity'

// n°102 : reglages WhatsApp de l'agence (regle pour les numeros inconnus). Lecture : tous les membres ; modification : gestionnaires.
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const { data, error } = await supabaseAdmin.from('re_settings').select('unknown_number_rule, updated_by, updated_at').eq('client_id', auth.clientId).maybeSingle()
  if (error) return NextResponse.json({ unknown_number_rule: DEFAULT_UNKNOWN_RULE, missing: tableAbsente(error) })
  return NextResponse.json({ unknown_number_rule: data?.unknown_number_rule ?? DEFAULT_UNKNOWN_RULE, updated_by: data?.updated_by ?? null, updated_at: data?.updated_at ?? null })
}

export async function PATCH(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  if (!isUnknownRule(body?.unknown_number_rule)) return NextResponse.json({ error: 'Invalid rule' }, { status: 400 })
  const { error } = await supabaseAdmin.from('re_settings').upsert({ client_id: auth.clientId, unknown_number_rule: body.unknown_number_rule, updated_by: auth.name, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
  if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 78 first' : error.message }, { status: tableAbsente(error) ? 503 : 400 })
  await logActivity({ clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }, { action: 'update', entity: 'settings', label: 'unknown_number_rule', details: { fields: ['unknown_number_rule'], to: body.unknown_number_rule } })
  return NextResponse.json({ ok: true, unknown_number_rule: body.unknown_number_rule })
}
