import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Enregistre le premier moment ou le prospect ouvre son lien de diagnostic,
// et renvoie le mode de ciblage du cabinet (entreprise/particulier) pour que
// le formulaire pose les bonnes questions.
// N'ecrase jamais une date deja enregistree (on veut la toute premiere ouverture).
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'token manquant' }, { status: 400 })

    const { data: diagnostic } = await supabaseAdmin
      .from('diagnostics')
      .select('id, lien_ouvert_at, clients(mode_ciblage)')
      .eq('token_acces', token)
      .single()

    if (diagnostic && !diagnostic.lien_ouvert_at) {
      await supabaseAdmin
        .from('diagnostics')
        .update({ lien_ouvert_at: new Date().toISOString() })
        .eq('id', diagnostic.id)
    }

    // @ts-ignore - jointure Supabase typee dynamiquement
    const modeCiblage = diagnostic?.clients?.mode_ciblage ?? 'entreprise'
    return NextResponse.json({ succes: true, mode_ciblage: modeCiblage })
  } catch {
    // Best-effort : on ne bloque jamais le prospect pour un souci de tracking
    return NextResponse.json({ succes: true, mode_ciblage: 'entreprise' })
  }
}
