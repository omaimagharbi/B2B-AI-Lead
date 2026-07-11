// Fonctions d'envoi partagees, utilisees a la fois par l'envoi manuel
// (app/api/outreach/send) et par le cron automatique (app/api/cron/outreach)

export async function envoyerWhatsapp(telephone: string, message: string) {
  const idInstance = process.env.GREENAPI_ID_INSTANCE
  const apiToken = process.env.GREENAPI_API_TOKEN

  if (!idInstance || !apiToken) {
    throw new Error('Configuration GreenAPI manquante')
  }

  // Format attendu par GreenAPI : indicatif pays + numero, sans "+" ni espaces, suivi de "@c.us"
  const numeroFormatte = telephone.replace(/[^0-9]/g, '') + '@c.us'

  const res = await fetch(
    `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: numeroFormatte, message }),
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    console.error('Erreur GreenAPI:', detail)
    throw new Error('Echec envoi WhatsApp')
  }
}

export async function envoyerEmail(email: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Configuration Resend manquante')

  // Par defaut, adresse de test Resend (fonctionne sans domaine verifie, mais limite
  // a l'adresse email du compte Resend). Une fois un domaine verifie sur resend.com/domains,
  // definir RESEND_FROM_EMAIL dans Vercel avec une adresse de ce domaine.
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

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
      html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Erreur Resend:', detail)
    throw new Error('Echec envoi Email')
  }
}
