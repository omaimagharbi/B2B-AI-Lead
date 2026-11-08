import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp } from '@/lib/notifications'
import { isUuid, ecrireTolerant } from './server'
import { digits, sameNumber, type Incoming } from './inbound-pure'
import { detectOptIn, detectOptOut, pickLang } from './optout'
import { detectProperty, MIN_LEAD, MIN_MESSAGE, type PropLite } from './property-detect'
import { DEFAULT_UNKNOWN_RULE, decideUnknown, isUnknownRule, type UnknownRule } from './unknown-rule'
import { appliquerOptIn, appliquerOptOut } from './optout-server'
import { translate } from './i18n'
import { logActivity } from './activity'
import { POLICY_VERSION } from './policy'

export { parseIncoming } from './inbound-pure'

// --- Traitement ---------------------------------------------------------------------------------
// Lot 4 (n°105) : le bien dont parle le client est detecte dans le message et rattache a la conversation.
// Lot 5 (n°55, 83, 102) : STOP / START, groupes ignores (cf. inbound-pure.ts), regle de l'agence pour les numeros inconnus.
// clientId / channel : renseignes par le webhook Meta (le numero Meta appartient a UNE agence) ; GreenAPI utilise WHATSAPP_IMMO_CLIENT_ID
export type InboundDeps = { reply?: (phone: string, text: string) => Promise<void>; clientId?: string; channel?: 'meta' | 'greenapi'; media?: { url: string; type: 'image' | 'document' | 'audio' | 'video'; name: string | null } }

async function readRule(clientId: string): Promise<UnknownRule> {
  const { data, error } = await supabaseAdmin.from('re_settings').select('unknown_number_rule').eq('client_id', clientId).maybeSingle()
  return !error && isUnknownRule(data?.unknown_number_rule) ? data.unknown_number_rule : DEFAULT_UNKNOWN_RULE
}
async function loadProps(clientId: string): Promise<PropLite[]> {
  const { data } = await supabaseAdmin.from('re_properties').select('*').eq('client_id', clientId).limit(2000)
  return (data ?? []) as PropLite[]
}

