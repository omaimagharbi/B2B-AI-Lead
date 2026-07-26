import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { pack_id } = await req.json()
    if (!pack_id) {
      return NextResponse.json({ error: 'pack_id manquant' }, { status: 400 })
    }

    const { data: pack, error: packError } = await supabaseAdmin
      .from('leads_packs')
      .select('id, diagnostic_id, statut_vente')
      .eq('id', pack_id)
      .single()

    if (packError || !pack) {
      return NextResponse.json({ error: 'Pack introuvable' }, { status: 404 })
    }

    if (pack.statut_vente === 'accepte') {
      // Deja accepte (double-clic ou requete rejouee) : rien a faire de plus.
      return NextResponse.json({ succes: true })
    }

    // Claim atomique : si un autre pack du meme diagnostic a ete accepte entre
    // temps, cette mise a jour ne touche aucune ligne (statut_vente != attendu).
    const { data: miseAJour, error } = await supabaseAdmin
      .from('leads_packs')
      .update({ statut_vente: 'accepte' })
      .eq('id', pack_id)
      .neq('statut_vente', 'accepte')
      .select('id')

    if (error) {
      return NextResponse.json({ error: 'Erreur mise a jour' }, { status: 500 })
    }

    if (!miseAJour || miseAJour.length === 0) {
      return NextResponse.json(
        { error: 'Un autre pack de ce diagnostic a deja ete choisi' },
        { status: 409 }
      )
    }

    // Un seul pack accepte par diagnostic : les autres passent "refuse"
    // (sauf s'ils etaient deja acceptes, ce qui ne devrait jamais arriver ici).
    await supabaseAdmin
      .from('leads_packs')
      .update({ statut_vente: 'refuse' })
      .eq('diagnostic_id', pack.diagnostic_id)
      .neq('id', pack_id)
      .neq('statut_vente', 'accepte')

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/packs/choisir:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
