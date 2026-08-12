import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { traiterReponseEntrante } from '@/lib/traiter-reponse'

type ClientImapConfig = {
  id: string
  imap_host: string
  imap_port: number
  imap_utilisateur: string
  imap_mot_de_passe: string
  imap_secure: boolean
  imap_derniere_sync_at: string | null
}

// Synchronise la boite mail IMAP d'UN client : se connecte, recupere les
// messages non lus arrives depuis la derniere synchro, essaie de les
// rattacher a une cible connue (par email expediteur), et les fait passer
// par le meme traitement (classification IA + notification) que le webhook.
export async function synchroniserBoiteImap(client: ClientImapConfig): Promise<{
  succes: boolean
  nbMessagesTraites: number
  erreur?: string
}> {
  const client_imap = new ImapFlow({
    host: client.imap_host,
    port: client.imap_port,
    secure: client.imap_secure,
    auth: {
      user: client.imap_utilisateur,
      pass: client.imap_mot_de_passe,
    },
    logger: false,
  })

  let nbMessagesTraites = 0

  try {
    await client_imap.connect()
    const lock = await client_imap.getMailboxLock('INBOX')

    try {
      // On ne prend que les messages arrives depuis la derniere synchro
      // (ou les 24 dernieres heures au tout premier passage), pour ne pas
      // re-traiter tout l'historique de la boite a chaque execution.
      const depuis = client.imap_derniere_sync_at
        ? new Date(client.imap_derniere_sync_at)
        : new Date(Date.now() - 24 * 60 * 60 * 1000)

      const recherche = await client_imap.search({ since: depuis }, { uid: true })
      const uids = Array.isArray(recherche) ? recherche : []

      for (const uid of uids) {
        const message = await client_imap.fetchOne(String(uid), { source: true }, { uid: true })
        if (!message || !message.source) continue

        const parsed = await simpleParser(message.source)
        const expediteur = parsed.from?.value?.[0]?.address?.toLowerCase().trim()
        const texte = (parsed.text ?? '').trim()

        if (!expediteur || !texte) continue

        // On tente de rattacher ce message a une cible connue de ce client
        // via son adresse email.
        const { data: cible } = await supabaseAdmin
          .from('targets')
          .select('id, client_id')
          .eq('client_id', client.id)
          .ilike('email', expediteur)
          .limit(1)
          .maybeSingle()

        if (!cible) continue // message d'un expediteur inconnu, on ignore

        await traiterReponseEntrante({
          clientId: client.id,
          targetId: cible.id,
          canal: 'email',
          contenu: texte,
          expediteur,
        })

        nbMessagesTraites++
      }
    } finally {
      lock.release()
    }

    await client_imap.logout()

    await supabaseAdmin
      .from('clients')
      .update({ imap_derniere_sync_at: new Date().toISOString(), imap_derniere_erreur: null })
      .eq('id', client.id)

    return { succes: true, nbMessagesTraites }
  } catch (err) {
    const messageErreur = err instanceof Error ? err.message : 'Erreur IMAP inconnue'
    await supabaseAdmin
      .from('clients')
      .update({ imap_derniere_erreur: messageErreur })
      .eq('id', client.id)

    try {
      await client_imap.logout()
    } catch {
      // rien a faire, la connexion est peut-etre deja fermee
    }

    return { succes: false, nbMessagesTraites, erreur: messageErreur }
  }
}
