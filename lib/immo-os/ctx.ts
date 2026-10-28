import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

// Authentification + nom du membre (sert a filtrer "mes leads" pour les agents).
export async function contexteImmo(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return auth
  const { data } = await supabaseAdmin.from('client_users').select('nom_complet').eq('id', auth.clientUserId).maybeSingle()
  return { ...auth, name: (data?.nom_complet as string | null) ?? '' }
}
