import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from './server'
import { digits, sameNumber, type Incoming } from './inbound-pure'

export { parseIncoming } from './inbound-pure'

// --- Traitement ---------------------------------------------------------------------------------

// Retourne true si le message a ete range dans l'inbox d'une agence immobilier, false sinon (a ignorer).
export async function traiterMessageImmo(inc: Incoming): Promise<boolean> {
  // 1) Le numero est-il deja un lead / client / proprietaire d'une agence ?
  let found: { client_id: string; name: string; leadId?: string } | null = null
  for (const [table, isLead] of [['re_leads', true], ['re_clients', false], ['re_owners', false]] as const) {
    const { data, error } = await supabaseAdmin.from(table).select('id, client_id, name, phone').not('phone', 'is', null).limit(5000)
    if (error) return false // tables absentes (migration 70 pas faite) : on ignore sans casser le webhook
    const hit = (data ?? []).find((r) => sameNumber(r.phone, inc.phone))
    if (hit) { found = { client_id: hit.client_id, name: hit.name, leadId: isLead ? hit.id : undefined }; break }
  }

  // 2) Numero inconnu : nouveau lead pour l'agence par defaut (une seule instance WhatsApp pour tous les cabinets)
  if (!found) {
    const defaut = process.env.WHATSAPP_IMMO_CLIENT_ID
    if (!isUuid(defaut)) return false
    const { data: cab } = await supabaseAdmin.from('clients').select('id').eq('id', defaut).maybeSingle()
    if (!cab) return false
    const name = inc.senderName ?? `WhatsApp +${digits(inc.phone)}`
    const { data: lead, error } = await supabaseAdmin
      .from('re_leads')
      .insert({ client_id: defaut, name, phone: `+${digits(inc.phone)}`, interest: inc.text.slice(0, 200), status: 'new', source: 'whatsapp', score: 60, last_contact: new Date().toISOString() })
      .select('id')
      .single()
    if (error || !lead) return false
    found = { client_id: defaut, name, leadId: lead.id }
  } else if (found.leadId) {
    await supabaseAdmin.from('re_leads').update({ last_contact: new Date().toISOString() }).eq('id', found.leadId).eq('client_id', found.client_id)
  }

  // 3) Enregistrer le message ; un doublon GreenAPI (meme idMessage) est ignore silencieusement.
  const row = { client_id: found.client_id, contact_name: found.name, contact_phone: inc.phone, direction: 'in', body: inc.text, unread: true }
  let { error } = await supabaseAdmin.from('re_messages').insert({ ...row, external_id: inc.messageId })
  if (error?.code === '23505') return true // doublon
  // Colonne external_id absente (migration 71 pas faite) : PostgREST renvoie PGRST204 (ou 42703 cote Postgres)
  if (error?.code === 'PGRST204' || error?.code === '42703') ({ error } = await supabaseAdmin.from('re_messages').insert(row))
  return !error
}
