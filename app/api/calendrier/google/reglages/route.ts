import { NextRequest, NextResponse } from 'next/server'
import { authentifierClientUser } from '@/lib/auth-api'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  if (!['proprietaire', 'admin', 'directeur_commercial'].includes(auth.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { duree_minutes, heure_debut, heure_fin } = await req.json()
  const maj: Record<string, unknown> = {}
  if (duree_minutes !== undefined) maj.reservation_duree_minutes = duree_minutes
  if (heure_debut !== undefined) maj.reservation_heure_debut = heure_debut
  if (heure_fin !== undefined) maj.reservation_heure_fin = heure_fin

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('clients').update(maj).eq('id', auth.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ succes: true })
}
