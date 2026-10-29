import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { email, code, nouveauMotDePasse } = await req.json()

    if (!email || !code || !nouveauMotDePasse) {
      return NextResponse.json({ error: 'Email, code et nouveau mot de passe requis' }, { status: 400 })
    }
    if (String(nouveauMotDePasse).length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      )
    }

    const emailNormalise = String(email).trim().toLowerCase()

    const { data: demande } = await supabaseAdmin
      .from('reinitialisations_mdp')
      .select('id, expires_at, utilise')
      .eq('email', emailNormalise)
      .eq('code', String(code).trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!demande) {
      return NextResponse.json({ error: 'Code invalide.' }, { status: 400 })
    }
    if (demande.utilise) {
      return NextResponse.json({ error: 'Ce code a déjà été utilisé. Redemande-en un nouveau.' }, { status: 400 })
    }
    if (new Date(demande.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Ce code a expiré. Redemande-en un nouveau.' }, { status: 400 })
    }

    let page = 1
    let utilisateurTrouve: { id: string } | null = null
    while (!utilisateurTrouve) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      const trouve = data.users.find((u) => (u.email ?? '').toLowerCase() === emailNormalise)
      if (trouve) {
        utilisateurTrouve = { id: trouve.id }
        break
      }
      if (data.users.length < 1000) break
      page += 1
    }

    if (!utilisateurTrouve) {
      return NextResponse.json({ error: 'Aucun compte trouvé avec cet email' }, { status: 404 })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(utilisateurTrouve.id, {
      password: nouveauMotDePasse,
    })
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await supabaseAdmin.from('reinitialisations_mdp').update({ utilise: true }).eq('id', demande.id)

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/auth/mot-de-passe-oublie/confirmer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
