import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { authentifierClientUser } from '@/lib/auth-api'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { urlAutorisationGoogle } from '@/lib/google-calendar'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  if (!['proprietaire', 'admin', 'directeur_commercial'].includes(auth.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Intégration Google Calendar non configurée (GOOGLE_CALENDAR_CLIENT_ID manquant)" },
      { status: 500 }
    )
  }

  // Nonce anti-CSRF : verifie au callback avant d'associer les jetons au bon cabinet.
  const nonce = crypto.randomBytes(16).toString('hex')
  await supabaseAdmin
    .from('clients')
    .update({ google_calendar_oauth_state: nonce })
    .eq('id', auth.clientId)

  const state = Buffer.from(JSON.stringify({ clientId: auth.clientId, nonce })).toString('base64url')
  const redirectUri = `${SITE_URL}/api/calendrier/google/callback`
  const url = urlAutorisationGoogle(clientId, redirectUri, state)

  return NextResponse.json({ url })
}
