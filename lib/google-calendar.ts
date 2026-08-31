import { supabaseAdmin } from '@/lib/supabase-admin'

// Integration Google Calendar : connexion OAuth par cabinet, lecture de la
// disponibilite reelle (freebusy) et creation d'evenement lors d'une
// reservation en ligne par un prospect. Necessite un projet Google Cloud
// avec l'API "Google Calendar API" activee et un ecran de consentement
// OAuth configure (voir .env.local.example pour les variables requises).

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export function urlAutorisationGoogle(clientId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function echangerCodeContreJetons(code: string, redirectUri: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google OAuth token exchange: ${res.status} ${await res.text()}`)
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
    id_token?: string
  }>
}

async function rafraichirJetonSiNecessaire(client: {
  id: string
  google_calendar_access_token: string | null
  google_calendar_refresh_token: string | null
  google_calendar_token_expiry: string | null
}): Promise<string> {
  const expireBientot =
    !client.google_calendar_token_expiry ||
    new Date(client.google_calendar_token_expiry).getTime() - Date.now() < 60_000

  if (!expireBientot && client.google_calendar_access_token) {
    return client.google_calendar_access_token
  }

  if (!client.google_calendar_refresh_token) {
    throw new Error('Aucun refresh_token Google enregistre - reconnexion necessaire')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? '',
      refresh_token: client.google_calendar_refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Google OAuth refresh: ${res.status} ${await res.text()}`)
  const data = await res.json()

  await supabaseAdmin
    .from('clients')
    .update({
      google_calendar_access_token: data.access_token,
      google_calendar_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    })
    .eq('id', client.id)

  return data.access_token as string
}

/** Renvoie les intervalles occupes (busy) sur la periode donnee, depuis Google Calendar. */
export async function recupererCreneauxOccupes(
  client: {
    id: string
    google_calendar_access_token: string | null
    google_calendar_refresh_token: string | null
    google_calendar_token_expiry: string | null
    google_calendar_id: string | null
  },
  dateDebut: Date,
  dateFin: Date
): Promise<{ start: string; end: string }[]> {
  const accessToken = await rafraichirJetonSiNecessaire(client)
  const res = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: dateDebut.toISOString(),
      timeMax: dateFin.toISOString(),
      items: [{ id: client.google_calendar_id || 'primary' }],
    }),
  })
  if (!res.ok) throw new Error(`Google freeBusy: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const cal = data.calendars?.[client.google_calendar_id || 'primary']
  return cal?.busy ?? []
}

/** Cree un evenement dans le Google Calendar du cabinet et renvoie son id. */
export async function creerEvenementGoogle(
  client: {
    id: string
    google_calendar_access_token: string | null
    google_calendar_refresh_token: string | null
    google_calendar_token_expiry: string | null
    google_calendar_id: string | null
  },
  evenement: { titre: string; description?: string; debut: Date; fin: Date; emailInvite?: string }
): Promise<string> {
  const accessToken = await rafraichirJetonSiNecessaire(client)
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(client.google_calendar_id || 'primary')}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: evenement.titre,
        description: evenement.description ?? '',
        start: { dateTime: evenement.debut.toISOString() },
        end: { dateTime: evenement.fin.toISOString() },
        attendees: evenement.emailInvite ? [{ email: evenement.emailInvite }] : undefined,
      }),
    }
  )
  if (!res.ok) throw new Error(`Google create event: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.id as string
}

/** Calcule les creneaux disponibles (non occupes) sur les prochains jours ouvres.
 *
 * IMPORTANT - fuseau horaire : les fonctions serverless (Vercel) tournent en UTC,
 * pas dans le fuseau du cabinet. Sans correction, "9h-18h" configure par le
 * cabinet serait interprete comme 9h-18h UTC (donc 10h-19h heure de Tunis),
 * ce qui decalait tous les creneaux affiches d'une heure. On applique donc un
 * decalage explicite. Limite actuelle : ce decalage est fixe (heure de
 * Tunisie, UTC+1 toute l'annee, pas de changement d'heure ete/hiver) - s'il
 * faut gerer des cabinets dans d'autres fuseaux, il faudra stocker le fuseau
 * par cabinet plutot qu'une constante.
 */
const DECALAGE_HEURES_TUNISIE = 1 // UTC+1

export function calculerCreneauxDisponibles(params: {
  busy: { start: string; end: string }[]
  joursAVenir: number
  heureDebut: string // "09:00"
  heureFin: string // "18:00"
  dureeMinutes: number
}): { debut: Date; fin: Date }[] {
  const { busy, joursAVenir, heureDebut, heureFin, dureeMinutes } = params
  const [hD, mD] = heureDebut.split(':').map(Number)
  const [hF, mF] = heureFin.split(':').map(Number)
  const creneaux: { debut: Date; fin: Date }[] = []
  const maintenant = new Date()

  for (let j = 0; j < joursAVenir; j++) {
    const jour = new Date(maintenant)
    jour.setUTCDate(jour.getUTCDate() + j)
    // Le jour de la semaine doit lui aussi etre lu dans le fuseau du cabinet,
    // pas en UTC, sinon un creneau tard le vendredi soir (heure de Tunis)
    // pourrait etre lu comme samedi en UTC et exclu a tort.
    const jourLocal = new Date(jour.getTime() + DECALAGE_HEURES_TUNISIE * 60 * 60_000)
    if (jourLocal.getUTCDay() === 0 || jourLocal.getUTCDay() === 6) continue // week-end exclu

    const debutJournee = new Date(
      Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate(), hD - DECALAGE_HEURES_TUNISIE, mD, 0, 0)
    )
    const finJournee = new Date(
      Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate(), hF - DECALAGE_HEURES_TUNISIE, mF, 0, 0)
    )

    for (
      let curseur = new Date(debutJournee);
      curseur.getTime() + dureeMinutes * 60_000 <= finJournee.getTime();
      curseur = new Date(curseur.getTime() + dureeMinutes * 60_000)
    ) {
      if (curseur.getTime() < maintenant.getTime()) continue
      const finCreneau = new Date(curseur.getTime() + dureeMinutes * 60_000)
      const chevauche = busy.some(
        (b) => curseur.getTime() < new Date(b.end).getTime() && finCreneau.getTime() > new Date(b.start).getTime()
      )
      if (!chevauche) creneaux.push({ debut: new Date(curseur), fin: finCreneau })
    }
  }

  return creneaux
}
