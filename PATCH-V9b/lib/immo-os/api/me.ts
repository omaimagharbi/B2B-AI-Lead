import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'
import { quotaIAImmo } from '@/lib/immo-os/ai-quota'

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const [{ data: cabinet }, { data: team }] = await Promise.all([
    supabaseAdmin.from('clients').select('nom_entreprise, logo_url').eq('id', auth.clientId).single(),
    supabaseAdmin.from('client_users').select('id, nom_complet, role, photo_url, telephone').eq('client_id', auth.clientId),
  ])
  const moi = (team ?? []).find((m) => m.id === auth.clientUserId)
  const ia = await quotaIAImmo(auth.clientId)
  return NextResponse.json({
    clientId: auth.clientId,
    ai: { used: ia.used, limit: ia.limit },
    agency: cabinet?.nom_entreprise ?? 'My Agency',
    logo: cabinet?.logo_url ?? null,
    me: { id: auth.clientUserId, name: moi?.nom_complet ?? 'Me', role: auth.role, photo: moi?.photo_url ?? null },
    team: (team ?? []).map((m) => ({ id: m.id, name: m.nom_complet ?? 'Member', role: m.role, photo: m.photo_url ?? null, phone: m.telephone ?? null })),
  })
}
