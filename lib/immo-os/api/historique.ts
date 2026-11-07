import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { isUuid } from '@/lib/immo-os/server'

// GET /api/immo?r=assignments&lead_id=<uuid> -> historique des affectations d'un lead (un agent ne voit que ses propres leads)
// GET /api/immo?r=assignments                -> les 200 derniers changements (gestionnaires seulement)
export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const leadId = req.nextUrl.searchParams.get('lead_id')
  const manager = isManager(auth.role)
  if (!leadId && !manager) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  if (leadId) {
    if (!isUuid(leadId)) return NextResponse.json({ error: 'lead_id invalid' }, { status: 400 })
    if (!manager) {
      const { data: lead } = await supabaseAdmin.from('re_leads').select('agent').eq('id', leadId).eq('client_id', auth.clientId).maybeSingle()
      if (!lead || String(lead.agent ?? '').trim().toLowerCase() !== auth.name.trim().toLowerCase()) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
    }
  }
  let q = supabaseAdmin.from('re_assignments').select('*').eq('client_id', auth.clientId).order('created_at', { ascending: false }).limit(leadId ? 100 : 200)
  if (leadId) q = q.eq('lead_id', leadId)
  const { data, error } = await q
  if (error) return NextResponse.json({ rows: [], missing: true })
  return NextResponse.json({ rows: data ?? [] })
}
