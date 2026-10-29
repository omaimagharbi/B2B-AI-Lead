import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const { token, nom, entreprise, telephone, email } = await req.json()

    if (!token || !nom || !telephone || !email) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
    }

    // 1. On recupere le diagnostic complet (deja genere a l'etape /api/diagnostic)
    const { data: diagnostic, error: findError } = await supabaseAdmin
      .from('diagnostics')
      .select('id, client_id, reponse_ia_complete, statut')
      .eq('token_acces', token)
      .single()

    if (findError || !diagnostic || diagnostic.statut !== 'complete') {
      return NextResponse.json({ error: 'Diagnostic introuvable ou non pret' }, { status: 404 })
    }

    // 2. On marque le diagnostic comme debloque
    await supabaseAdmin
      .from('diagnostics')
      .update({ statut: 'debloque' })
      .eq('id', diagnostic.id)

    // 3. On cree la fiche lead qui sera visible dans le dashboard du cabinet
    const { error: insertError } = await supabaseAdmin.from('leads').insert({
      diagnostic_id: diagnostic.id,
      client_id: diagnostic.client_id,
      nom_prospect: nom,
      entreprise_prospect: entreprise ?? null,
      telephone,
      email,
      plan_action_pdf_url: `/rapport/${token}`, // page imprimable, voir etape 6
    })

    if (insertError) {
      console.error('Erreur creation lead:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la creation du lead' }, { status: 500 })
    }

    // 4. On renvoie enfin le rapport complet au prospect
    return NextResponse.json({ rapport: diagnostic.reponse_ia_complete })
  } catch (err) {
    console.error('Erreur /api/lead:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
