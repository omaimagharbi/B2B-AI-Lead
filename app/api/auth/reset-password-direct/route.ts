import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Reinitialisation de mot de passe SANS envoi d'email (le flux Supabase
// resetPasswordForEmail depend d'un SMTP non fiable ici). L'utilisateur
// fournit directement son email + son nouveau mot de passe ; on verifie
// que le compte existe puis on le met a jour immediatement.
//
// ATTENTION SECURITE : ce flux ne verifie l'identite que par l'email
// (pas de lien/code de confirmation). N'importe qui connaissant l'email
// d'un compte peut donc en changer le mot de passe. Acceptable pour un
// nombre restreint de comptes cabinet connus, a renforcer plus tard
// (ex: question de securite, code envoye par WhatsApp) si le nombre
// d'utilisateurs grandit.
export async function POST(req: NextRequest) {
  try {
    const { email, nouveauMotDePasse } = await req.json()

    if (!email || !nouveauMotDePasse) {
      return NextResponse.json({ error: 'Email et nouveau mot de passe requis' }, { status: 400 })
    }
    if (String(nouveauMotDePasse).length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caracteres' },
        { status: 400 }
      )
    }

    // Pas de recherche par email direct dans l'API admin Supabase : on liste
    // les comptes et on filtre. Suffisant pour le volume d'utilisateurs actuel.
    const emailNormalise = String(email).trim().toLowerCase()
    let utilisateurTrouve: { id: string } | null = null
    let page = 1

    while (!utilisateurTrouve) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) {
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      }
      const trouve = data.users.find((u) => (u.email ?? '').toLowerCase() === emailNormalise)
      if (trouve) {
        utilisateurTrouve = { id: trouve.id }
        break
      }
      if (data.users.length < 1000) break // derniere page atteinte
      page += 1
    }

    if (!utilisateurTrouve) {
      return NextResponse.json({ error: 'Aucun compte trouve avec cet email' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      utilisateurTrouve.id,
      { password: nouveauMotDePasse }
    )

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/auth/reset-password-direct:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
