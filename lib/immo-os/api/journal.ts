import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'

// GET /api/immo?r=activity            -> journal d'activite (gestionnaires seulement). Filtres : actor, entity, limit (300 max)
// GET /api/immo?r=activity&summary=1  -> derniere activite par membre { last: { "<nom>": "<date ISO>" } }
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  if (sp.get('summary')) {
    const { data, error } = await supabaseAdmin.from('re_activity').select('actor_name, created_at').eq('client_id', auth.clientId).order('created_at', { ascending: false }).limit(3000)
    if (error) return NextResponse.json({ last: {}, missing: true })
    const last: Record<string, string> = {}
    for (const r of data ?? []) if (r.actor_name && !last[r.actor_name]) last[r.actor_name] = r.created_at
    return NextResponse.json({ last })
  }
  let q = supabaseAdmin.from('re_activity').select('*').eq('client_id', auth.clientId).order('created_at', { ascending: false }).limit(Math.min(300, Math.max(1, Number(sp.get('limit')) || 100)))
  const actor = sp.get('actor'); if (actor) q = q.eq('actor_name', actor)
  const entity = sp.get('entity'); if (entity) q = q.eq('entity', entity)
  const { data, error } = await q
  if (error) return NextResponse.json({ rows: [], missing: true }) // migration 76 pas encore faite
  return NextResponse.json({ rows: data ?? [] })
}
