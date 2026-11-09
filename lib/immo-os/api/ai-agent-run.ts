import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp } from '@/lib/notifications'
import { logActivity } from '@/lib/immo-os/activity'
import { askAi } from '@/lib/immo-os/ai-call'
import { buildAgentPrompt, guard, langOf, leadPatchFromQual, matchProperties, qualify, readConfig, validateReply, wantsHuman, type AgentConfig } from '@/lib/immo-os/ai-agent'
import { contactOptedOut } from '@/lib/immo-os/optout-server'
import { fmt, translate } from '@/lib/immo-os/i18n'
import { propRef } from '@/lib/immo-os/property-detect'
import { sameNumber } from '@/lib/immo-os/inbound-pure'
import { ecrireTolerant } from '@/lib/immo-os/server'
import type { Property } from '@/lib/immo-os/types'

// Lot 7 (n°39 / n°85) : l'AI Real Estate Agent repond au client, qualifie, propose des biens de la base, puis passe la main.
// DESACTIVE par defaut (re_settings.ai_agent.auto_reply). Chaque reponse automatique, passage de main ou blocage est journalise (re_activity).
// Appele par inbound.ts apres l'enregistrement du message entrant ; ne leve jamais d'erreur (le webhook ne doit pas echouer).
type Ctx = {
  clientId: string; contactName: string; phone: string; text: string
  leadId?: string; ownerId?: string; channel: 'meta' | 'greenapi'
  reply: (phone: string, text: string) => Promise<void>
}
const SYS = { name: 'AI Real Estate Agent', role: null as string | null }

async function readCfg(clientId: string): Promise<AgentConfig> {
  const { data, error } = await supabaseAdmin.from('re_settings').select('ai_agent').eq('client_id', clientId).maybeSingle()
  return readConfig(error ? null : (data as any)?.ai_agent)
}

export async function repondreAutomatiquement(c: Ctx): Promise<void> {
  try {
    const config = await readCfg(c.clientId)
    const actor = { clientId: c.clientId, name: SYS.name, role: SYS.role }
    // Qualification (sans IA) : le lead est complete avec ce que le client a dit, sans ecraser la saisie de l'agent
    const since24 = new Date(Date.now() - 24 * 3600000).toISOString()
    const { data: msgs } = await supabaseAdmin.from('re_messages').select('direction, body, auto, created_at, contact_name, contact_phone').eq('client_id', c.clientId).eq('contact_name', c.contactName).order('created_at', { ascending: false }).limit(40)
    const thread = (msgs ?? []).filter((m) => m.contact_name === c.contactName).reverse()
    const clientTexts = thread.filter((m) => m.direction === 'in').map((m) => m.body as string)
    const { data: zones } = await supabaseAdmin.from('re_zones').select('name').eq('client_id', c.clientId).eq('level', 'zone')
    const q = qualify(clientTexts, (zones ?? []).map((z) => z.name as string))

    if (config.qualify && c.leadId) {
      const { data: lead } = await supabaseAdmin.from('re_leads').select('budget, beds_wanted, interest').eq('id', c.leadId).eq('client_id', c.clientId).maybeSingle()
      const patch = lead ? leadPatchFromQual(lead as any, q.qual) : {}
      if (Object.keys(patch).length) {
        const { error } = await supabaseAdmin.from('re_leads').update(patch).eq('id', c.leadId).eq('client_id', c.clientId)
        if (!error) await logActivity(actor, { action: 'ai_qualify', entity: 'leads', recordId: c.leadId, label: c.contactName, details: { fields: Object.keys(patch) } })
      }
    }

    const autoToday = thread.filter((m) => m.auto && m.created_at >= since24).length
    const lastOut = [...thread].reverse().find((m) => m.direction === 'out')
    const humanRecently = !!lastOut && !lastOut.auto && Date.now() - new Date(lastOut.created_at).getTime() < 30 * 60000
    const g = guard({ config, optedOut: await contactOptedOut(c.clientId, c.phone), isOwner: !!c.ownerId, text: c.text, autoRepliesToday: autoToday, humanRepliedRecently: humanRecently })
    if (!g.ok) {
      if (g.reason === 'handoff' || g.reason === 'limit') await passerLaMain(c, config, g.reason, actor)
      else if (g.reason !== 'disabled') await logActivity(actor, { action: 'ai_blocked', entity: 'messages', label: c.contactName, details: { reason: g.reason } })
      return
    }

    // Reponse : IA si disponible (propositions limitees aux biens de la base), sinon question de qualification fixe et sure
    const lang = langOf(c.text)
    const { data: pr } = await supabaseAdmin.from('re_properties').select('*').eq('client_id', c.clientId).eq('status', 'available').limit(2000)
    const props = (pr ?? []) as Property[]
    const found = Object.values(q.query).some(Boolean) ? matchProperties(props, q.query).slice(0, 2) : []
    const { data: cab } = await supabaseAdmin.from('clients').select('nom_entreprise').eq('id', c.clientId).maybeSingle()
    let text: string | null = null
    let source: 'ai' | 'template' = 'template'
    const ai = await askAi(c.clientId, buildAgentPrompt({ agency: cab?.nom_entreprise ?? 'the agency', lang, thread: thread.map((m) => ({ direction: m.direction, body: m.body })), props: found, missing: q.missing }))
    if (ai) {
      const v = validateReply(ai.text, { allowedPrices: found.map((p) => Number(p.price)), clientText: clientTexts.join(' ') })
      if (v.ok) { text = ai.text; source = 'ai' } else await logActivity(actor, { action: 'ai_blocked', entity: 'messages', label: c.contactName, details: { reason: `reply_rejected:${v.reason}` } })
    }
    if (!text) {
      const ask = q.missing[0] ? translate(lang, `agent.q.${q.missing[0]}`) : translate(lang, 'agent.q.done')
      const sug = found.length ? ` ${fmt(translate(lang, 'agent.suggest'), { items: found.map((p) => `${p.title} (${propRef(p.id)})`).join(', ') })}` : ''
      text = `${ask}${sug} ${translate(lang, 'agent.follow')}`.trim()
    }
    await c.reply(c.phone, text)
    const row = { client_id: c.clientId, contact_name: c.contactName, contact_phone: c.phone, direction: 'out', body: text, unread: false, auto: true, ...(c.channel === 'meta' ? { channel: 'meta', wa_status: 'sent' } : {}) }
    await ecrireTolerant(row, (r) => supabaseAdmin.from('re_messages').insert(r))
    await logActivity(actor, { action: 'ai_auto_reply', entity: 'messages', recordId: c.leadId, label: c.contactName, details: { source, length: text.length, properties: found.length, missing: q.missing } })
  } catch (e) { console.error('immo ai-agent:', e) }
}

