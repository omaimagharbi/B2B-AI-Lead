import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { ENTITIES, type Entity } from '@/lib/immo-os/types'
import { sanitize, isUuid, ecrireTolerant } from '@/lib/immo-os/server'
import { canWrite, isManager } from '@/lib/immo-os/permissions'
import { logActivity, logAssignment, labelOf } from '@/lib/immo-os/activity'
import { PARENT_LEVEL, type ZoneLevel } from '@/lib/immo-os/types'

const SCOPED = new Set<Entity>(['leads', 'clients', 'deals', 'visits'])

async function contexte(req: NextRequest, entity: string) {
  if (!(entity in ENTITIES)) return { err: NextResponse.json({ error: 'Unknown entity' }, { status: 404 }) }
  const auth = await contexteImmo(req)
  if (auth.erreur) return { err: NextResponse.json({ error: auth.erreur }, { status: auth.statut }) }
  return { auth, e: entity as Entity, table: ENTITIES[entity as Entity].table, viewer: { role: auth.role, name: auth.name } }
}
// Les references vers une zone doivent appartenir a la meme agence ; un projet va sous une zone, une zone sous une municipalite.
async function verifierZones(e: Entity, row: Record<string, unknown>, clientId: string, level?: ZoneLevel): Promise<string | null> {
  const ref = e === 'zones' ? row.parent_id : e === 'properties' ? row.zone_id : null
  if (!ref) return e === 'zones' && level && PARENT_LEVEL[level] ? 'A parent is required for this level' : null
  const { data } = await supabaseAdmin.from('re_zones').select('level').eq('id', ref as string).eq('client_id', clientId).maybeSingle()
  if (!data) return 'Unknown zone'
  if (e === 'zones' && level && data.level !== PARENT_LEVEL[level]) return 'Invalid parent level'
  return null
}
const interdit = () => NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })

export async function POST(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (!canWrite(c.e!, 'create', c.viewer!)) return interdit()
  const body = await req.json().catch(() => ({}))
  const row: Record<string, unknown> = { ...sanitize(c.e!, body), client_id: c.auth!.clientId }
  const zerr = await verifierZones(c.e!, row, c.auth!.clientId, row.level as ZoneLevel | undefined)
  if (zerr) return NextResponse.json({ error: zerr }, { status: 400 })
  // Un agent cree toujours pour lui-meme
  if (!isManager(c.viewer!.role) && SCOPED.has(c.e!)) row.agent = c.viewer!.name
  const { data, error, dropped } = await ecrireTolerant(row, (r) => supabaseAdmin.from(c.table!).insert(r).select('*').single())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Journal (point d'ecriture unique) : toute creation, quelle que soit la page, passe ici
  const who = { clientId: c.auth!.clientId, id: c.auth!.clientUserId, name: c.viewer!.name, role: c.auth!.role }
  await logActivity(who, { action: 'create', entity: c.e, recordId: data?.id, label: labelOf(data) })
  if (c.e === 'leads' && data?.id) await logAssignment(who, { leadId: data.id, leadName: data.name, from: null, to: data.agent, reason: 'creation' })
  return NextResponse.json({ row: data, ...(dropped.length ? { dropped } : {}) })
}

export async function PATCH(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (!isManager(c.viewer!.role)) {
    if (c.e === 'owners' || c.e === 'zones') return interdit()
    if (SCOPED.has(c.e!)) {
      const { data: existing } = await supabaseAdmin.from(c.table!).select('agent').eq('id', body.id).eq('client_id', c.auth!.clientId).maybeSingle()
      if (!canWrite(c.e!, 'update', c.viewer!, existing)) return interdit()
    }
  }
  const patch = sanitize(c.e!, body)
  if (c.e === 'zones') {
    delete patch.level // le niveau ne change pas apres creation
    if (patch.parent_id) {
      const { data: cur } = await supabaseAdmin.from('re_zones').select('level').eq('id', body.id).eq('client_id', c.auth!.clientId).maybeSingle()
      const zerr = await verifierZones('zones', patch, c.auth!.clientId, cur?.level as ZoneLevel | undefined)
      if (zerr) return NextResponse.json({ error: zerr }, { status: 400 })
    }
  } else if (c.e === 'properties' && patch.zone_id) {
    const zerr = await verifierZones('properties', patch, c.auth!.clientId)
    if (zerr) return NextResponse.json({ error: zerr }, { status: 400 })
  }
  if (!isManager(c.viewer!.role)) delete patch.agent // un agent ne peut pas se reassigner / reassigner un lead
  const { data: avant } = await supabaseAdmin.from(c.table!).select('*').eq('id', body.id).eq('client_id', c.auth!.clientId).maybeSingle()
  const { data, error, dropped } = await ecrireTolerant(patch, (r) => supabaseAdmin.from(c.table!).update(r).eq('id', body.id).eq('client_id', c.auth!.clientId).select('*').single())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const who = { clientId: c.auth!.clientId, id: c.auth!.clientUserId, name: c.viewer!.name, role: c.auth!.role }
  // Seuls les NOMS des champs modifies sont journalises (pas les valeurs : coordonnees, prix...)
  const changed = Object.keys(patch).filter((k) => !['photos'].includes(k) && JSON.stringify((avant as any)?.[k] ?? null) !== JSON.stringify((data as any)?.[k] ?? null))
  if (changed.length) {
    const reassigned = changed.includes('agent') && SCOPED.has(c.e!)
    await logActivity(who, { action: reassigned && changed.length === 1 ? 'assign' : 'update', entity: c.e, recordId: body.id, label: labelOf(data), details: { fields: changed, ...(reassigned ? { from: (avant as any)?.agent ?? null, to: (data as any)?.agent ?? null } : {}) } })
    if (c.e === 'leads' && changed.includes('agent')) await logAssignment(who, { leadId: body.id, leadName: (data as any)?.name, from: (avant as any)?.agent, to: (data as any)?.agent, reason: 'manual' })
  }
  return NextResponse.json({ row: data, ...(dropped.length ? { dropped } : {}) })
}

export async function DELETE(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (!canWrite(c.e!, 'delete', c.viewer!)) return interdit()
  const id = req.nextUrl.searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: avant } = await supabaseAdmin.from(c.table!).select('*').eq('id', id).eq('client_id', c.auth!.clientId).maybeSingle()
  const { error } = await supabaseAdmin.from(c.table!).delete().eq('id', id).eq('client_id', c.auth!.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity({ clientId: c.auth!.clientId, id: c.auth!.clientUserId, name: c.viewer!.name, role: c.auth!.role }, { action: 'delete', entity: c.e, recordId: id, label: labelOf(avant) })
  return NextResponse.json({ ok: true })
}
