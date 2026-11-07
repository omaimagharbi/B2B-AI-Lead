import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { envoyerWhatsapp } from '@/lib/notifications'
import { sameNumber } from '@/lib/immo-os/inbound-pure'

// Envoie un message WhatsApp (GreenAPI) puis l'enregistre dans l'inbox. Si GreenAPI n'est pas configure,
// le message est quand meme enregistre (sent=false) pour ne pas perdre la saisie.
export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { name, phone, body } = await req.json().catch(() => ({}))
  const texte = typeof body === 'string' ? body.trim().slice(0, 4000) : ''
  if (!texte || typeof name !== 'string') return NextResponse.json({ error: 'name and body required' }, { status: 400 })

  let sent = false
  let warning: string | null = null
  if (typeof phone === 'string' && phone.replace(/\D/g, '').length >= 8) {
    try {
      await envoyerWhatsapp(phone, texte)
      sent = true
    } catch (e) {
      warning = e instanceof Error ? e.message : 'WhatsApp sending failed'
    }
  } else {
    warning = 'No valid phone number for this contact'
  }

  const { data, error } = await supabaseAdmin
    .from('re_messages')
    .insert({ client_id: auth.clientId, contact_name: name.slice(0, 200), contact_phone: phone ?? null, direction: 'out', body: texte, unread: false })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Si le destinataire est un proprietaire de l'agence, son "dernier contact" est mis a jour (sans rien renvoyer au navigateur).
  if (sent && typeof phone === 'string') {
    const { data: owners } = await supabaseAdmin.from('re_owners').select('id, phone').eq('client_id', auth.clientId).not('phone', 'is', null).limit(5000)
    const hit = (owners ?? []).find((o) => sameNumber(o.phone, phone))
    if (hit) await supabaseAdmin.from('re_owners').update({ last_contact: new Date().toISOString() }).eq('id', hit.id).eq('client_id', auth.clientId) // erreur ignoree si migration 74 absente
  }
  return NextResponse.json({ row: data, sent, warning })
}
