import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { ENTITIES, type Entity } from '@/lib/immo-os/types'
import { sanitize, isUuid } from '@/lib/immo-os/server'
import { canWrite, isManager } from '@/lib/immo-os/permissions'

const SCOPED = new Set<Entity>(['leads', 'clients', 'deals', 'visits'])

async function contexte(req: NextRequest, entity: string) {
  if (!(entity in ENTITIES)) return { err: NextResponse.json({ error: 'Unknown entity' }, { status: 404 }) }
  const auth = await contexteImmo(req)
  if (auth.erreur) return { err: NextResponse.json({ error: auth.erreur }, { status: auth.statut }) }
  return { auth, e: entity as Entity, table: ENTITIES[entity as Entity].table, viewer: { role: auth.role, name: auth.name } }
}
const interdit = () => NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })

export async function POST(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (!canWrite(c.e!, 'create', c.viewer!)) return interdit()
  const body = await req.json().catch(() => ({}))
  const row: Record<string, unknown> = { ...sanitize(c.e!, body), client_id: c.auth!.clientId }
  // Un agent cree toujours pour lui-meme
  if (!isManager(c.viewer!.role) && SCOPED.has(c.e!)) row.agent = c.viewer!.name
  let { data, error } = await supabaseAdmin.from(c.table!).insert(row).select('*').single()
  if (error?.code === 'PGRST204' && 'category' in row) { // colonne category absente (migration 73 pas faite) : on enregistre sans elle
    const { category, ...sans } = row
    ;({ data, error } = await supabaseAdmin.from(c.table!).insert(sans).select('*').single())
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ row: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (!isManager(c.viewer!.role)) {
    if (c.e === 'owners') return interdit()
    if (SCOPED.has(c.e!)) {
      const { data: existing } = await supabaseAdmin.from(c.table!).select('agent').eq('id', body.id).eq('client_id', c.auth!.clientId).maybeSingle()
      if (!canWrite(c.e!, 'update', c.viewer!, existing)) return interdit()
    }
  }
  const patch = sanitize(c.e!, body)
  if (!isManager(c.viewer!.role)) delete patch.agent // un agent ne peut pas se reassigner / reassigner un lead
  let { data, error } = await supabaseAdmin.from(c.table!).update(patch).eq('id', body.id).eq('client_id', c.auth!.clientId).select('*').single()
  if (error?.code === 'PGRST204' && 'category' in patch) {
    const { category, ...sans } = patch
    ;({ data, error } = await supabaseAdmin.from(c.table!).update(sans).eq('id', body.id).eq('client_id', c.auth!.clientId).select('*').single())
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ row: data })
}

export async function DELETE(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (!canWrite(c.e!, 'delete', c.viewer!)) return interdit()
  const id = req.nextUrl.searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin.from(c.table!).delete().eq('id', id).eq('client_id', c.auth!.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
