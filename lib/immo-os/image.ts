// Detecte le vrai type d'une image par ses premiers octets (on ne fait pas confiance au Content-Type du navigateur).
export type Sniffed = { ext: 'jpg' | 'png' | 'webp'; mime: 'image/jpeg' | 'image/png' | 'image/webp' }
export function sniffImage(b: Uint8Array): Sniffed | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: 'png', mime: 'image/png' }
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', mime: 'image/webp' }
  return null
}
// Limite cote serveur : les fonctions serverless plafonnent le corps de requete autour de 4,5 Mo ; le navigateur reduit deja l'image.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
