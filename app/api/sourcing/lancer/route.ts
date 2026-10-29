import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { lancerSourcingPourClient } from '@/lib/sourcing'

export async function POST(req: NextRequest) {
  try {
    // 1. On verifie que la personne est bien connectee (session Supabase valide)
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, anonKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    // 2. On verifie que ce client_id lui appartient bien (pas de sourcing pour un autre cabinet)
    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Aucun cabinet associe a ce compte' }, { status: 403 })
    }

    // 3. On lance le sourcing (peut prendre du temps selon le nombre de pays selectionnes)
    const resultats = await lancerSourcingPourClient(clientUser.client_id)

    return NextResponse.json({ succes: true, resultats })
  } catch (err) {
    console.error('Erreur /api/sourcing/lancer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
