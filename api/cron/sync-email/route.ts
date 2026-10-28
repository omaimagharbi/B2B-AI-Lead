import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { synchroniserBoiteImap } from '@/lib/imap-sync'
import { logErreur } from '@/lib/erreurs'

// Cron : synchronise la boite IMAP de chaque client qui l'a configuree et
// activee (imap_actif = true). Vient en complement du webhook Resend
// Inbound existant, pour les cabinets qui utilisent leur propre boite mail
// pro plutot que le domaine gere par Resend.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const autorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!autorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, imap_host, imap_port, imap_utilisateur, imap_mot_de_passe, imap_secure, imap_derniere_sync_at')
    .eq('imap_actif', true)
    .not('imap_host', 'is', null)
    .not('imap_utilisateur', 'is', null)
    .not('imap_mot_de_passe', 'is', null)

  if (error) {
    await logErreur('cron/sync-email', error.message)
    return NextResponse.json({ error: 'Erreur lecture clients' }, { status: 500 })
  }

  const resultats: { client_id: string; succes: boolean; nbMessagesTraites: number; erreur?: string }[] = []

  for (const client of clients ?? []) {
    const resultat = await synchroniserBoiteImap({
      id: client.id,
      imap_host: client.imap_host!,
      imap_port: client.imap_port ?? 993,
      imap_utilisateur: client.imap_utilisateur!,
      imap_mot_de_passe: client.imap_mot_de_passe!,
      imap_secure: client.imap_secure ?? true,
      imap_derniere_sync_at: client.imap_derniere_sync_at,
    })

    resultats.push({ client_id: client.id, ...resultat })

    if (!resultat.succes) {
      await logErreur('cron/sync-email', `Client ${client.id}: ${resultat.erreur}`)
    }
  }

  return NextResponse.json({ succes: true, clients_traites: resultats.length, resultats })
}
