import { NextRequest, NextResponse } from 'next/server'
import { authentifierClientUser } from '@/lib/auth-api'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function DELETE(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  if (!['proprietaire', 'admin', 'directeur_commercial'].includes(auth.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await supabaseAdmin
    .from('clients')
    .update({
      google_calendar_connecte: false,
      google_calendar_access_token: null,
      google_calendar_refresh_token: null,
      google_calendar_token_expiry: null,
      google_calendar_email: null,
    })
    .eq('id', auth.clientId)

  return NextResponse.json({ succes: true })
}
