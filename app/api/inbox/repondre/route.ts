import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail } from '@/lib/notifications'

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

    const { target_id, canal, message } = await req.json()
    if (!target_id || !canal || !message?.trim()) {
      return NextResponse.json({ error: 'Donnees manquantes' }, { status: 400 })
    }

    const { data: cible } = await supabaseAdmin
      .from('targets')
      .select('id, client_id, telephone, email')
      .eq('id', target_id)
      .single()

    if (!cible || cible.client_id !== clientUser.client_id) {
      return NextResponse.json({ error: 'Cible introuvable dans ce cabinet' }, { status: 404 })
    }

    if (canal === 'whatsapp') {
      if (!cible.telephone) {
        return NextResponse.json({ error: 'Pas de numero pour cette cible' }, { status: 400 })
      }
      await envoyerWhatsapp(cible.telephone, message)
    } else if (canal === 'email') {
      if (!cible.email) {
        return NextResponse.json({ error: "Pas d'email pour cette cible" }, { status: 400 })
      }
      await envoyerEmail(cible.email, message)
    } else {
      return NextResponse.json({ error: 'Canal invalide' }, { status: 400 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/inbox/repondre:', err)
    return NextResponse.json({ error: "Echec de l'envoi" }, { status: 500 })
  }
}
