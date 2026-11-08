import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Actor } from '@/lib/immo-os/activity'
import { logActivity } from '@/lib/immo-os/activity'
import { planDealTransition, taskDate, taskMarker } from '@/lib/immo-os/deal-flow'
import { translate, type Lang } from '@/lib/immo-os/i18n'
import type { DealStatus, PropStatus } from '@/lib/immo-os/types'

// Lot 4 : ecrit l'historique d'etapes (re_stages) et declenche les actions automatiques d'un deal. Appele UNIQUEMENT depuis
// api/entity.ts (point d'ecriture unique) : quelle que soit la page qui change le statut, le resultat est le meme.
// Best-effort : une erreur (ex. migration 77 pas faite) ne bloque jamais la modification du deal.
const agencyLang = async (clientId: string): Promise<Lang> => {
  const { data } = await supabaseAdmin.from('clients').select('langue_preferee').eq('id', clientId).maybeSingle()
  const l = data?.langue_preferee
  return l === 'fr' || l === 'ar' ? l : 'en'
}
const tzOffset = () => { const n = Number(process.env.IMMO_TZ_OFFSET_HOURS); return Number.isFinite(n) && n >= -12 && n <= 14 ? n : 3 } // Qatar = UTC+3

export async function logStage(a: Actor, e: { kind: 'lead' | 'deal'; id: string; name?: string | null; from?: string | null; to: string; auto?: string[] }) {
  try {
    await supabaseAdmin.from('re_stages').insert({ client_id: a.clientId, kind: e.kind, record_id: e.id, record_name: (e.name ?? '').slice(0, 200) || null, from_status: e.from ?? null, to_status: e.to, by_name: a.name || null, auto: e.auto ?? [] })
  } catch {}
}

export async function onLeadStatusChange(a: Actor, lead: { id: string; name: string; status: string }, from: string | null) {
  if (from === lead.status) return
  await logStage(a, { kind: 'lead', id: lead.id, name: lead.name, from, to: lead.status })
}

type DealRow = { id: string; title: string; party_name?: string | null; property_id?: string | null; agent?: string | null; kind: 'sale' | 'rent'; status: DealStatus }
export async function onDealStatusChange(a: Actor, deal: DealRow, from: DealStatus | null) {
  try {
    if (from === deal.status) return
    // contexte : statut du bien lie, lead actif de ce client, taches deja creees pour cette etape
    let propertyStatus: PropStatus | null = null
    if (deal.property_id) {
      const { data } = await supabaseAdmin.from('re_properties').select('status').eq('id', deal.property_id).eq('client_id', a.clientId).maybeSingle()
      propertyStatus = (data?.status as PropStatus) ?? null
    }
    let leadId: string | null = null
    if (deal.party_name) {
      const { data } = await supabaseAdmin.from('re_leads').select('id, status, name').eq('client_id', a.clientId).ilike('name', deal.party_name.trim()).in('status', ['new', 'qualified', 'viewing', 'negotiation']).limit(1)
      leadId = data?.[0]?.id ?? null
    }
    const marker = taskMarker(deal.id, deal.status)
    const { data: existing } = await supabaseAdmin.from('re_visits').select('id').eq('client_id', a.clientId).like('notes', `%${marker}%`).limit(1)
    const plan = planDealTransition({ id: deal.id, kind: deal.kind }, from, deal.status, { propertyStatus, leadActive: !!leadId, existingMarkers: new Set(existing?.length ? [marker] : []) })
    const auto: string[] = []
    const lang = plan.tasks.length ? await agencyLang(a.clientId) : 'en'
    for (const t of plan.tasks) {
      const { error } = await supabaseAdmin.from('re_visits').insert({
        client_id: a.clientId, property_id: deal.property_id ?? null, lead_id: leadId, contact_name: deal.party_name || deal.title, agent: deal.agent ?? null,
        starts_at: taskDate(Date.now(), t.inDays, t.hour, tzOffset()), duration_min: 30, status: 'scheduled', category: t.category, notes: `${translate(lang, t.noteKey)} ${t.marker}`,
      })
      if (!error) auto.push(`task_${deal.status}`)
    }
    if (plan.propertyStatus && deal.property_id) {
      const { error } = await supabaseAdmin.from('re_properties').update({ status: plan.propertyStatus }).eq('id', deal.property_id).eq('client_id', a.clientId)
      if (!error) auto.push(plan.auto.find((c) => c.startsWith('property_')) as string)
    }
    if (plan.leadWon && leadId) {
      const { error } = await supabaseAdmin.from('re_leads').update({ status: 'won' }).eq('id', leadId).eq('client_id', a.clientId)
      if (!error) { auto.push('lead_won'); await logStage(a, { kind: 'lead', id: leadId, name: deal.party_name, from: null, to: 'won', auto: ['deal_closed'] }) }
    }
    await logStage(a, { kind: 'deal', id: deal.id, name: deal.title, from, to: deal.status, auto: auto.filter(Boolean) })
    if (auto.length) await logActivity(a, { action: 'auto', entity: 'deals', recordId: deal.id, label: deal.title, details: { to: deal.status, auto } })
  } catch (e) { console.error('immo deal-steps:', e) }
}
