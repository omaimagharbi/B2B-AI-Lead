import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp } from '@/lib/notifications'
import { translate, fmt, type Lang } from '@/lib/immo-os/i18n'
import { logActivity } from '@/lib/immo-os/activity'
import { DEFAULT_PERIOD_HOURS, DEFAULT_STALE_HOURS, HOT_ACTIVE, HOT_SCORE, alertRecipient, hotAlertText, isHotLead, periodKey, readHours, type AlertAgency, type AlertLead, type AlertMember } from '@/lib/immo-os/hot-alert'
import { tableAbsente } from '@/lib/immo-os/server'

// n°41 / n°81 : alerte "lead chaud, contactez-le maintenant" (WhatsApp interne a l'agent, ou au directeur si pas d'agent).
// Anti-doublon : (1) on regarde s'il existe deja une alerte pour ce lead dans la periode (72 h par defaut) ; (2) la contrainte
// UNIQUE (lead_id, period_key) de re_hot_alerts empeche un doublon meme si deux executions arrivent en meme temps.
// Sans la migration 77, AUCUNE alerte n'est envoyee (on ne peut pas dedupliquer, donc on prefere se taire plutot que spammer).
const periodHours = () => readHours(process.env.IMMO_HOT_ALERT_PERIOD_HOURS, DEFAULT_PERIOD_HOURS)
const staleHours = () => readHours(process.env.IMMO_HOT_ALERT_STALE_HOURS, DEFAULT_STALE_HOURS)
const lang = (a: AlertAgency): Lang => (a.langue_preferee === 'fr' || a.langue_preferee === 'ar' ? a.langue_preferee : 'en')

type Sender = (to: string, text: string) => Promise<void>
// Retourne true si une alerte a ete envoyee, false sinon (deja alerte dans la periode, pas de destinataire, echec...).
export async function alerterUnLead(lead: AlertLead, members: AlertMember[], agency: AlertAgency, send: Sender = (to, txt) => envoyerWhatsapp(to, txt), now = Date.now()): Promise<boolean> {
  if (!isHotLead(lead)) return false
  const to = alertRecipient(lead, members, agency)
  if (!to) return false
  const hours = periodHours()
  const since = new Date(now - hours * 3600000).toISOString()
  const { data: recent, error } = await supabaseAdmin.from('re_hot_alerts').select('id').eq('lead_id', lead.id).gte('created_at', since).limit(1)
  if (error) { if (!tableAbsente(error)) console.error('immo hot-alert:', error.message); return false }
  if (recent?.length) return false
  const { data: row, error: e2 } = await supabaseAdmin.from('re_hot_alerts').insert({ client_id: lead.client_id, lead_id: lead.id, period_key: periodKey(now, hours), score: lead.score }).select('id').single()
  if (e2 || !row) return false // 23505 = une autre execution l'a deja fait
  const tr = (k: string) => translate(lang(agency), k)
  try {
    await send(to, hotAlertText(tr, (t, v) => fmt(t, v), lead, !lead.agent))
    await logActivity({ clientId: lead.client_id, name: 'System', role: null }, { action: 'hot_alert', entity: 'leads', recordId: lead.id, label: lead.name, details: { score: lead.score } })
    return true
  } catch (e) {
    await supabaseAdmin.from('re_hot_alerts').delete().eq('id', row.id) // echec d'envoi : on libere la periode pour une nouvelle tentative
    console.error('immo hot-alert send:', e)
    return false
  }
}

// Declencheur immediat : appele par api/entity.ts quand un lead VIENT de devenir chaud.
export async function alerterLeadChaud(clientId: string, lead: Record<string, any>): Promise<void> {
  try {
    const [{ data: ag }, { data: mem }] = await Promise.all([
      supabaseAdmin.from('clients').select('id, nom_entreprise, whatsapp_directeur, langue_preferee').eq('id', clientId).maybeSingle(),
      supabaseAdmin.from('client_users').select('client_id, nom_complet, telephone').eq('client_id', clientId),
    ])
    if (ag) await alerterUnLead(lead as AlertLead, (mem ?? []) as AlertMember[], ag as AlertAgency)
  } catch (e) { console.error('immo hot-alert:', e) }
}

// Balayage quotidien (cron existant) : leads chauds sans contact depuis STALE heures et pas encore alertes dans la periode.
export async function balayerLeadsChauds(budget: number): Promise<{ envoyes: number }> {
  if (budget <= 0) return { envoyes: 0 }
  const now = Date.now()
  const cutoff = new Date(now - staleHours() * 3600000).toISOString()
  const { data: leads, error } = await supabaseAdmin.from('re_leads').select('*').gte('score', HOT_SCORE).in('status', HOT_ACTIVE).lt('last_contact', cutoff).limit(500)
  if (error || !leads?.length) return { envoyes: 0 }
  const cids = Array.from(new Set(leads.map((l) => l.client_id)))
  const [{ data: ags }, { data: mems }] = await Promise.all([
    supabaseAdmin.from('clients').select('id, nom_entreprise, whatsapp_directeur, langue_preferee').in('id', cids),
    supabaseAdmin.from('client_users').select('client_id, nom_complet, telephone').in('client_id', cids),
  ])
  let envoyes = 0
  for (const l of leads) {
    if (envoyes >= budget) break
    const ag = (ags ?? []).find((a) => a.id === l.client_id)
    if (!ag) continue
    if (await alerterUnLead(l as AlertLead, (mems ?? []) as AlertMember[], ag as AlertAgency, undefined, now)) envoyes++
  }
  return { envoyes }
}
