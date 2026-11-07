import { ENTITIES, type Entity } from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

const NUMERIC = new Set(['price', 'beds', 'baths', 'size_m2', 'budget', 'score', 'value', 'commission_pct', 'duration_min'])
const NULLABLE_INT = new Set(['usufruct_years', 'beds_wanted'])
const UUID_FIELDS = new Set(['owner_id', 'property_id', 'lead_id', 'zone_id', 'parent_id', 'member_id', 'reports_to'])
const DATES = new Set(['starts_at', 'closed_at', 'last_contact'])
const ENUMS: Record<string, string[]> = { tenure: ['freehold', 'usufruct'], level: ['municipality', 'zone', 'project'] }
export const MAX_PHOTOS = 12

// Liste de photos : uniquement des URLs http(s), sans doublon, 12 maximum.
export function cleanPhotos(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : []
  const out: string[] = []
  for (const x of arr) {
    if (typeof x !== 'string') continue
    const u = x.trim()
    if (/^https?:\/\//i.test(u) && u.length <= 1000 && !out.includes(u)) out.push(u)
    if (out.length >= MAX_PHOTOS) break
  }
  return out
}

// Ne garde que les champs autorises de l'entite et force leur type. Jamais de client_id venant du navigateur.
export function sanitize(entity: Entity, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of ENTITIES[entity].fields) {
    if (!(f in input)) continue
    let v = input[f]
    if (f === 'photos') {
      out[f] = cleanPhotos(v)
      continue
    }
    if (ENUMS[f]) {
      out[f] = typeof v === 'string' && ENUMS[f].includes(v) ? v : f === 'level' ? 'zone' : null
      continue
    }
    if (NULLABLE_INT.has(f)) {
      const n = Math.round(Number(v))
      out[f] = v === null || v === '' || !Number.isFinite(n) || n <= 0 ? null : Math.min(n, 999)
      continue
    }
    if (NUMERIC.has(f)) {
      const n = Number(v)
      v = Number.isFinite(n) ? n : 0
    } else if (UUID_FIELDS.has(f)) {
      v = isUuid(v) ? v : null
    } else if (DATES.has(f) && v !== null && v !== '') {
      const t = new Date(String(v))
      v = Number.isNaN(t.getTime()) ? null : t.toISOString()
    } else if (f === 'featured' || f === 'unread' || f === 'is_lead') {
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

// Colonne d'une migration pas encore executee (ex. 74) : PostgREST renvoie PGRST204 ("Could not find the 'x' column ...").
// Retourne le nom de la colonne manquante, ou null si l'erreur est autre.
export function colonneAbsente(err: { code?: string; message?: string } | null | undefined): string | null {
  if (!err || (err.code !== 'PGRST204' && err.code !== '42703')) return null
  const m = /'([a-z_0-9]+)' column|column "?([a-z_0-9.]+)"?/i.exec(err.message ?? '')
  return (m?.[1] ?? m?.[2] ?? '').split('.').pop() || null
}
// Execute une ecriture ; tant qu'une colonne manque (migration pas faite), la retire de la ligne et recommence (8 fois max).
// `dropped` liste les champs non enregistres pour que l'ecran previenne l'utilisateur.
export async function ecrireTolerant<T extends Record<string, unknown>>(
  row: T,
  run: (r: Partial<T>) => PromiseLike<{ data: any; error: { code?: string; message?: string } | null }>,
): Promise<{ data: any; error: { code?: string; message?: string } | null; dropped: string[] }> {
  let cur: Partial<T> = { ...row }
  const dropped: string[] = []
  for (let i = 0; i < 8; i++) {
    const res = await run(cur)
    const col = colonneAbsente(res.error)
    if (!col || !(col in cur)) return { ...res, dropped }
    delete (cur as any)[col]
    dropped.push(col)
  }
  return { data: null, error: { message: 'Too many missing columns' }, dropped }
}
