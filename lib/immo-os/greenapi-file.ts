// Lot 6b : envoi d'un fichier (image / PDF) par lien via GreenAPI (repli, sans numero Meta). Memes variables que lib/notifications.ts.
export async function envoyerFichierGreenApi(telephone: string, url: string, caption: string, fileName: string): Promise<void> {
  const id = process.env.GREENAPI_ID_INSTANCE
  const token = process.env.GREENAPI_API_TOKEN
  if (!id || !token) throw new Error('GreenAPI is not configured')
  const chatId = `${telephone.replace(/\D/g, '')}@c.us`
  const res = await fetch(`https://api.green-api.com/waInstance${id}/sendFileByUrl/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, urlFile: url, fileName, caption: caption.slice(0, 1000) }) })
  if (!res.ok) throw new Error(`GreenAPI HTTP ${res.status}`)
}