// Passage de la main : un seul message d'attente au client + alerte WhatsApp a l'agent du lead (ou au directeur)
async function passerLaMain(c: Ctx, config: AgentConfig, reason: 'handoff' | 'limit', actor: { clientId: string; name: string; role: string | null }) {
  const lang = langOf(c.text)
  const { data: last } = await supabaseAdmin.from('re_messages').select('body, auto').eq('client_id', c.clientId).eq('contact_name', c.contactName).eq('direction', 'out').order('created_at', { ascending: false }).limit(1)
  const already = last?.[0]?.auto && last[0].body === translate(lang, 'agent.handoff')
  if (!already) {
    const body = translate(lang, 'agent.handoff')
    await c.reply(c.phone, body)
    await ecrireTolerant({ client_id: c.clientId, contact_name: c.contactName, contact_phone: c.phone, direction: 'out', body, unread: false, auto: true, ...(c.channel === 'meta' ? { channel: 'meta', wa_status: 'sent' } : {}) }, (r) => supabaseAdmin.from('re_messages').insert(r))
  }
  // alerte interne (agent du lead, sinon directeur)
  let to: string | null = null
  if (c.leadId) {
    const { data: lead } = await supabaseAdmin.from('re_leads').select('agent').eq('id', c.leadId).maybeSingle()
    if (lead?.agent) { const { data: m } = await supabaseAdmin.from('client_users').select('telephone').eq('client_id', c.clientId).ilike('nom_complet', lead.agent).limit(1); to = m?.[0]?.telephone ?? null }
  }
  if (!to) { const { data: cab } = await supabaseAdmin.from('clients').select('whatsapp_directeur').eq('id', c.clientId).maybeSingle(); to = cab?.whatsapp_directeur ?? null }
  if (to && !sameNumber(to, c.phone)) { try { await envoyerWhatsapp(to, fmt(translate('en', 'agent.notify'), { name: c.contactName, why: translate('en', `agent.why.${reason}`) })) } catch (e) { console.error('immo ai-agent notify:', e) } }
  await logActivity(actor, { action: 'ai_handoff', entity: 'messages', recordId: c.leadId, label: c.contactName, details: { reason, notified: !!to } })
}
export { wantsHuman }
