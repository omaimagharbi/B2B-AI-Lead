import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Sauvegarde la config IMAP du client connecte. Le mot de passe transite ici
// une seule fois (au moment de la sauvegarde) puis n'est plus jamais renvoye
// au navigateur - app/dashboard/page.tsx ne le charge pas dans son select.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: userData, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id, role')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })

    const body = await req.json()
    const { imap_host, imap_port, imap_utilisateur, imap_mot_de_passe, imap_secure, imap_actif } =
      body as {
        imap_host?: string
        imap_port?: number
        imap_utilisateur?: string
        imap_mot_de_passe?: string
        imap_secure?: boolean
        imap_actif?: boolean
      }

    const misAJour: Record<string, unknown> = {
      imap_host: imap_host?.trim() || null,
      imap_port: imap_port ?? 993,
      imap_utilisateur: imap_utilisateur?.trim() || null,
      imap_secure: imap_secure ?? true,
      imap_actif: imap_actif ?? false,
    }

    // Le mot de passe n'est ecrase que si un nouveau a ete saisi (le champ
    // reste vide dans le formulaire si l'utilisateur ne veut pas le changer).
    if (imap_mot_de_passe) {
      misAJour.imap_mot_de_passe = imap_mot_de_passe
    }

    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update(misAJour)
      .eq('id', clientUser.client_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur sauvegarde config IMAP:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
