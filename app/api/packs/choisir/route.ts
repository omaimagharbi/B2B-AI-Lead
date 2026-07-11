import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { pack_id } = await req.json()
    if (!pack_id) {
      return NextResponse.json({ error: 'pack_id manquant' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('leads_packs')
      .update({ statut_vente: 'accepte' })
      .eq('id', pack_id)

    if (error) {
      return NextResponse.json({ error: 'Erreur mise a jour' }, { status: 500 })
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/packs/choisir:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
