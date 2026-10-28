import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data, error } = await supabaseAdmin
    .from('messages_equipe')
    .select('id, contenu, created_at, auteur_id, client_users(nom_complet)')
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Erreur de lecture' }, { status: 500 })

  return NextResponse.json({ messages: data })
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { contenu } = await req.json()
  if (!contenu || !String(contenu).trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('messages_equipe')
    .insert({
      client_id: auth.clientId,
      auteur_id: auth.clientUserId,
      contenu: String(contenu).trim(),
    })
    .select('id, contenu, created_at, auteur_id, client_users(nom_complet)')
    .single()

  if (error) return NextResponse.json({ error: "Erreur lors de l'envoi" }, { status: 500 })

  return NextResponse.json({ message: data })
}
