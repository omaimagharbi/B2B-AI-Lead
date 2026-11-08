import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { ENTITIES, SERVER_ONLY_ENTITIES, type Entity } from '@/lib/immo-os/types'
import { sanitize, isUuid, ecrireTolerant } from '@/lib/immo-os/server'
import { canWrite, isManager } from '@/lib/immo-os/permissions'
import { logActivity, logAssignment, labelOf } from '@/lib/immo-os/activity'
import { PARENT_LEVEL, type ZoneLevel } from '@/lib/immo-os/types'
import { onDealStatusChange, onLeadStatusChange } from '@/lib/immo-os/api/deal-steps'
import { alerterLeadChaud } from '@/lib/immo-os/api/hot-alerts'
import { becameHot } from '@/lib/immo-os/hot-alert'
import { POLICY_VERSION } from '@/lib/immo-os/policy'

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
const COMPLIANT = new Set<Entity>(['leads', 'clients', 'owners']) // fiches avec "ne plus contacter" (migration 78)
// Un agent ne peut enregistrer un resultat de contact que sur SES conversations (lead ou client qui lui est attribue)
async function contactDeLAgent(clientId: string, name: string, agent: string): Promise<boolean> {
  for (const t of ['re_leads', 're_clients']) {
    const { data } = await supabaseAdmin.from(t).select('agent').eq('client_id', clientId).ilike('name', name.trim()).limit(20)
    if ((data ?? []).some((r) => String(r.agent ?? '').trim().toLowerCase() === agent.trim().toLowerCase())) return true
  }
  return false
}

export async function POST(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (SERVER_ONLY_ENTITIES.includes(c.e!) || !canWrite(c.e!, 'create', c.viewer!)) return interdit()
  const body = await req.json().catch(() => ({}))
  const row: Record<string, unknown> = { ...sanitize(c.e!, body), client_id: c.auth!.clientId }
  if (c.e === 'outcomes') {
    row.agent = c.viewer!.name // l'auteur est toujours celui qui enregistre
    if (!row.contact_name) return NextResponse.json({ error: 'contact_name required' }, { status: 400 })
    if (!isManager(c.viewer!.role) && !(await contactDeLAgent(c.auth!.clientId, String(row.contact_name), c.viewer!.name))) return interdit()
  }
  if (COMPLIANT.has(c.e!) && row.do_not_contact === true) { row.do_not_contact_at = new Date().toISOString(); row.do_not_contact_reason = 'manual' }
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
  // Lot 4 : historique d'etapes des leads et deals, actions automatiques du deal, alerte lead chaud
  if (c.e === 'leads' && data?.id) { await onLeadStatusChange(who, data, null); if (becameHot(null, data)) await alerterLeadChaud(c.auth!.clientId, data) }
  if (c.e === 'deals' && data?.id) await onDealStatusChange(who, data, null)
  return NextResponse.json({ row: data, ...(dropped.length ? { dropped } : {}) })
}

export async function PATCH(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  const body = await req.json().catch(() => ({}))
  if (!isUuid(body.id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
  if (SERVER_ONLY_ENTITIES.includes(c.e!)) return interdit()

  if (!isManager(c.viewer!.role)) {
    if (c.e === 'owners' || c.e === 'zones' || c.e === 'outcomes') return interdit()
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
  // Lot 5 : "ne plus contacter". Un agent peut bloquer un contact, mais seul un gestionnaire peut le rouvrir (nouveau consentement manuel).
  let dncChange: 'optout' | 'optin' | null = null
  if (COMPLIANT.has(c.e!) && 'do_not_contact' in patch) {
    const was = !!(avant as any)?.do_not_contact
    const wants = patch.do_not_contact === true
    if (was === wants) delete patch.do_not_contact
    else if (!wants && !isManager(c.viewer!.role)) delete patch.do_not_contact
    else if (wants) { Object.assign(patch, { do_not_contact_at: new Date().toISOString(), do_not_contact_reason: 'manual' }); dncChange = 'optout' }
    else { Object.assign(patch, { do_not_contact_at: null, do_not_contact_reason: null, consent_at: new Date().toISOString(), consent_source: 'manual', consent_version: POLICY_VERSION }); dncChange = 'optin' }
  }
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
  if (dncChange) await logActivity(who, { action: dncChange, entity: c.e, recordId: body.id, label: labelOf(data), details: { source: 'manual' } })
  // Lot 4 : historique d'etapes, actions automatiques du deal, alerte lead chaud (declenchee quand le lead VIENT de devenir chaud)
  if (c.e === 'leads' && data) {
    if ((avant as any)?.status !== data.status) await onLeadStatusChange(who, data, (avant as any)?.status ?? null)
    if (becameHot(avant as any, data)) await alerterLeadChaud(c.auth!.clientId, data)
  }
  if (c.e === 'deals' && data && (avant as any)?.status !== data.status) await onDealStatusChange(who, data, (avant as any)?.status ?? null)
  return NextResponse.json({ row: data, ...(dropped.length ? { dropped } : {}) })
}

export async function DELETE(req: NextRequest, { params }: { params: { entity: string } }) {
  const c = await contexte(req, params.entity)
  if (c.err) return c.err
  if (SERVER_ONLY_ENTITIES.includes(c.e!) || !canWrite(c.e!, 'delete', c.viewer!)) return interdit()
  const id = req.nextUrl.searchParams.get('id')
  if (!isUuid(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { data: avant } = await supabaseAdmin.from(c.table!).select('*').eq('id', id).eq('client_id', c.auth!.clientId).maybeSingle()
  const { error } = await supabaseAdmin.from(c.table!).delete().eq('id', id).eq('client_id', c.auth!.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity({ clientId: c.auth!.clientId, id: c.auth!.clientUserId, name: c.viewer!.name, role: c.auth!.role }, { action: 'delete', entity: c.e, recordId: id, label: labelOf(avant) })
  return NextResponse.json({ ok: true })
}
