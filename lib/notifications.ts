// Fonctions d'envoi partagees, utilisees a la fois par l'envoi manuel
// (app/api/outreach/send) et par le cron automatique (app/api/cron/outreach)

type VariablesMessage = {
  nom: string
  cabinet: string
  lien: string
  lienDesinscription: string
}

// Construit le message final : utilise le template personnalise du cabinet si defini
// (avec placeholders {nom}, {cabinet}, {lien}), sinon un message generique par defaut.
// Le lien de desinscription est TOUJOURS ajoute en pied de message, meme si le cabinet
// ne l'a pas inclus dans son texte personnalise (obligation legale, non contournable).
export function construireMessage(
  templatePersonnalise: string | null | undefined,
  variables: VariablesMessage,
  messageParDefaut: string
): string {
  const base = templatePersonnalise
    ? templatePersonnalise
        .replace(/\{nom\}/g, variables.nom)
        .replace(/\{cabinet\}/g, variables.cabinet)
        .replace(/\{lien\}/g, variables.lien)
    : messageParDefaut

  return `${base}\n\n---\nPour ne plus recevoir de message : ${variables.lienDesinscription}`
}

export async function envoyerWhatsapp(telephone: string, message: string, logoUrl?: string | null) {
  const idInstance = process.env.GREENAPI_ID_INSTANCE
  const apiToken = process.env.GREENAPI_API_TOKEN

  if (!idInstance || !apiToken) {
    throw new Error('Configuration GreenAPI manquante')
  }

  // Format attendu par GreenAPI : indicatif pays + numero, sans "+" ni espaces, suivi de "@c.us"
  const numeroFormatte = telephone.replace(/[^0-9]/g, '') + '@c.us'

  // Si un logo est defini, on envoie l'image avec le message en legende (sendFileByUrl).
  // Sinon, simple message texte (sendMessage).
  const url = logoUrl
    ? `https://api.green-api.com/waInstance${idInstance}/sendFileByUrl/${apiToken}`
    : `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`

  const body = logoUrl
    ? { chatId: numeroFormatte, urlFile: logoUrl, fileName: 'logo.png', caption: message }
    : { chatId: numeroFormatte, message }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)

  // GreenAPI peut repondre HTTP 200 tout en signalant un echec dans le corps de la
  // reponse (instance non autorisee, numero invalide, etc.) - on verifie donc aussi
  // la presence d'un identifiant de message reel, pas seulement le code HTTP.
  if (!res.ok || !data?.idMessage) {
    console.error('Erreur GreenAPI (statut ou reponse invalide):', res.status, JSON.stringify(data))
    throw new Error(
      data?.message
        ? `Echec envoi WhatsApp : ${data.message}`
        : "Echec envoi WhatsApp - verifie que l'instance GreenAPI est bien autorisee (QR code scanne)"
    )
  }
}

export async function envoyerEmail(email: string, message: string, logoUrl?: string | null) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Configuration Resend manquante')

  // Par defaut, adresse de test Resend (fonctionne sans domaine verifie, mais limite
  // a l'adresse email du compte Resend). Une fois un domaine verifie sur resend.com/domains,
  // definir RESEND_FROM_EMAIL dans Vercel avec une adresse de ce domaine.
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-width:180px;margin-bottom:16px;" /><br/>`
    : ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: 'Votre diagnostic personnalisé',
      html: `${logoHtml}<p>${message.replace(/\n/g, '<br/>')}</p>`,
    }),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data?.id) {
    console.error('Erreur Resend:', res.status, JSON.stringify(data))
    throw new Error(
      data?.message ? `Echec envoi Email : ${data.message}` : 'Echec envoi Email'
    )
  }
}
