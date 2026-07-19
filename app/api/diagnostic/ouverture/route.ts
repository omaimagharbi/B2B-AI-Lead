import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Enregistre le premier moment ou le prospect ouvre son lien de diagnostic.
// N'ecrase jamais une date deja enregistree (on veut la toute premiere ouverture).
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token manquant' }, { status: 400 })

    const { data: diagnostic } = await supabaseAdmin
      .from('diagnostics')
      .select('id, lien_ouvert_at')
      .eq('token_acces', token)
      .single()

    if (diagnostic && !diagnostic.lien_ouvert_at) {
      await supabaseAdmin
        .from('diagnostics')
        .update({ lien_ouvert_at: new Date().toISOString() })
        .eq('id', diagnostic.id)
    }

    return NextResponse.json({ succes: true })
  } catch {
    // Best-effort : on ne bloque jamais le prospect pour un souci de tracking
    return NextResponse.json({ succes: true })
  }
}
