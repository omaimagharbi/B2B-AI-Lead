import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerEmail } from '@/lib/notifications'

// Genere un mot de passe temporaire simple (lettres + chiffres, sans caracteres
// ambigus comme 0/O ou 1/l) que le cabinet transmet lui-meme a son collegue.
function genererMotDePasseTemporaire(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let mdp = ''
  for (let i = 0; i < 10; i++) {
    mdp += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return mdp
}

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

    const { email, nom_complet, role } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email manquant' }, { status: 400 })
    }

    // Seul un role "commercial" ou "directeur commercial" peut etre attribue via
    // l'invitation - jamais "proprietaire" (reserve a la creation du cabinet).
    const roleFinal = role === 'directeur_commercial' ? 'directeur_commercial' : 'membre'

    const motDePasseTemporaire = genererMotDePasseTemporaire()

    // On cree directement le compte au lieu d'envoyer un email d'invitation
    // (inviteUserByEmail depend de l'envoi d'email Supabase, non fiable ici).
    // Le cabinet transmet lui-meme l'email + mot de passe temporaire a son
    // collegue (WhatsApp, en main propre, etc.). Le trigger SQL
    // handle_new_client_signup (voir 20_correctif_invite_equipe.sql) rattache
    // automatiquement ce nouveau compte au client_id existant grace au
    // client_id passe ici dans les metadonnees.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: motDePasseTemporaire,
      email_confirm: true,
      user_metadata: {
        client_id: clientUser.client_id,
        nom_complet: nom_complet ?? '',
        role: roleFinal,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Email automatique au nouveau membre (best-effort, ne bloque pas la creation).
    let emailEnvoye = true
    try {
      const { data: clientData } = await supabaseAdmin
        .from('clients')
        .select('nom_entreprise, logo_url')
        .eq('id', clientUser.client_id)
        .single()
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
      const nomCabinet = clientData?.nom_entreprise ?? 'votre cabinet'
      const roleLisible = roleFinal === 'directeur_commercial' ? 'Directeur commercial' : 'Commercial'
      await envoyerEmail(
        email,
        `Bonjour,\n\n` +
          `Un compte vient d'être créé pour vous sur la plateforme de ${nomCabinet} (rôle : ${roleLisible}).\n\n` +
          `Email de connexion : ${email}\n` +
          `Mot de passe temporaire : ${motDePasseTemporaire}\n\n` +
          `Connectez-vous ici : ${siteUrl}/auth?mode=connexion\n\n` +
          `Nous vous recommandons de changer ce mot de passe après votre première connexion.`,
        clientData?.logo_url ?? null,
        `Vos identifiants — ${nomCabinet}`
      )
    } catch (err) {
      console.error('Email au nouveau membre non envoye (compte cree quand meme):', err)
      emailEnvoye = false
    }

    return NextResponse.json({ succes: true, motDePasseTemporaire, emailEnvoye })
  } catch (err) {
    console.error('Erreur /api/team/invite:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
