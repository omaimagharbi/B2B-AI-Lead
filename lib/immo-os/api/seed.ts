import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { isManager } from '@/lib/immo-os/permissions'
import { ENTITIES, type Entity } from '@/lib/immo-os/types'
import { sanitize, isUuid, tableAbsente, colonneAbsente } from '@/lib/immo-os/server'

// Insere le jeu de donnees d'exemple dans le cabinet courant, uniquement si l'espace est encore vide.
export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  if (!isManager(auth.role)) return NextResponse.json({ error: 'Only managers can load sample data' }, { status: 403 })

  const { count } = await supabaseAdmin.from('re_properties').select('id', { count: 'exact', head: true }).eq('client_id', auth.clientId)
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'Workspace is not empty' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const ordre: Entity[] = ['zones', 'owners', 'properties', 'clients', 'leads', 'deals', 'messages', 'visits']
  for (const e of ordre) {
    const rows = Array.isArray(body?.[e]) ? (body[e] as Record<string, unknown>[]).slice(0, 100) : []
    if (!rows.length) continue
    const payload = rows.map((r) => ({
      ...sanitize(e, r),
      ...(isUuid(r.id) ? { id: r.id } : {}),
      ...(typeof r.created_at === 'string' ? { created_at: r.created_at } : {}),
      client_id: auth.clientId,
    }))
    // Colonnes d'une migration pas encore faite (74) : retirees de chaque ligne au lieu de faire echouer le chargement
    let error: { code?: string; message?: string } | null = null
    const dropAll = new Set<string>()
    for (let i = 0; i < 8; i++) {
      const rows2 = payload.map((r) => { const c = { ...r } as Record<string, unknown>; dropAll.forEach((k) => delete c[k]); return c })
      const res = await supabaseAdmin.from(ENTITIES[e].table).insert(rows2)
      error = res.error
      const col = colonneAbsente(error)
      if (!col || dropAll.has(col)) break
      dropAll.add(col)
    }
    if (error) {
      if ((e === 'visits' || e === 'zones') && tableAbsente(error)) continue // migration pas encore faite : on saute
      return NextResponse.json({ error: `${e}: ${error.message}` }, { status: 400 })
    }
  }
  return NextResponse.json({ ok: true })
}
