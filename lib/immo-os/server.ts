import { ENTITIES, type Entity } from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

const NUMERIC = new Set(['price', 'beds', 'baths', 'size_m2', 'budget', 'score', 'value', 'commission_pct', 'duration_min'])
const UUID_FIELDS = new Set(['owner_id', 'property_id', 'lead_id'])
const DATES = new Set(['starts_at', 'closed_at', 'last_contact'])

// Ne garde que les champs autorises de l'entite et force leur type. Jamais de client_id venant du navigateur.
export function sanitize(entity: Entity, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of ENTITIES[entity].fields) {
    if (!(f in input)) continue
    let v = input[f]
    if (NUMERIC.has(f)) {
      const n = Number(v)
      v = Number.isFinite(n) ? n : 0
    } else if (UUID_FIELDS.has(f)) {
      v = isUuid(v) ? v : null
    } else if (DATES.has(f) && v !== null && v !== '') {
      const t = new Date(String(v))
      v = Number.isNaN(t.getTime()) ? null : t.toISOString()
    } else if (f === 'featured' || f === 'unread') {
      v = Boolean(v)
    } else if (typeof v === 'string') {
      v = v.trim().slice(0, 4000)
    } else if (v !== null && v !== undefined) {
      v = String(v).slice(0, 4000)
    }
    out[f] = v === '' ? null : v
  }
  return out
}

// Tables absentes (migration 70 pas encore executee) -> le front bascule en mode demo.
export function tableAbsente(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message ?? '')
}
