import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { envoyerWhatsapp } from '@/lib/notifications'
import { sameNumber } from '@/lib/immo-os/inbound-pure'
import { contactOptedOut, tokenPourNumero } from '@/lib/immo-os/optout-server'
import { ecrireTolerant, isUuid } from '@/lib/immo-os/server'
import { translate, fmt, type Lang } from '@/lib/immo-os/i18n'
import { isTechnicalFailure, metaReady, renderTemplate, sendMeta, windowState } from '@/lib/immo-os/wa-meta'

// Envoie un message WhatsApp (GreenAPI) puis l'enregistre dans l'inbox. Si GreenAPI n'est pas configure,
// le message est quand meme enregistre (sent=false) pour ne pas perdre la saisie.
// Lot 4 : si `property_id` est fourni (fiche de bien envoyee au client), l'envoi est enregistre dans re_sends et le message est rattache au bien.
// Lot 6a : si l'agence a un numero WhatsApp Business (Meta) ET que META_WA_ACCESS_TOKEN est defini, l'envoi passe par l'API officielle ;
// hors fenetre de 24 h (dernier message du client), seul un modele approuve peut partir (409 window_closed sinon). GreenAPI reste le canal
// de l'agence sans numero Meta, et le repli si Meta est indisponible (panne, jeton expire) - jamais pour contourner une regle de Meta.
// Lot 5 : un contact "ne plus contacter" (STOP) ne recoit plus rien depuis l'application : l'envoi est refuse.
export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { name, phone, body, property_id, lang, template } = await req.json().catch(() => ({}))
  let texte = typeof body === 'string' ? body.trim().slice(0, 3800) : ''
  if ((!texte && !template) || typeof name !== 'string') return NextResponse.json({ error: 'name and body required' }, { status: 400 })

  if (typeof phone === 'string' && (await contactOptedOut(auth.clientId, phone))) {
    return NextResponse.json({ error: 'This contact asked not to be contacted (STOP). Message not sent.', code: 'opted_out' }, { status: 403 })
  }

  // Bien envoye : doit appartenir a l'agence
  let property: { id: string; title: string } | null = null
  if (isUuid(property_id)) {
    const { data } = await supabaseAdmin.from('re_properties').select('id, title').eq('id', property_id).eq('client_id', auth.clientId).maybeSingle()
    property = data ?? null
  }
  // Lien de desinscription en pied de message (comme la prospection B2B) pour les fiches de biens
  if (property && typeof phone === 'string') {
    const token = await tokenPourNumero(auth.clientId, phone)
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    if (token && site) {
      const l: Lang = lang === 'fr' || lang === 'ar' ? lang : 'en'
      texte += `\n\n${fmt(translate(l, 'pol.stop.link'), { url: `${site}/desinscription/${token}` })}`
    }
  }

  // --- Canal : Meta (officiel) si l'agence a un numero actif, sinon GreenAPI
  const validPhone = typeof phone === 'string' && phone.replace(/\D/g, '').length >= 8
  let numero: { phone_number_id: string } | null = null
  if (metaReady()) {
    const { data: n } = await supabaseAdmin.from('re_wa_numbers').select('phone_number_id').eq('client_id', auth.clientId).eq('active', true).order('created_at').limit(1)
    numero = n?.[0] ?? null
  }
  let tpl: { name: string; language: string; params: string[] } | null = null
  if (template && numero) {
    const params = Array.isArray(template.params) ? template.params.map((x: unknown) => String(x ?? '').slice(0, 200)) : []
    const { data: t } = await supabaseAdmin.from('re_wa_templates').select('name, language, body').eq('client_id', auth.clientId).eq('name', String(template.name)).eq('language', String(template.language)).eq('status', 'APPROVED').maybeSingle()
    if (!t) return NextResponse.json({ error: 'This message template is not approved for your agency', code: 'template_unknown' }, { status: 400 })
    tpl = { name: t.name, language: t.language, params }
    texte = renderTemplate(t.body, params).trim().slice(0, 3800) || `[${t.name}]`
  }
  if (!texte) return NextResponse.json({ error: 'name and body required' }, { status: 400 })
  if (numero && validPhone && !tpl) {
    const { data: ins } = await supabaseAdmin.from('re_messages').select('contact_phone, contact_name, created_at').eq('client_id', auth.clientId).eq('direction', 'in').order('created_at', { ascending: false }).limit(60)
    const last = (ins ?? []).find((m) => m.contact_name === name || sameNumber(m.contact_phone, phone))?.created_at ?? null
    if (!windowState(last).open) return NextResponse.json({ error: 'The 24-hour reply window is closed: only an approved message template can be sent.', code: 'window_closed' }, { status: 409 })
  }

  let sent = false
  let warning: string | null = null
  let channel: 'meta' | 'greenapi' = 'greenapi'
  let waId: string | null = null
  let tryGreen = !numero
  if (!validPhone) warning = 'No valid phone number for this contact'
  else if (numero) {
    const r = await sendMeta(numero.phone_number_id, phone, tpl ? { kind: 'template', ...tpl } : { kind: 'text', text: texte })
    if (r.ok) { sent = true; channel = 'meta'; waId = r.id }
    else if (isTechnicalFailure(r.status, r.code)) { tryGreen = true; warning = `Meta unavailable (${r.message}), GreenAPI used instead` }
    else warning = r.message
  }
  if (!sent && validPhone && tryGreen) {
    try { await envoyerWhatsapp(phone, texte); sent = true; channel = 'greenapi' } catch (e) { warning = e instanceof Error ? e.message : 'WhatsApp sending failed' }
  }

  const row = { client_id: auth.clientId, contact_name: name.slice(0, 200), contact_phone: phone ?? null, direction: 'out', body: texte, unread: false, ...(property ? { property_id: property.id, property_auto: false } : {}), ...(channel === 'meta' ? { channel: 'meta', external_id: waId, wa_status: 'sent' } : {}) }
  const { data, error } = await ecrireTolerant(row, (r) => supabaseAdmin.from('re_messages').insert(r).select('*').single())
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  // Si le destinataire est un proprietaire de l'agence, son "dernier contact" est mis a jour (sans rien renvoyer au navigateur).
  if (sent && typeof phone === 'string') {
    const { data: owners } = await supabaseAdmin.from('re_owners').select('id, phone').eq('client_id', auth.clientId).not('phone', 'is', null).limit(5000)
    const hit = (owners ?? []).find((o) => sameNumber(o.phone, phone))
    if (hit) await supabaseAdmin.from('re_owners').update({ last_contact: new Date().toISOString() }).eq('id', hit.id).eq('client_id', auth.clientId) // erreur ignoree si migration 74 absente
  }
  // n°4 : un enregistrement par fiche reellement envoyee (erreur ignoree si la migration 77 n'est pas faite)
  let send: unknown = null
  if (sent && property) {
    const { data: s } = await supabaseAdmin.from('re_sends').insert({ client_id: auth.clientId, property_id: property.id, property_title: property.title, contact_name: name.slice(0, 200), contact_phone: phone ?? null, agent: auth.name || null, channel: 'whatsapp' }).select('*').single()
    send = s ?? null
  }
  return NextResponse.json({ row: data, sent, warning, send, channel })
}
