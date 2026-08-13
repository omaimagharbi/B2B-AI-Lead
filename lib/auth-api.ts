import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifie le token d'authentification passe en header et retourne l'id du
// client_users courant + le client_id de son cabinet. Meme logique que
// app/api/inbox/repondre/route.ts, factorisee pour eviter la duplication
// dans les nouvelles routes de collaboration (messages + taches).
export async function authentifierClientUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return { erreur: 'Non authentifie' as const, statut: 401 }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return { erreur: 'Session invalide' as const, statut: 401 }
  }

  const { data: clientUser } = await supabaseAdmin
    .from('client_users')
    .select('id, client_id, role')
    .eq('auth_user_id', userData.user.id)
    .single()

  if (!clientUser) {
    return { erreur: 'Aucun cabinet associe' as const, statut: 403 }
  }

  return {
    erreur: null,
    clientUserId: clientUser.id as string,
    clientId: clientUser.client_id as string,
    role: clientUser.role as string,
  }
}
