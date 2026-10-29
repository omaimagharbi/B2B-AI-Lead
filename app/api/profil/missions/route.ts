import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const cible = req.nextUrl.searchParams.get('client_user_id') ?? auth.clientUserId

  const { data, error } = await supabaseAdmin
    .from('client_users_missions')
    .select('id, titre, description, statut, created_at')
    .eq('client_user_id', cible)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  return NextResponse.json({ missions: data })
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { titre, description, statut } = await req.json()
  if (!titre?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('client_users_missions')
    .insert({
      client_user_id: auth.clientUserId,
      titre: titre.trim(),
      description: description?.trim() || null,
      statut: statut === 'terminee' ? 'terminee' : 'en_cours',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: "Erreur d'enregistrement" }, { status: 500 })
  return NextResponse.json({ mission: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { id, statut } = await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('client_users_missions')
    .update({ statut: statut === 'terminee' ? 'terminee' : 'en_cours' })
    .eq('id', id)
    .eq('client_user_id', auth.clientUserId)

  if (error) return NextResponse.json({ error: 'Erreur de mise à jour' }, { status: 500 })
  return NextResponse.json({ succes: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('client_users_missions')
    .delete()
    .eq('id', id)
    .eq('client_user_id', auth.clientUserId)

  if (error) return NextResponse.json({ error: 'Erreur de suppression' }, { status: 500 })
  return NextResponse.json({ succes: true })
}
