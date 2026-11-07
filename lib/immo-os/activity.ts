import { supabaseAdmin } from '@/lib/supabase-admin'

// Journal d'activite et historique des affectations. Appeles UNIQUEMENT cote serveur, depuis les points d'ecriture
// (api/entity.ts pour toutes les fiches, api/reassign.ts, routes /api/team/*), jamais depuis les pages.
// Best-effort : une erreur (ex. migration 76 pas encore faite) ne bloque jamais l'action de l'utilisateur.
export type Actor = { clientId: string; id?: string | null; name: string; role?: string | null }

export async function logActivity(a: Actor, e: { action: string; entity?: string; recordId?: string | null; label?: string | null; details?: Record<string, unknown> }) {
  try {
    await supabaseAdmin.from('re_activity').insert({
      client_id: a.clientId, actor_id: a.id ?? null, actor_name: a.name || '', actor_role: a.role ?? null,
      action: e.action, entity: e.entity ?? null, record_id: e.recordId ?? null, label: (e.label ?? '').slice(0, 200) || null, details: e.details ?? {},
    })
    // Pas de cron : on purge (>180 jours) de temps en temps, au fil des ecritures
    if (Math.random() < 0.02) await supabaseAdmin.from('re_activity').delete().eq('client_id', a.clientId).lt('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
  } catch {}
}

export async function logAssignment(a: Actor, x: { leadId: string; leadName?: string | null; from?: string | null; to?: string | null; reason: 'creation' | 'manual' | 'bulk' | 'agent_removed' }) {
  try {
    await supabaseAdmin.from('re_assignments').insert({ client_id: a.clientId, lead_id: x.leadId, lead_name: x.leadName ?? null, from_agent: x.from || null, to_agent: x.to || null, by_name: a.name || null, reason: x.reason })
  } catch {}
}

// Nom lisible d'une fiche pour le journal (jamais de telephone / email)
export const labelOf = (r: Record<string, any> | null | undefined): string => String(r?.name ?? r?.title ?? r?.contact_name ?? r?.party_name ?? '').trim()
