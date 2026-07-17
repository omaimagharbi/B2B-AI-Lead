import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  try {
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

    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const { email, nom_complet } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email manquant' }, { status: 400 })
    }

    // On invite ce nouvel utilisateur en lui rattachant directement le client_id existant
    // (voir trigger SQL handle_new_client_signup : cas 1 = invitation, cas 2 = nouveau cabinet)
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        client_id: clientUser.client_id,
        nom_complet: nom_complet ?? '',
        role: 'membre',
      },
      redirectTo: `${SITE_URL}/auth/reset`,
    })

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/team/invite:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
