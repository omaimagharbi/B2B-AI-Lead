import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Genere un mot de passe temporaire simple (memes regles que app/api/team/invite,
// pour rester coherent : le cabinet transmet lui-meme ce mot de passe a son
// collegue).
function genererMotDePasseTemporaire(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let mdp = ''
  for (let i = 0; i < 10; i++) {
    mdp += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return mdp
}

// Appelee juste apres supabase.auth.signUp() par le nouveau formulaire
// d'inscription (app/auth/page.tsx). Regroupe en un seul appel tout ce que
// le nouveau formulaire collecte en plus de l'email/mot de passe/nom du
// cabinet (deja geres par le trigger handle_new_client_signup) :
// telephone/whatsapp pro, logo (deja uploade cote client, on ne recoit que
// l'URL publique), lien du site, reseaux sociaux, et la liste des emails de
// l'equipe a inviter directement.
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
      .select('client_id, role')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser || clientUser.role !== 'proprietaire') {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const { telephone, logo_url, site_web, facebook_url, instagram_url, linkedin_url, invite_emails, email_directeur_commercial } =
      await req.json()

    const { error: erreurMaj } = await supabaseAdmin
      .from('clients')
      .update({
        whatsapp_directeur: telephone || null,
        logo_url: logo_url || null,
        site_web: site_web || null,
        facebook_url: facebook_url || null,
        instagram_url: instagram_url || null,
        linkedin_url: linkedin_url || null,
        onboarding_complete: true,
      })
      .eq('id', clientUser.client_id)

    if (erreurMaj) {
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du cabinet' }, { status: 500 })
    }

    // Invitation directe de l'equipe (meme mecanisme que /api/team/invite) :
    // un email par ligne/virgule -> compte cree tout de suite avec mot de
    // passe temporaire, a transmettre par le directeur.
    const emailsEquipe: string[] = Array.isArray(invite_emails)
      ? invite_emails
      : String(invite_emails || '')
          .split(/[,;\n]/)
          .map((e) => e.trim())
          .filter(Boolean)

    const equipeCreee: { email: string; motDePasseTemporaire: string; role: string }[] = []
    const echecsInvitation: string[] = []

    const membresAInviter: { email: string; role: 'membre' | 'directeur_commercial' }[] = [
      ...(email_directeur_commercial && String(email_directeur_commercial).trim()
        ? [{ email: String(email_directeur_commercial).trim(), role: 'directeur_commercial' as const }]
        : []),
      ...emailsEquipe.map((email) => ({ email, role: 'membre' as const })),
    ]

    for (const { email, role } of membresAInviter) {
      const motDePasseTemporaire = genererMotDePasseTemporaire()
      const { error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: motDePasseTemporaire,
        email_confirm: true,
        user_metadata: {
          client_id: clientUser.client_id,
          nom_complet: '',
          role,
        },
      })
      if (erreurCreation) {
        echecsInvitation.push(email)
      } else {
        equipeCreee.push({ email, motDePasseTemporaire, role })
      }
    }

    return NextResponse.json({ succes: true, equipeCreee, echecsInvitation })
  } catch (err) {
    console.error('Erreur /api/inscription/finaliser:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
