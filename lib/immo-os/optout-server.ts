import { supabaseAdmin } from '@/lib/supabase-admin'
import { sameNumber } from './inbound-pure'
import { tableAbsente, colonneAbsente } from './server'

// Lot 5 : "ne plus contacter" cote serveur. Un numero est bloque pour TOUTE la societe des qu'une fiche (lead, client ou
// proprietaire) portant ce numero est marquee do_not_contact. Si la migration 78 n'est pas faite, rien n'est bloque (on ne casse pas l'envoi).
const TABLES = ['re_leads', 're_clients', 're_owners'] as const
export type OptSource = 'stop_keyword' | 'manual' | 'unsubscribe_link'

export async function contactOptedOut(clientId: string, phone: string | null | undefined): Promise<boolean> {
  if (!phone) return false
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('phone').eq('client_id', clientId).eq('do_not_contact', true).limit(2000)
    if (error) { if (colonneAbsente(error) || tableAbsente(error)) return false; continue }
    if ((data ?? []).some((r) => sameNumber(r.phone, phone))) return true
  }
  return false
}

// Marque toutes les fiches de l'agence portant ce numero. Retourne les noms touches (journal) ou null si la migration 78 manque.
export async function appliquerOptOut(clientId: string, phone: string, source: OptSource): Promise<string[] | null> {
  const now = new Date().toISOString()
  const names: string[] = []
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('id, name, phone').eq('client_id', clientId).not('phone', 'is', null).limit(5000)
    if (error) { if (colonneAbsente(error) || tableAbsente(error)) return null; continue }
    const ids = (data ?? []).filter((r) => sameNumber(r.phone, phone)).map((r) => r.id)
    if (!ids.length) continue
    const { error: e2 } = await supabaseAdmin.from(t).update({ do_not_contact: true, do_not_contact_at: now, do_not_contact_reason: source }).in('id', ids).eq('client_id', clientId)
    if (e2) { if (colonneAbsente(e2)) return null; continue }
    names.push(...(data ?? []).filter((r) => ids.includes(r.id)).map((r) => r.name))
  }
  return names
}

// Reprise (mot START envoye par le contact lui-meme) : on leve le blocage et on enregistre le nouveau consentement.
export async function appliquerOptIn(clientId: string, phone: string, version: string): Promise<string[] | null> {
  const now = new Date().toISOString()
  const names: string[] = []
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('id, name, phone').eq('client_id', clientId).eq('do_not_contact', true).limit(2000)
    if (error) { if (colonneAbsente(error) || tableAbsente(error)) return null; continue }
    const ids = (data ?? []).filter((r) => sameNumber(r.phone, phone)).map((r) => r.id)
    if (!ids.length) continue
    await supabaseAdmin.from(t).update({ do_not_contact: false, do_not_contact_at: null, do_not_contact_reason: null, consent_at: now, consent_source: 'whatsapp_inbound', consent_version: version }).in('id', ids).eq('client_id', clientId)
    names.push(...(data ?? []).filter((r) => ids.includes(r.id)).map((r) => r.name))
  }
  return names
}

// Jeton du lien de desinscription (page publique /desinscription/<jeton>, meme page que la partie B2B) d'un contact de l'agence.
export async function tokenPourNumero(clientId: string, phone: string): Promise<string | null> {
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('phone, token_desinscription').eq('client_id', clientId).not('phone', 'is', null).limit(5000)
    if (error) { if (colonneAbsente(error) || tableAbsente(error)) return null; continue }
    const hit = (data ?? []).find((r) => sameNumber(r.phone, phone) && r.token_desinscription)
    if (hit) return hit.token_desinscription as string
  }
  return null
}

// Applique le jeton de desinscription (page publique). Retourne true si un contact a ete trouve et bloque.
export async function desinscrireParJeton(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{20,64}$/i.test(token)) return false
  for (const t of TABLES) {
    const { data, error } = await supabaseAdmin.from(t).select('id, client_id, phone').eq('token_desinscription', token).maybeSingle()
    if (error) { if (colonneAbsente(error) || tableAbsente(error)) return false; continue }
    if (!data) continue
    if (data.phone) await appliquerOptOut(data.client_id, data.phone, 'unsubscribe_link')
    await supabaseAdmin.from(t).update({ do_not_contact: true, do_not_contact_at: new Date().toISOString(), do_not_contact_reason: 'unsubscribe_link' }).eq('id', data.id)
    return true
  }
  return false
}
