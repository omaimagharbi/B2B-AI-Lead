// Parsing pur des webhooks GreenAPI (aucune dependance base) : testable seul.

export const digits = (s: string) => s.replace(/[^0-9]/g, '')
// Deux numeros sont le meme contact si leurs derniers chiffres communs sont identiques : on compare
// les 9 derniers chiffres, ou moins si l'un des numeros est court (ex. 55123456 saisi sans indicatif
// 974 doit correspondre a 97455123456). Minimum 8 chiffres de chaque cote.
export const sameNumber = (a?: string | null, b?: string | null) => {
  const x = digits(a ?? '')
  const y = digits(b ?? '')
  if (x.length < 8 || y.length < 8) return false
  const n = Math.min(9, x.length, y.length)
  return x.slice(-n) === y.slice(-n)
}

export type Incoming = { phone: string; text: string; senderName: string | null; messageId: string | null }

// Notification GreenAPI "incomingMessageReceived" -> message exploitable, ou null (groupe, pas de numero...).
export function parseIncoming(body: any): Incoming | null {
  if (body?.typeWebhook !== 'incomingMessageReceived') return null
  const chatId = String(body.senderData?.chatId ?? body.senderData?.sender ?? '')
  if (!chatId || chatId.endsWith('@g.us')) return null // on ignore les groupes
  const phone = String(body.senderData?.sender ?? chatId).replace('@c.us', '')
  if (digits(phone).length < 8) return null
  const m = body.messageData ?? {}
  const text: string =
    m.textMessageData?.textMessage ??
    m.extendedTextMessageData?.text ??
    m.fileMessageData?.caption ??
    `[${String(m.typeMessage ?? 'media').replace('Message', '')}]`
  const name = typeof body.senderData?.senderName === 'string' ? body.senderData.senderName.trim() : ''
  return { phone, text: text.slice(0, 4000), senderName: name || null, messageId: typeof body.idMessage === 'string' ? body.idMessage : null }
}

