import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerEmail } from '@/lib/notifications'

// Retour terrain : l'ecran final d'inscription ("Compte cree !") affichait
// les identifiants de toute l'equipe pour copier-coller a la main, sans
// bouton d'envoi. Cette route envoie un email individuel a chaque membre
// avec son propre mot de passe temporaire. Les mots de passe ne sont
// stockes qu'en hash par Supabase Auth - ils ne transitent ici que parce
// que c'est le seul moment ou le client (le navigateur du directeur qui
// vient de s'inscrire) les connait encore en clair, exactement comme pour
// l'affichage a l'ecran qui existait deja.
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
      .select('client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('nom_entreprise, logo_url')
      .eq('id', clientUser.client_id)
      .single()

    const { membres } = (await req.json()) as {
      membres: { email: string; motDePasseTemporaire: string; role: string }[]
    }

    if (!Array.isArray(membres) || membres.length === 0) {
      return NextResponse.json({ error: 'Aucun membre a notifier' }, { status: 400 })
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
    const nomCabinet = clientData?.nom_entreprise ?? 'votre cabinet'

    const resultats = await Promise.allSettled(
      membres.map((m) => {
        const roleLisible = m.role === 'directeur_commercial' ? 'Directeur commercial' : 'Commercial'
        const message =
          `Bonjour,\n\n` +
          `Un compte vient d'être créé pour vous sur la plateforme de ${nomCabinet} (rôle : ${roleLisible}).\n\n` +
          `Email de connexion : ${m.email}\n` +
          `Mot de passe temporaire : ${m.motDePasseTemporaire}\n\n` +
          `Connectez-vous ici : ${siteUrl}/auth?mode=connexion\n\n` +
          `Nous vous recommandons de changer ce mot de passe après votre première connexion.`
        return envoyerEmail(m.email, message, clientData?.logo_url ?? null, `Vos identifiants — ${nomCabinet}`)
      })
    )

    const echecs = resultats.filter((r) => r.status === 'rejected').length

    return NextResponse.json({
      succes: true,
      envoyes: membres.length - echecs,
      echecs,
    })
  } catch (err) {
    console.error('Erreur /api/auth/envoyer-identifiants:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
