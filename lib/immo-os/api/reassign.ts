import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { isUuid } from '@/lib/immo-os/server'
import { ACTIVE_STATUSES } from '@/lib/immo-os/reminders'
import { logActivity } from '@/lib/immo-os/activity'

// Reassignation en masse des leads (appel : POST /api/immo?r=leads/reassign). Reservee aux gestionnaires.
// Body : { from: "<nom de l'agent>" | "__orphans", to: "<nom d'un membre>", scope?: "active" | "all", reason?: "bulk" | "agent_removed" }
// "__orphans" = leads sans agent OU dont l'agent n'existe plus dans l'equipe (agent retire).
export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const from = typeof body.from === 'string' ? body.from.trim() : ''
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const reason = body.reason === 'agent_removed' ? 'agent_removed' : 'bulk'
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const { data: members } = await supabaseAdmin.from('client_users').select('nom_complet').eq('client_id', auth.clientId)
  const names = (members ?? []).map((m) => String(m.nom_complet ?? '').trim()).filter(Boolean)
  const key = (x?: string | null) => String(x ?? '').trim().toLowerCase()
  const target = names.find((n) => key(n) === key(to))
  if (!target) return NextResponse.json({ error: 'Unknown team member' }, { status: 400 })
  if (key(from) === key(target)) return NextResponse.json({ error: 'Same agent' }, { status: 400 })

  let q = supabaseAdmin.from('re_leads').select('id, name, agent, status').eq('client_id', auth.clientId).limit(2000)
  if (body.scope !== 'all') q = q.in('status', ACTIVE_STATUSES)
  const { data: leads, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const known = new Set(names.map(key))
  const picked = (leads ?? []).filter((l) => (from === '__orphans' ? !l.agent || !known.has(key(l.agent)) : key(l.agent) === key(from)))
  if (!picked.length) return NextResponse.json({ ok: true, count: 0 })

  const ids = picked.map((l) => l.id).filter(isUuid)
  // Par lots de 100 : une liste de 2000 identifiants depasserait la longueur d'URL acceptee par PostgREST
  for (let i = 0; i < ids.length; i += 100) {
    const { error: upErr } = await supabaseAdmin.from('re_leads').update({ agent: target }).in('id', ids.slice(i, i + 100)).eq('client_id', auth.clientId)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
  }

  // Historique : une ligne par lead (qui l'avait, qui l'a recu, par qui, quand) - ignore si la migration 76 n'est pas faite
  await supabaseAdmin.from('re_assignments').insert(picked.map((l) => ({ client_id: auth.clientId, lead_id: l.id, lead_name: l.name, from_agent: l.agent || null, to_agent: target, by_name: auth.name || null, reason })))
  await logActivity({ clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }, { action: 'reassign_bulk', entity: 'leads', label: `${from === '__orphans' ? '-' : from} > ${target}`, details: { count: picked.length, from: from === '__orphans' ? null : from, to: target, reason } })
  return NextResponse.json({ ok: true, count: picked.length })
}
