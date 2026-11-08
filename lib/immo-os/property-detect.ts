import type { Property } from './types'
import { AREAS } from './types'
import { parseSearch } from './helpers'

// n°105 : identifier le bien dont un client parle dans un message WhatsApp (fonction pure, utilisee par le serveur
// au moment de la reception et par l'ecran WhatsApp pour les anciens messages / le mode demo).
export type PropLite = Pick<Property, 'id' | 'title' | 'type' | 'listing' | 'status' | 'beds' | 'price'> & { area?: string | null; unit_no?: string | null }
export type DetectReason = 'link' | 'ref' | 'unit' | 'title' | 'attributes'
export type Detected = { propertyId: string; confidence: number; reason: DetectReason } | null

// Seuils : en dessous de MIN_MESSAGE on ne rattache rien ; le lead ne recoit un bien (s'il n'en a pas) qu'a partir de MIN_LEAD.
export const MIN_MESSAGE = 0.5
export const MIN_LEAD = 0.8

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const norm = (s: string) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()

// Reference courte lisible, ajoutee aux messages de fiche envoyes aux clients (le client la recopie ou y repond)
export const propRef = (id: string) => `REF-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`

export function detectProperty(text: string, props: PropLite[], opts: { leadPropertyId?: string | null } = {}): Detected {
  const raw = String(text ?? '')
  if (!raw.trim() || !props.length) return null

  // 1) lien ou identifiant complet (lien du formulaire public ...&property=<uuid>)
  for (const m of raw.match(UUID_RE) ?? []) {
    const hit = props.find((p) => p.id.toLowerCase() === m.toLowerCase())
    if (hit) return { propertyId: hit.id, confidence: 1, reason: 'link' }
  }
  // 2) reference courte REF-XXXXXXXX
  const ref = /\bref[\s:#-]*([0-9a-f]{8})\b/i.exec(raw)
  if (ref) {
    const key = ref[1].toLowerCase()
    const hits = props.filter((p) => p.id.replace(/-/g, '').toLowerCase().startsWith(key))
    if (hits.length === 1) return { propertyId: hits[0].id, confidence: 0.98, reason: 'ref' }
  }

  const t = ` ${norm(raw)} `
  // 3) numero d'unite (ex. A-804, V-12) : un seul bien concerne
  const units = props.filter((p) => p.unit_no && norm(p.unit_no).length >= 3 && t.includes(` ${norm(p.unit_no!)} `))
  if (units.length === 1) return { propertyId: units[0].id, confidence: 0.9, reason: 'unit' }

  // 4) titre du bien cite tel quel (departage par la zone, puis par le bien deja lie au lead)
  const titled = props.filter((p) => { const n = norm(p.title); return n.length >= 6 && t.includes(` ${n} `) })
  if (titled.length === 1) return { propertyId: titled[0].id, confidence: 0.85, reason: 'title' }
  if (titled.length > 1) {
    const byArea = titled.filter((p) => p.area && t.includes(` ${norm(p.area)} `))
    if (byArea.length === 1) return { propertyId: byArea[0].id, confidence: 0.85, reason: 'title' }
    const lead = titled.find((p) => p.id === opts.leadPropertyId)
    if (lead) return { propertyId: lead.id, confidence: 0.8, reason: 'title' }
    return null // plusieurs biens portent ce titre : on ne devine pas
  }

  // 5) description : type + zone (+ chambres), seulement parmi les biens disponibles et si UN SEUL bien correspond
  const q = parseSearch(raw, Array.from(new Set([...AREAS, ...props.map((p) => p.area ?? '').filter(Boolean)])))
  if (q.type && q.area) {
    const c = props.filter((p) => p.status === 'available' && p.type === q.type && p.area === q.area && (!q.listing || p.listing === q.listing) && (!q.minBeds || p.beds === q.minBeds))
    if (c.length === 1) return { propertyId: c[0].id, confidence: 0.6, reason: 'attributes' }
  }
  return null
}

// Bien "en discussion" d'une conversation : dernier message rattache a un bien, sinon detection sur les derniers messages du client, sinon bien du lead.
export function conversationProperty(
  msgs: { direction: 'in' | 'out'; body: string; property_id?: string | null; property_auto?: boolean }[],
  props: PropLite[],
  leadPropertyId?: string | null,
): { propertyId: string; source: 'message' | 'detected' | 'lead'; auto: boolean; confidence: number } | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m.property_id && props.some((p) => p.id === m.property_id)) return { propertyId: m.property_id, source: 'message', auto: !!m.property_auto, confidence: m.property_auto ? 0.8 : 1 }
  }
  for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 8); i--) {
    if (msgs[i].direction !== 'in') continue
    const d = detectProperty(msgs[i].body, props, { leadPropertyId })
    if (d && d.confidence >= MIN_MESSAGE) return { propertyId: d.propertyId, source: 'detected', auto: true, confidence: d.confidence }
  }
  if (leadPropertyId && props.some((p) => p.id === leadPropertyId)) return { propertyId: leadPropertyId, source: 'lead', auto: false, confidence: 0.7 }
  return null
}
