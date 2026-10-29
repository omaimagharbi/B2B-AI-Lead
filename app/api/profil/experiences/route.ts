import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

// Chacun gere ses propres entrees de profil (Experiences/Formation/Missions,
// meme pattern pour les 3) : pas de supervision croisee ici, contrairement a
// /api/team/modifier - le profil est un espace personnel.

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const cible = req.nextUrl.searchParams.get('client_user_id') ?? auth.clientUserId

  const { data, error } = await supabaseAdmin
    .from('client_users_experiences')
    .select('id, intitule, entreprise, date_debut, date_fin, en_cours, description')
    .eq('client_user_id', cible)
    .order('date_debut', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  return NextResponse.json({ experiences: data })
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { intitule, entreprise, date_debut, date_fin, en_cours, description } = await req.json()
  if (!intitule?.trim()) return NextResponse.json({ error: 'Intitulé requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('client_users_experiences')
    .insert({
      client_user_id: auth.clientUserId,
      intitule: intitule.trim(),
      entreprise: entreprise?.trim() || null,
      date_debut: date_debut || null,
      date_fin: en_cours ? null : date_fin || null,
      en_cours: !!en_cours,
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: "Erreur d'enregistrement" }, { status: 500 })
  return NextResponse.json({ experience: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('client_users_experiences')
    .delete()
    .eq('id', id)
    .eq('client_user_id', auth.clientUserId)

  if (error) return NextResponse.json({ error: 'Erreur de suppression' }, { status: 500 })
  return NextResponse.json({ succes: true })
}
