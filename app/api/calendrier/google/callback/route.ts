import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { echangerCodeContreJetons } from '@/lib/google-calendar'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const erreurGoogle = url.searchParams.get('error')

  const redirigerVersDashboard = (statut: 'succes' | 'erreur', message?: string) => {
    const dest = new URL(`${SITE_URL}/dashboard`)
    dest.searchParams.set('google_calendar', statut)
    if (message) dest.searchParams.set('message', message)
    return NextResponse.redirect(dest)
  }

  if (erreurGoogle) return redirigerVersDashboard('erreur', 'Connexion refusée ou annulée')
  if (!code || !state) return redirigerVersDashboard('erreur', 'Paramètres manquants')

  let clientId: string
  let nonce: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    clientId = decoded.clientId
    nonce = decoded.nonce
  } catch {
    return redirigerVersDashboard('erreur', 'État invalide')
  }

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, google_calendar_oauth_state')
    .eq('id', clientId)
    .single()

  if (!client || client.google_calendar_oauth_state !== nonce) {
    return redirigerVersDashboard('erreur', 'État invalide ou expiré')
  }

  try {
    const redirectUri = `${SITE_URL}/api/calendrier/google/callback`
    const jetons = await echangerCodeContreJetons(code, redirectUri)

    // Recupere l'email du compte Google connecte pour affichage.
    let emailGoogle: string | null = null
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${jetons.access_token}` },
      })
      if (res.ok) emailGoogle = (await res.json()).email ?? null
    } catch {
      // pas bloquant si l'email n'est pas recupere
    }

    await supabaseAdmin
      .from('clients')
      .update({
        google_calendar_connecte: true,
        google_calendar_access_token: jetons.access_token,
        google_calendar_refresh_token: jetons.refresh_token ?? undefined,
        google_calendar_token_expiry: new Date(Date.now() + jetons.expires_in * 1000).toISOString(),
        google_calendar_email: emailGoogle,
        google_calendar_oauth_state: null,
      })
      .eq('id', clientId)

    return redirigerVersDashboard('succes')
  } catch (err) {
    await logErreur('/api/calendrier/google/callback', err)
    return redirigerVersDashboard('erreur', 'Échec de la connexion à Google Calendar')
  }
}
