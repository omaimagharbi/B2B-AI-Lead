import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { id, nom_complet, telephone, email, onglets_masques, photo_url, pays, genre, date_naissance } =
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

  // Retour terrain : l'email de connexion (Supabase Auth) n'etait modifiable
  // nulle part une fois le compte cree - meme en cas de faute de frappe a
  // l'invitation. On met a jour l'email d'authentification ET la colonne
  // dupliquee sur client_users (utilisee pour l'affichage), dans cet ordre :
  // si l'auth echoue, on ne touche pas client_users pour eviter que les deux
  // divergent.
  if (email !== undefined) {
    const nouveauEmail = String(email).trim().toLowerCase()
    if (!nouveauEmail || !nouveauEmail.includes('@')) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }

    const { data: membre } = await supabaseAdmin
      .from('client_users')
      .select('auth_user_id')
      .eq('id', id)
      .eq('client_id', auth.clientId)
      .single()

    if (!membre) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

    const { error: erreurAuth } = await supabaseAdmin.auth.admin.updateUserById(membre.auth_user_id, {
      email: nouveauEmail,
    })
    if (erreurAuth) {
      return NextResponse.json(
        { error: erreurAuth.message.includes('already') ? 'Cet email est déjà utilisé' : "Erreur lors du changement d'email" },
        { status: 400 }
      )
    }
  }

  const maj: Record<string, unknown> = {}
  if (nom_complet !== undefined) maj.nom_complet = String(nom_complet).trim()
  if (telephone !== undefined) maj.telephone = telephone ? String(telephone).trim() : null
  if (email !== undefined) maj.email = String(email).trim().toLowerCase()
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
