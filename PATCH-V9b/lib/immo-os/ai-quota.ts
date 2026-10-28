import { supabaseAdmin } from '@/lib/supabase-admin'

export const DEFAULT_MONTHLY_LIMIT = 300

// Decision pure (testable) : quota null/undefined => limite par defaut ; 0 = IA desactivee pour l'agence.
export function decideQuota(used: number, quota: number | null | undefined, envLimit?: string | number | null): { allowed: boolean; used: number; limit: number } {
  const fromEnv = Number(envLimit)
  const limit = typeof quota === 'number' && quota >= 0 ? quota : Number.isFinite(fromEnv) && fromEnv >= 0 && envLimit !== undefined && envLimit !== null && envLimit !== '' ? fromEnv : DEFAULT_MONTHLY_LIMIT
  return { allowed: used < limit, used, limit }
}
export const startOfMonthUtc = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

// Nombre de requetes IA "immo" de l'agence ce mois-ci. En cas d'erreur de lecture on laisse passer (ne jamais bloquer a tort).
export async function quotaIAImmo(clientId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { data: cab } = await supabaseAdmin.from('clients').select('quota_ia_immo_mensuel').eq('id', clientId).maybeSingle()
  const { count, error } = await supabaseAdmin
    .from('usage_ia')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('source', 'immo')
    .gte('created_at', startOfMonthUtc())
  const quota = (cab as { quota_ia_immo_mensuel?: number | null } | null)?.quota_ia_immo_mensuel
  if (error) return { ...decideQuota(0, quota, process.env.IMMO_AI_MONTHLY_LIMIT), allowed: true }
  return decideQuota(count ?? 0, quota, process.env.IMMO_AI_MONTHLY_LIMIT)
}
