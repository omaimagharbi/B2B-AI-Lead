import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { traiterMessageImmo } from '@/lib/immo-os/inbound'
import { downloadMetaMedia, parseMetaWebhook, sendMeta, verifySignature } from '@/lib/immo-os/wa-meta'
import { CHAT_BUCKET, inboundMime } from '@/lib/immo-os/media'

// Webhook WhatsApp Business (Meta) : /api/immo?r=meta  (meme fonction que tout l'immo : pas de nouvelle route).
// GET  : verification de l'URL par Meta (hub.challenge) avec META_WA_VERIFY_TOKEN.
// POST : messages entrants et statuts de livraison, signes (X-Hub-Signature-256, secret META_WA_APP_SECRET). Signature invalide = 401.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const token = process.env.META_WA_VERIFY_TOKEN
  if (token && q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === token) {
    return new Response(q.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), process.env.META_WA_APP_SECRET)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ ok: true }) }
  const { messages, statuses } = parseMetaWebhook(body)
  // Meta reessaie tant qu'on ne repond pas 200 : on journalise les erreurs internes mais on repond toujours 200 apres la signature.
  try {
    const ids = Array.from(new Set([...messages, ...statuses].map((x) => x.phoneNumberId)))
    if (!ids.length) return NextResponse.json({ ok: true })
    const { data: nums } = await supabaseAdmin.from('re_wa_numbers').select('phone_number_id, client_id').in('phone_number_id', ids).eq('active', true)
    const owner = new Map((nums ?? []).map((n) => [n.phone_number_id as string, n.client_id as string]))
    for (const m of messages) {
      const clientId = owner.get(m.phoneNumberId)
      if (!clientId) continue // numero non enregistre dans une agence : ignore
      // n°35 : fichier recu (photo, PDF, vocal) telecharge chez Meta puis range dans le stockage de l'agence ; en cas d'echec le message texte est quand meme garde
      let media: { url: string; type: 'image' | 'document' | 'audio' | 'video'; name: string | null } | undefined
      if (m.media) {
        const kind = inboundMime(m.media.mime)
        const file = kind ? await downloadMetaMedia(m.media.id) : null
        if (kind && file) {
          const path = `${clientId}/in/${crypto.randomUUID()}.${kind.ext}`
          const { error } = await supabaseAdmin.storage.from(CHAT_BUCKET).upload(path, file.bytes, { contentType: m.media.mime ?? undefined, cacheControl: '31536000', upsert: false })
          if (!error) media = { url: supabaseAdmin.storage.from(CHAT_BUCKET).getPublicUrl(path).data.publicUrl, type: kind.type, name: m.media.filename }
        }
      }
      await traiterMessageImmo(
        { phone: m.from, text: m.text, messageId: m.id, senderName: m.name },
        { clientId, channel: 'meta', media, reply: async (to, text) => { await sendMeta(m.phoneNumberId, to, { kind: 'text', text }) } }, // reponse STOP / START : la fenetre de 24 h vient de s'ouvrir
      )
    }
    for (const s of statuses) {
      const clientId = owner.get(s.phoneNumberId)
      if (!clientId) continue
      await supabaseAdmin.from('re_messages').update({ wa_status: s.status, wa_error: s.error }).eq('client_id', clientId).eq('external_id', s.id)
    }
  } catch (e) { console.error('immo meta webhook:', e) }
  return NextResponse.json({ ok: true })
}
