import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Recoit les notifications GreenAPI ("incomingMessageReceived") quand un
// prospect repond par WhatsApp. A configurer dans les parametres de
// l'instance GreenAPI : webhookUrl = https://tonsite.com/api/webhook/whatsapp?secret=TON_SECRET
//
// Un seul compte WhatsApp (une seule instance GreenAPI) sert tous les
// cabinets : on retrouve le bon cabinet en cherchant a quelle cible
// appartient le numero de telephone qui a repondu.
function normaliserTelephone(tel: string): string {
  return tel.replace(/[^0-9]/g, '')
}

export async function POST(req: NextRequest) {
  const secretUrl = req.nextUrl.searchParams.get('secret')
  if (secretUrl !== process.env.WHATSAPP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  try {
    const body = await req.json()

    if (body.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ succes: true, ignore: true })
    }

    const chatId = body.senderData?.sender ?? body.senderData?.chatId ?? ''
    const telephoneBrut = String(chatId).replace('@c.us', '')
    const texte =
      body.messageData?.textMessageData?.textMessage ??
      body.messageData?.extendedTextMessageData?.text ??
      null

    if (!telephoneBrut || !texte) {
      return NextResponse.json({ succes: true, ignore: true })
    }

    const telephoneNormalise = normaliserTelephone(telephoneBrut)

    // On cherche la cible correspondante tous cabinets confondus (une seule
    // instance WhatsApp partagee), en comparant les chiffres du numero.
    const { data: cibles } = await supabaseAdmin
      .from('targets')
      .select('id, client_id, telephone')
      .not('telephone', 'is', null)

    const cible = (cibles ?? []).find(
      (c) => c.telephone && normaliserTelephone(c.telephone).endsWith(telephoneNormalise.slice(-9))
    )

    if (!cible) {
      // Numero inconnu (pas une de nos cibles) : on ne peut pas savoir a quel
      // cabinet ca appartient, on ignore proprement.
      return NextResponse.json({ succes: true, ignore: true })
    }

    await supabaseAdmin.from('messages_recus').insert({
      client_id: cible.client_id,
      target_id: cible.id,
      canal: 'whatsapp',
      contenu: texte,
      expediteur: telephoneBrut,
    })

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur webhook whatsapp:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
