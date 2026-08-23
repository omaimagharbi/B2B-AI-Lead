import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// "Plan de Chasse Automatique" : au lieu de re-configurer le Ciblage tout
// seul en silence des la generation de la strategie (risque d'ecraser des
// filtres en cours sans prevenir), l'IA propose des filtres et cette route
// les applique uniquement quand le commercial clique sur "Appliquer au
// Ciblage" - il garde la main.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, anonKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const { postes, secteur, taille } = (await req.json()) as {
      postes?: string[]
      secteur?: string
      taille?: string
    }

    const misesAJour: Record<string, string> = {}
    if (secteur) misesAJour.secteur_activite = secteur
    if (taille) misesAJour.taille_entreprise = taille

    if (Object.keys(misesAJour).length > 0) {
      await supabaseAdmin.from('clients').update(misesAJour).eq('id', clientUser.client_id)
    }

    if (Array.isArray(postes) && postes.length > 0) {
      // Remplace la selection actuelle de postes cibles par celle recommandee.
      await supabaseAdmin.from('client_professions').delete().eq('client_id', clientUser.client_id)
      await supabaseAdmin
        .from('client_professions')
        .insert(postes.map((profession) => ({ client_id: clientUser.client_id, profession })))
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/strategie/appliquer-filtres:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