// Retourne true si le message a ete traite (range dans l'inbox ou STOP applique), false sinon (a ignorer).
export async function traiterMessageImmo(inc: Incoming, deps: InboundDeps = {}): Promise<boolean> {
  const reply = deps.reply ?? ((phone: string, text: string) => envoyerWhatsapp(phone, text))
  // 1) Le numero est-il deja un lead / client / proprietaire d'une agence ?
  let found: { client_id: string; name: string; leadId?: string; ownerId?: string; leadPropertyId?: string | null } | null = null
  for (const [table, isLead] of [['re_leads', true], ['re_clients', false], ['re_owners', false]] as const) {
    let qy = supabaseAdmin.from(table).select(isLead ? 'id, client_id, name, phone, property_id' : 'id, client_id, name, phone').not('phone', 'is', null)
    if (deps.clientId) qy = qy.eq('client_id', deps.clientId) // numero Meta : seule l'agence proprietaire du numero est concernee
    const { data, error } = await qy.limit(5000)
    if (error) return false // tables absentes (migration 70 pas faite) : on ignore sans casser le webhook
    const hit = ((data ?? []) as any[]).find((r) => sameNumber(r.phone, inc.phone))
    if (hit) { found = { client_id: hit.client_id, name: hit.name, leadId: isLead ? hit.id : undefined, ownerId: table === 're_owners' ? hit.id : undefined, leadPropertyId: isLead ? hit.property_id ?? null : null }; break }
  }
  const stop = detectOptOut(inc.text)
  const start = !stop && detectOptIn(inc.text)
  const now = new Date().toISOString()

  // 2) Numero inconnu : STOP = rien a bloquer (et surtout pas de lead cree) ; sinon regle choisie par l'agence (n°102)
  let props: PropLite[] | null = null
  if (!found) {
    if (stop) return false
    const defaut = deps.clientId ?? process.env.WHATSAPP_IMMO_CLIENT_ID
    if (!isUuid(defaut)) return false
    const { data: cab } = await supabaseAdmin.from('clients').select('id').eq('id', defaut).maybeSingle()
    if (!cab) return false
    props = await loadProps(defaut)
    const det = detectProperty(inc.text, props)
    const action = decideUnknown(await readRule(defaut), { text: inc.text, propertyDetected: !!det && det.confidence >= MIN_MESSAGE })
    if (action === 'ignore') return false
    const name = inc.senderName ?? `WhatsApp +${digits(inc.phone)}`
    if (action === 'inbox_only') {
      found = { client_id: defaut, name } // le message arrive dans la boite de reception, sans creer de lead
    } else {
      const prop = det && det.confidence >= MIN_LEAD ? props.find((p) => p.id === det.propertyId) : null
      // Le client a ecrit le premier : consentement a etre recontacte pour sa demande (source whatsapp_inbound), a faire valider par un juriste
      const { data: lead, error } = await ecrireTolerant(
        { client_id: defaut, name, phone: `+${digits(inc.phone)}`, interest: (prop ? `${prop.title}${prop.area ? ` - ${prop.area}` : ''}` : inc.text).slice(0, 200), property_id: prop?.id ?? null, status: 'new', source: 'whatsapp', score: 60, last_contact: now, consent_at: now, consent_source: 'whatsapp_inbound', consent_version: POLICY_VERSION },
        (r) => supabaseAdmin.from('re_leads').insert(r).select('id').single(),
      )
      if (error || !lead) return false
      found = { client_id: defaut, name, leadId: lead.id, leadPropertyId: prop?.id ?? null }
    }
  } else if (found.leadId) {
    await supabaseAdmin.from('re_leads').update({ last_contact: now }).eq('id', found.leadId).eq('client_id', found.client_id)
  }

  // Un proprietaire qui ecrit : son "dernier contact" est mis a jour (ignore si la migration 74 n'est pas faite)
  if (found.ownerId) await supabaseAdmin.from('re_owners').update({ last_contact: now }).eq('id', found.ownerId).eq('client_id', found.client_id)

  // 3) n°105 : bien dont parle le message
  if (!props) props = await loadProps(found.client_id)
  const det = stop || start ? null : detectProperty(inc.text, props, { leadPropertyId: found.leadPropertyId })
  const propId = det && det.confidence >= MIN_MESSAGE ? det.propertyId : null
  if (propId && found.leadId && !found.leadPropertyId && det!.confidence >= MIN_LEAD) {
    await supabaseAdmin.from('re_leads').update({ property_id: propId }).eq('id', found.leadId).eq('client_id', found.client_id) // seulement si le lead n'avait pas deja un bien
  }

  // 4) Enregistrer le message ; un doublon GreenAPI (meme idMessage) est ignore silencieusement.
  const row = { client_id: found.client_id, contact_name: found.name, contact_phone: inc.phone, direction: 'in', body: inc.text, unread: true, external_id: inc.messageId, ...(deps.channel === 'meta' ? { channel: 'meta' } : {}), ...(deps.media ? { media_url: deps.media.url, media_type: deps.media.type, media_name: deps.media.name } : {}), ...(propId ? { property_id: propId, property_auto: true } : {}) }
  const { error } = await ecrireTolerant(row, (r) => supabaseAdmin.from('re_messages').insert(r))
  if (error?.code === '23505') return true // doublon : rien d'autre a faire (STOP / START deja appliques la premiere fois)
  if (error) return false

  // 5) Lot 5 : STOP / START apres l'enregistrement du message (la demande reste visible dans l'inbox)
  const lang = pickLang(inc.text)
  if (stop) {
    const names = await appliquerOptOut(found.client_id, inc.phone, 'stop_keyword')
    if (names) {
      await logActivity({ clientId: found.client_id, name: 'WhatsApp', role: null }, { action: 'optout', entity: 'contacts', label: found.name, details: { source: 'stop_keyword', records: names.length } })
      try { await reply(inc.phone, translate(lang, 'pol.stop.confirm')) } catch (e) { console.error('immo stop confirm:', e) } // confirmation unique, jamais de message marketing
    }
  } else if (start) {
    const names = await appliquerOptIn(found.client_id, inc.phone, POLICY_VERSION)
    if (names?.length) {
      await logActivity({ clientId: found.client_id, name: 'WhatsApp', role: null }, { action: 'optin', entity: 'contacts', label: found.name, details: { source: 'start_keyword', records: names.length } })
      try { await reply(inc.phone, translate(lang, 'pol.start.confirm')) } catch (e) { console.error('immo start confirm:', e) }
    }
  }
  return true
}
