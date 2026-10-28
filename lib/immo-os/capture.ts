import { supabaseAdmin } from '@/lib/supabase-admin'
import { sameNumber } from './inbound-pure'
import { validateCapture } from './capture-pure'

export type CaptureDeps = { notifier?: (phone: string, text: string) => Promise<void> }
export type CaptureResult = { status: number; body: { ok?: true; error?: string } }

// Traite une demande venant du formulaire public : cree (ou met a jour) le lead de l'agence, range le message
// dans l'inbox et previent le directeur par WhatsApp. Reponse volontairement generique : ne revele pas si le
// contact existait deja.
export async function traiterCapture(raw: unknown, ip: string, deps: CaptureDeps = {}): Promise<CaptureResult> {
  const v = validateCapture(raw, process.env.IMMO_DEFAULT_COUNTRY_CODE || '974')
  if (!v.ok) return { status: 400, body: { error: v.error } }
  const c = v.value
  if (c.honeypot) return { status: 200, body: { ok: true } } // robot : on fait semblant que tout va bien

  // Anti-abus : 5 envois / 10 min / IP (meme mecanisme que /api/diagnostic ; si la fonction SQL manque, on laisse passer)
  const { data: autorise } = await supabaseAdmin.rpc('verifier_rate_limit', { p_identifiant: `immo:${ip}`, p_max: 5, p_fenetre_minutes: 10 })
  if (autorise === false) return { status: 429, body: { error: 'Too many requests. Please try again in a few minutes.' } }

  const { data: cab } = await supabaseAdmin.from('clients').select('id, nom_entreprise, whatsapp_directeur').eq('id', c.agency).maybeSingle()
  if (!cab) return { status: 404, body: { error: 'Unknown agency' } }

  let property: { id: string; title: string; area: string | null } | null = null
  if (c.propertyId) {
    const { data } = await supabaseAdmin.from('re_properties').select('id, title, area, status').eq('id', c.propertyId).eq('client_id', c.agency).maybeSingle()
    if (data) property = data
  }
  const interest = (property ? `${property.title}${property.area ? ` - ${property.area}` : ''}` : c.message ?? 'Website enquiry').slice(0, 200)

  const { data: leads, error: lerr } = await supabaseAdmin.from('re_leads').select('id, phone').eq('client_id', c.agency).not('phone', 'is', null).limit(5000)
  if (lerr) return { status: 503, body: { error: 'Service temporarily unavailable' } }
  const existing = (leads ?? []).find((l) => sameNumber(l.phone, c.phone))
  const now = new Date().toISOString()
  let isNew = false

  if (existing) {
    await supabaseAdmin.from('re_leads').update({ last_contact: now }).eq('id', existing.id).eq('client_id', c.agency)
  } else {
    const { error } = await supabaseAdmin.from('re_leads').insert({
      client_id: c.agency, name: c.name, phone: c.phone, email: c.email, interest, property_id: property?.id ?? null,
      budget: c.budget, status: 'new', source: 'website', score: 60, notes: c.message, last_contact: now,
    })
    if (error) return { status: 503, body: { error: 'Service temporarily unavailable' } }
    isNew = true
  }

  // Le message du visiteur apparait dans l'inbox (non lu), sous le nom du lead
  const name = existing ? undefined : c.name
  let contact = name
  if (!contact) {
    const { data: l } = await supabaseAdmin.from('re_leads').select('name').eq('id', existing!.id).maybeSingle()
    contact = l?.name ?? c.name
  }
  await supabaseAdmin.from('re_messages').insert({
    client_id: c.agency, contact_name: contact, contact_phone: c.phone, direction: 'in', unread: true,
    body: `[Website form] ${c.message ?? interest}`.slice(0, 4000),
  })

  // Alerte directeur (best-effort : un echec WhatsApp ne doit jamais faire echouer le formulaire du visiteur)
  if (isNew && cab.whatsapp_directeur && deps.notifier) {
    try {
      await deps.notifier(cab.whatsapp_directeur, `New website lead: ${c.name} (${c.phone}) - ${interest}. Open PiloBrain Real Estate to follow up.`.slice(0, 500))
    } catch (e) {
      console.error('immo capture notify:', e)
    }
  }
  return { status: 200, body: { ok: true } }
}
