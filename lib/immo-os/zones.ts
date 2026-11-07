import type { Lang } from './i18n'
import { AREAS, type Zone, type ZoneLevel } from './types'

// Aides pour la hierarchie configurable municipalite > zone > projet (> unite = bien).
export const zoneLabel = (z: Pick<Zone, 'name' | 'name_ar'>, lang: Lang) => (lang === 'ar' && z.name_ar ? z.name_ar : z.name)

// Chemin du noeud : [municipalite, zone, projet] (les niveaux manquants sont simplement absents).
export function zonePath(zones: Zone[], id?: string | null): Zone[] {
  const byId = new Map(zones.map((z) => [z.id, z]))
  const out: Zone[] = []
  let cur = id ? byId.get(id) : undefined
  for (let i = 0; cur && i < 4; i++) {
    out.unshift(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return out
}
export const pathText = (zones: Zone[], id: string | null | undefined, lang: Lang, sep = ' › ') => zonePath(zones, id).map((z) => zoneLabel(z, lang)).join(sep)

// Nom de la zone (niveau "zone") du noeud : sert a remplir le champ historique "area" du bien (filtres, annonces, IA).
export function areaOf(zones: Zone[], id?: string | null): string | null {
  const p = zonePath(zones, id)
  return (p.find((z) => z.level === 'zone') ?? p[p.length - 1])?.name ?? null
}

// Noeuds que l'on peut choisir pour un bien (zone ou projet), tries par chemin.
export function locationOptions(zones: Zone[], lang: Lang): { id: string; label: string; level: ZoneLevel }[] {
  return zones
    .filter((z) => z.level !== 'municipality')
    .map((z) => ({ id: z.id, label: pathText(zones, z.id, lang), level: z.level }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Ids du noeud et de tous ses descendants (filtre "tout ce qui est dans cette municipalite / zone / ce projet").
export function subtreeIds(zones: Zone[], id: string): Set<string> {
  const out = new Set<string>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const z of zones) if (z.parent_id && out.has(z.parent_id) && !out.has(z.id)) { out.add(z.id); grew = true }
  }
  return out
}

// Liste d'options pour filtrer par lieu : tous les niveaux. Sans zones configurees, on retombe sur la liste historique.
export function filterNodes(zones: Zone[], lang: Lang): { id: string; label: string }[] {
  return zones.map((z) => ({ id: z.id, label: pathText(zones, z.id, lang) })).sort((a, b) => a.label.localeCompare(b.label))
}
export const legacyAreas = (zones: Zone[]) => (zones.length ? zones.filter((z) => z.level === 'zone').map((z) => z.name) : AREAS)
