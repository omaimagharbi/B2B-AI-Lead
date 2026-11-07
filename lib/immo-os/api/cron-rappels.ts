import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp } from '@/lib/notifications'
import { ACTIVE_STATUSES, dueLeads, orphanLeads, planOrphanAlerts, planReminders, type OLead, type RLead } from '@/lib/immo-os/reminders'

const MAX_ENVOIS_PAR_EXECUTION = 60

// Previent les agents (et le directeur) des leads sans contact depuis 48 h.
// Appelee chaque jour par le cron existant /api/cron/relances (pas de cron ni de fonction supplementaire).
export async function executerRappels(maxEnvois = MAX_ENVOIS_PAR_EXECUTION): Promise<{ envoyes: number; echoues: number; note?: string }> {
  const now = Date.now()
  const cutoff = new Date(now - 48 * 3600000).toISOString()
  const { data: leads, error } = await supabaseAdmin
    .from('re_leads')
    .select('id, client_id, name, status, agent, last_contact, reminded_at')
    .in('status', ACTIVE_STATUSES)
    .lt('last_contact', cutoff)
    .limit(2000)
  if (error) return { envoyes: 0, echoues: 0, note: 'Tables immobilier absentes (migration 70/72)' }

  const due = dueLeads((leads ?? []) as RLead[], now)
  let envoyes = 0
  let echoues = 0
  if (due.length) {
    const ids = Array.from(new Set(due.map((l) => l.client_id)))
    const [{ data: agencies }, { data: members }] = await Promise.all([
      supabaseAdmin.from('clients').select('id, nom_entreprise, whatsapp_directeur').in('id', ids),
      supabaseAdmin.from('client_users').select('client_id, nom_complet, telephone').in('client_id', ids),
    ])
    const plan = planReminders(due, members ?? [], agencies ?? [], now).slice(0, maxEnvois)
    for (const m of plan) {
      try {
        await envoyerWhatsapp(m.to, m.text)
        envoyes++
        // On marque seulement apres un envoi reussi : en cas d'echec le lead sera retente au prochain passage
        await supabaseAdmin.from('re_leads').update({ reminded_at: new Date().toISOString() }).in('id', m.leadIds).eq('client_id', m.clientId)
      } catch (e) {
        echoues++
        console.error('immo-rappels:', e)
      }
    }
  }

  // Lot 2 : leads orphelins (sans agent / agent retire), meme s'ils ne sont pas en retard de 48 h. Un message par jour et par agence
  // tant qu'ils ne sont pas reassignes (meme cron, pas de nouvelle tache planifiee).
  try {
    const { data: actifs } = await supabaseAdmin.from('re_leads').select('id, client_id, name, status, agent').in('status', ACTIVE_STATUSES).limit(5000)
    const cids = Array.from(new Set((actifs ?? []).map((l) => l.client_id)))
    if (cids.length) {
      const [{ data: ags }, { data: mems }] = await Promise.all([
        supabaseAdmin.from('clients').select('id, nom_entreprise, whatsapp_directeur').in('id', cids),
        supabaseAdmin.from('client_users').select('client_id, nom_complet, telephone').in('client_id', cids),
      ])
      for (const m of planOrphanAlerts(orphanLeads((actifs ?? []) as OLead[], mems ?? []), ags ?? [])) {
        if (envoyes + echoues >= maxEnvois) break
        try { await envoyerWhatsapp(m.to, m.text); envoyes++ } catch (e) { echoues++; console.error('immo-orphelins:', e) }
      }
    }
  } catch (e) { console.error('immo-orphelins:', e) }
  return { envoyes, echoues }
}

// Appel manuel possible (test) : /api/immo?r=cron-rappels&secret=...
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const ok = !!secret && (req.headers.get('authorization') === `Bearer ${secret}` || req.nextUrl.searchParams.get('secret') === secret)
  if (!ok) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  return NextResponse.json({ succes: true, ...(await executerRappels()) })
}
