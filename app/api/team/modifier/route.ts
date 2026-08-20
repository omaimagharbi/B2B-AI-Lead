import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { id, nom_complet, telephone, onglets_masques, photo_url, pays, genre, date_naissance } =
    await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const peutSuperviser = ['proprietaire', 'admin', 'directeur_commercial'].includes(auth.role)
  const modifieSonPropreProfil = id === auth.clientUserId

  if (!peutSuperviser && !modifieSonPropreProfil) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Seul un superviseur peut changer les droits d'acces d'un membre - un
  // membre ne peut jamais s'auto-accorder ou se retirer des onglets.
  if (onglets_masques !== undefined && !peutSuperviser) {
    return NextResponse.json({ error: "Non autorisé à modifier les droits d'accès" }, { status: 403 })
  }

  const maj: Record<string, unknown> = {}
  if (nom_complet !== undefined) maj.nom_complet = String(nom_complet).trim()
  if (telephone !== undefined) maj.telephone = telephone ? String(telephone).trim() : null
  if (onglets_masques !== undefined) maj.onglets_masques = onglets_masques
  if (photo_url !== undefined) maj.photo_url = photo_url ? String(photo_url) : null
  if (pays !== undefined) maj.pays = pays ? String(pays).trim() : null
  if (genre !== undefined) maj.genre = genre ? String(genre) : null
  if (date_naissance !== undefined) maj.date_naissance = date_naissance || null

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('client_users')
    .update(maj)
    .eq('id', id)
    .eq('client_id', auth.clientId)

  if (error) return NextResponse.json({ error: 'Erreur de mise à jour' }, { status: 500 })

  return NextResponse.json({ succes: true })
}
