import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { isManager } from '@/lib/immo-os/permissions'
import { ENTITIES, type Entity } from '@/lib/immo-os/types'
import { sanitize, isUuid, tableAbsente } from '@/lib/immo-os/server'

// Insere le jeu de donnees d'exemple dans le cabinet courant, uniquement si l'espace est encore vide.
export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  if (!isManager(auth.role)) return NextResponse.json({ error: 'Only managers can load sample data' }, { status: 403 })

  const { count } = await supabaseAdmin.from('re_properties').select('id', { count: 'exact', head: true }).eq('client_id', auth.clientId)
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'Workspace is not empty' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const ordre: Entity[] = ['owners', 'properties', 'clients', 'leads', 'deals', 'messages', 'visits']
  for (const e of ordre) {
    const rows = Array.isArray(body?.[e]) ? (body[e] as Record<string, unknown>[]).slice(0, 100) : []
    if (!rows.length) continue
    const payload = rows.map((r) => ({
      ...sanitize(e, r),
      ...(isUuid(r.id) ? { id: r.id } : {}),
      ...(typeof r.created_at === 'string' ? { created_at: r.created_at } : {}),
      client_id: auth.clientId,
    }))
    const { error } = await supabaseAdmin.from(ENTITIES[e].table).insert(payload)
    if (error) {
      if (e === 'visits' && tableAbsente(error)) continue // migration 72 pas encore faite : on saute les visites
      return NextResponse.json({ error: `${e}: ${error.message}` }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}
