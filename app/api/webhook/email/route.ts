import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { traiterReponseEntrante } from '@/lib/traiter-reponse'

// Recoit les emails entrants via la fonction "Inbound" de Resend (evenement
// email.received). A configurer dans Resend : Webhooks > nouvelle URL =
// https://tonsite.com/api/webhook/email?secret=TON_SECRET, evenement "email.received".
export async function POST(req: NextRequest) {
  const secretUrl = req.nextUrl.searchParams.get('secret')
  if (secretUrl !== process.env.EMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (body.type !== 'email.received') {
      return NextResponse.json({ succes: true, ignore: true })
    }

    const expediteur = (body.data?.from ?? '').toLowerCase().trim()
    const texte = body.data?.text ?? body.data?.html ?? body.data?.subject ?? null

    if (!expediteur || !texte) {
      return NextResponse.json({ succes: true, ignore: true })
    }

    // On retrouve la cible par email, tous cabinets confondus (une seule
    // adresse/domaine de reception).
    const { data: cible } = await supabaseAdmin
      .from('targets')
      .select('id, client_id')
      .ilike('email', expediteur)
      .limit(1)
      .maybeSingle()

    if (!cible) {
      return NextResponse.json({ succes: true, ignore: true })
    }

    await traiterReponseEntrante({
      clientId: cible.client_id,
      targetId: cible.id,
      canal: 'email',
      contenu: texte,
      expediteur,
    })

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur webhook email:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
