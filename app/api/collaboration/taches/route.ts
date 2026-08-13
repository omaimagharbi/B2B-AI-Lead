import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { authentifierClientUser } from '@/lib/auth-api'

export async function GET(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { data, error } = await supabaseAdmin
    .from('taches')
    .select(
      'id, titre, description, statut, echeance, created_at, assigne_a, cree_par, membre:client_users!taches_assigne_a_fkey(nom_complet)'
    )
    .eq('client_id', auth.clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erreur de lecture' }, { status: 500 })

  return NextResponse.json({ taches: data })
}

export async function POST(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { titre, description, assigne_a, echeance } = await req.json()
  if (!titre || !String(titre).trim()) {
    return NextResponse.json({ error: 'Titre manquant' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('taches')
    .insert({
      client_id: auth.clientId,
      titre: String(titre).trim(),
      description: description ? String(description).trim() : null,
      assigne_a: assigne_a || null,
      echeance: echeance || null,
      cree_par: auth.clientUserId,
    })
    .select(
      'id, titre, description, statut, echeance, created_at, assigne_a, cree_par, membre:client_users!taches_assigne_a_fkey(nom_complet)'
    )
    .single()

  if (error) return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })

  return NextResponse.json({ tache: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await authentifierClientUser(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })

  const { id, statut, assigne_a } = await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const maj: Record<string, unknown> = {}
  if (statut) {
    if (!['a_faire', 'en_cours', 'terminee'].includes(statut)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }
    maj.statut = statut
  }
  if (assigne_a !== undefined) maj.assigne_a = assigne_a || null

  if (Object.keys(maj).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })
  }

  // La policy RLS "taches_update" filtre deja par client_id, mais on le
  // repete explicitement cote requete pour eviter toute ambiguite.
  const { error } = await supabaseAdmin
    .from('taches')
    .update(maj)
    .eq('id', id)
    .eq('client_id', auth.clientId)

  if (error) return NextResponse.json({ error: 'Erreur de mise à jour' }, { status: 500 })

  return NextResponse.json({ succes: true })
}
