// Lot 8 (n°12) : carte. OpenStreetMap par defaut (aucune cle) ; Google Maps seulement si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY est defini.
// (n°11 / n°71) : controle des videos. Fonctions pures.
export type Coords = { lat: number; lng: number }
const ok = (lat: number, lng: number): Coords | null => (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0) ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 } : null)

// Lit des coordonnees collees : "25.3548, 51.4999", "25.3548 51.4999", ou un lien Google Maps (@lat,lng / q=lat,lng / !3dLAT!4dLNG) ou OpenStreetMap (#map=z/lat/lng, mlat= & mlon=)
export function parseCoords(input: string | null | undefined): Coords | null {
  const t = decodeURIComponent(String(input ?? '').trim().replace(/%(?![0-9a-f]{2})/gi, ''))
  if (!t) return null
  let m = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(t) ?? /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(t) ?? /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)[, ]+(-?\d+(?:\.\d+)?)/.exec(t)
  if (m) return ok(parseFloat(m[1]), parseFloat(m[2]))
  m = /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(t) ?? /mlat=(-?\d+(?:\.\d+)?).*mlon=(-?\d+(?:\.\d+)?)/.exec(t)
  if (m) return ok(parseFloat(m[1]), parseFloat(m[2]))
  m = /^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/.exec(t)
  return m ? ok(parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.'))) : null
}

export function osmEmbedUrl(c: Coords): string {
  const d = 0.006
  return `https://www.openstreetmap.org/export/embed.html?bbox=${c.lng - d},${c.lat - d},${c.lng + d},${c.lat + d}&layer=mapnik&marker=${c.lat},${c.lng}`
}
export const osmLink = (c: Coords) => `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=17/${c.lat}/${c.lng}`
export const googleLink = (c: Coords) => `https://www.google.com/maps?q=${c.lat},${c.lng}`
export const googleEmbedUrl = (c: Coords, key: string) => `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${c.lat},${c.lng}&zoom=16`
// Carte d'un bien : Google si une cle est fournie, sinon OpenStreetMap
export const mapEmbed = (c: Coords, googleKey?: string | null): { url: string; provider: 'google' | 'osm' } => (googleKey ? { url: googleEmbedUrl(c, googleKey), provider: 'google' } : { url: osmEmbedUrl(c), provider: 'osm' })

// Videos : 50 Mo maximum, MP4 / WebM / MOV (meme limite que le bucket Supabase : elle est appliquee aussi cote stockage)
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
export const VIDEO_BUCKET = 'immo-video'
export const videoExt = (mime: string, name = ''): string | null => VIDEO_TYPES[mime] ?? ({ mp4: 'mp4', webm: 'webm', mov: 'mov' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? null
export function isOwnVideoUrl(url: unknown, supabaseUrl: string | undefined, clientId: string): boolean {
  return typeof url === 'string' && !!supabaseUrl && url.startsWith(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${VIDEO_BUCKET}/${clientId}/`) && !url.includes('..')
}
