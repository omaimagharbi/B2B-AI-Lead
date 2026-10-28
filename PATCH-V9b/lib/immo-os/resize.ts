'use client'
// Reduit une photo dans le navigateur (max 1600 px, JPEG) avant l'envoi : evite la limite de taille des requetes et economise le stockage.
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Only JPG, PNG or WebP images are accepted')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not supported by this browser')
  ctx.fillStyle = '#fff' // fond blanc pour les PNG transparents
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/jpeg', quality))
}
