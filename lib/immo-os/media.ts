import { sniffImage } from './image'

// Lot 6b (n°35) : fichiers des conversations WhatsApp. Fonctions pures (aucune dependance Node).
export type MediaType = 'image' | 'document' | 'audio' | 'video'
export const CHAT_MAX_BYTES = 4 * 1024 * 1024 // plafond du corps de requete des fonctions serverless
export const MAX_MEDIA_PER_SEND = 6
export const CHAT_BUCKET = 'immo-chat'

// Fichier envoye par un agent : image (JPG / PNG / WebP) ou PDF, verifie par ses premiers octets (jamais par l'extension ou le Content-Type).
export function sniffChatFile(b: Uint8Array): { ext: string; mime: string; type: MediaType } | null {
  const img = sniffImage(b)
  if (img) return { ext: img.ext, mime: img.mime, type: 'image' }
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { ext: 'pdf', mime: 'application/pdf', type: 'document' }
  return null
}

// Types acceptes en reception (Meta, apres verification de la signature du webhook)
export const INBOUND_MIME: Record<string, { ext: string; type: MediaType }> = {
  'image/jpeg': { ext: 'jpg', type: 'image' }, 'image/png': { ext: 'png', type: 'image' }, 'image/webp': { ext: 'webp', type: 'image' },
  'application/pdf': { ext: 'pdf', type: 'document' },
  'audio/ogg': { ext: 'ogg', type: 'audio' }, 'audio/mpeg': { ext: 'mp3', type: 'audio' }, 'audio/mp4': { ext: 'm4a', type: 'audio' }, 'audio/aac': { ext: 'aac', type: 'audio' }, 'audio/amr': { ext: 'amr', type: 'audio' },
  'video/mp4': { ext: 'mp4', type: 'video' },
}
export const inboundMime = (mime: string | null | undefined) => INBOUND_MIME[String(mime ?? '').split(';')[0].trim().toLowerCase()] ?? null

// Une URL de fichier a envoyer doit venir du stockage de L'AGENCE (photos de biens ou fichiers de conversation) : jamais une URL libre.
export function isOwnMediaUrl(url: unknown, supabaseUrl: string | undefined, clientId: string): boolean {
  if (typeof url !== 'string' || !supabaseUrl) return false
  const base = supabaseUrl.replace(/\/$/, '')
  return ['immo-photos', CHAT_BUCKET].some((b) => url.startsWith(`${base}/storage/v1/object/public/${b}/${clientId}/`)) && !url.includes('..')
}
export const mediaTypeFromUrl = (url: string): MediaType => (/\.pdf($|\?)/i.test(url) ? 'document' : 'image')
