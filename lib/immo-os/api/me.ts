import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { quotaIAImmo } from '@/lib/immo-os/ai-quota'
import { activeAi } from '@/lib/immo-os/ai-model'
import { isManager } from '@/lib/immo-os/permissions'

// Menus /immo masques pour un membre : entrees "immo:<menu>" de client_users.onglets_masques (les autres valeurs concernent le tableau de bord classique)
const immoHidden = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.startsWith('immo:')).map((x) => x.slice(5)) : [])

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const [{ data: cabinet }, { data: team }] = await Promise.all([
    supabaseAdmin.from('clients').select('nom_entreprise, logo_url').eq('id', auth.clientId).single(),
    supabaseAdmin.from('client_users').select('id, nom_complet, role, photo_url, telephone, onglets_masques').eq('client_id', auth.clientId),
  ])
  const moi = (team ?? []).find((m) => m.id === auth.clientUserId)
  const ia = await quotaIAImmo(auth.clientId)
  return NextResponse.json({
    clientId: auth.clientId,
    ai: { used: ia.used, limit: ia.limit },
    aiModel: activeAi(),
    agency: cabinet?.nom_entreprise ?? 'My Agency',
    logo: cabinet?.logo_url ?? null,
    me: { id: auth.clientUserId, name: moi?.nom_complet ?? 'Me', role: auth.role, photo: moi?.photo_url ?? null, hidden: immoHidden(moi?.onglets_masques) },
    team: (team ?? []).map((m) => ({ id: m.id, name: m.nom_complet ?? 'Member', role: m.role, photo: m.photo_url ?? null, phone: m.telephone ?? null, ...(isManager(auth.role) ? { hidden: immoHidden(m.onglets_masques), tabs: Array.isArray(m.onglets_masques) ? m.onglets_masques : [] } : {}) })),
  })
}
