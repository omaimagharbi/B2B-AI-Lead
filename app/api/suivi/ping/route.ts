import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Signal d'activite envoye par le navigateur (components/SuiviActivite.tsx)
// toutes les ~30 s tant que l'utilisateur est connecte et que l'onglet est
// visible. On cumule uniquement le temps ACTIF : si l'ecart avec le signal
// precedent depasse 90 s (onglet en veille, ordinateur ferme...), on ne le
// compte pas.
const ECART_MAX_SECONDES = 90
const PAGES_MAX = 200

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ ok: false }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user?.email) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const sessionId = typeof body?.session_id === 'string' ? body.session_id.slice(0, 64) : ''
    const chemin = typeof body?.chemin === 'string' ? body.chemin.slice(0, 200) : '/'
    const appareil = typeof body?.appareil === 'string' ? body.appareil.slice(0, 120) : null
    if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 })

    const maintenant = new Date()

    const { data: existante } = await supabaseAdmin
      .from('suivi_sessions')
      .select('id, auth_user_id, derniere_activite, duree_secondes, pages')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (!existante) {
      await supabaseAdmin.from('suivi_sessions').insert({
        session_id: sessionId,
        auth_user_id: userData.user.id,
        email: userData.user.email.toLowerCase(),
        debut: maintenant.toISOString(),
        derniere_activite: maintenant.toISOString(),
        duree_secondes: 0,
        pages: [{ chemin, a: maintenant.toISOString() }],
        appareil,
      })
      return NextResponse.json({ ok: true })
    }

    // Un session_id ne peut appartenir qu'a un seul utilisateur
    if (existante.auth_user_id !== userData.user.id) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }

    const ecart = Math.round(
      (maintenant.getTime() - new Date(existante.derniere_activite).getTime()) / 1000
    )
    const ajout = ecart > 0 && ecart <= ECART_MAX_SECONDES ? ecart : 0

    const pages = Array.isArray(existante.pages) ? [...existante.pages] : []
    if (pages.length === 0 || pages[pages.length - 1]?.chemin !== chemin) {
      pages.push({ chemin, a: maintenant.toISOString() })
    }

    await supabaseAdmin
      .from('suivi_sessions')
      .update({
        derniere_activite: maintenant.toISOString(),
        duree_secondes: existante.duree_secondes + ajout,
        pages: pages.slice(-PAGES_MAX),
      })
      .eq('id', existante.id)

    return NextResponse.json({ ok: true })
  } catch {
    // Le suivi ne doit jamais perturber l'utilisateur
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
