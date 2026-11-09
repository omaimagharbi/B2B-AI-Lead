import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { tableAbsente } from '@/lib/immo-os/server'
import { DEFAULT_UNKNOWN_RULE, isUnknownRule } from '@/lib/immo-os/unknown-rule'
import { logActivity } from '@/lib/immo-os/activity'
import { CONFIG_BOOLS, readConfig } from '@/lib/immo-os/ai-agent'

// n°102 : reglages WhatsApp de l'agence (regle pour les numeros inconnus). Lecture : tous les membres ; modification : gestionnaires.
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const { data, error } = await supabaseAdmin.from('re_settings').select('unknown_number_rule, ai_agent, updated_by, updated_at').eq('client_id', auth.clientId).maybeSingle()
  if (error) {
    // migration 81 pas faite : on relit sans ai_agent
    const r2 = await supabaseAdmin.from('re_settings').select('unknown_number_rule').eq('client_id', auth.clientId).maybeSingle()
    return NextResponse.json({ unknown_number_rule: r2.data?.unknown_number_rule ?? DEFAULT_UNKNOWN_RULE, ai_agent: readConfig(null), missing: tableAbsente(error) || (r2.error ? tableAbsente(r2.error) : false) })
  }
  return NextResponse.json({ unknown_number_rule: data?.unknown_number_rule ?? DEFAULT_UNKNOWN_RULE, ai_agent: readConfig((data as any)?.ai_agent), updated_by: data?.updated_by ?? null, updated_at: data?.updated_at ?? null })
}

export async function PATCH(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const who = { clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }
  const row: Record<string, unknown> = { client_id: auth.clientId, updated_by: auth.name, updated_at: new Date().toISOString() }
  const changed: string[] = []
  if (body?.unknown_number_rule !== undefined) {
    if (!isUnknownRule(body.unknown_number_rule)) return NextResponse.json({ error: 'Invalid rule' }, { status: 400 })
    row.unknown_number_rule = body.unknown_number_rule; changed.push('unknown_number_rule')
  }
  // Lot 7 : interrupteurs de l'agent IA (chaque reponse automatique est desactivable ; le changement est journalise)
  if (body?.ai_agent && typeof body.ai_agent === 'object') {
    const { data: cur } = await supabaseAdmin.from('re_settings').select('ai_agent').eq('client_id', auth.clientId).maybeSingle()
    const prev = readConfig((cur as any)?.ai_agent)
    const next = readConfig({ ...prev, ...body.ai_agent })
    for (const k of [...CONFIG_BOOLS, 'max_replies'] as const) if (prev[k] !== next[k]) changed.push(`ai_agent.${k}=${next[k]}`)
    row.ai_agent = next
  }
  if (!changed.length) return NextResponse.json({ ok: true, unchanged: true })
  const { error } = await supabaseAdmin.from('re_settings').upsert(row, { onConflict: 'client_id' })
  if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migrations 78 and 81 first' : error.message }, { status: tableAbsente(error) ? 503 : 400 })
  await logActivity(who, { action: 'update', entity: 'settings', label: 'ai_agent', details: { fields: changed } })
  return NextResponse.json({ ok: true, unknown_number_rule: row.unknown_number_rule, ai_agent: row.ai_agent })
}
