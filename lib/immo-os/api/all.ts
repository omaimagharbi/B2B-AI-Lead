import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { ENTITIES, ENTITY_KEYS, type Entity } from '@/lib/immo-os/types'
import { tableAbsente } from '@/lib/immo-os/server'
import { filterForViewer } from '@/lib/immo-os/permissions'

// Tables ajoutees par une migration ulterieure : si elles manquent, on renvoie une liste vide (et non le mode demo)
const OPTIONNELLES = new Set<Entity>(['visits'])

export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const result: Record<string, unknown[]> = {}
  for (const key of ENTITY_KEYS) {
    const { data, error } = await supabaseAdmin
      .from(ENTITIES[key].table)
      .select('*')
      .eq('client_id', auth.clientId)
      .order('created_at', { ascending: false })
      .limit(2000)
    if (error) {
      if (tableAbsente(error)) {
        if (OPTIONNELLES.has(key)) { result[key] = []; continue }
        return NextResponse.json({ demo: true, reason: 'migration_70_missing' })
      }
      console.error('immo/all', key, error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    result[key] = data ?? []
  }
  // Un agent ne recoit que ses propres leads / clients / deals / visites (filtre cote serveur, pas cote ecran)
  return NextResponse.json({ demo: false, data: filterForViewer(result, { role: auth.role, name: auth.name }) })
}
