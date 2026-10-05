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

/**
 * Renvoie le decalage (en minutes, positif = en avance sur UTC) entre UTC et
 * le fuseau IANA donne, A L'INSTANT precis fourni. Necessaire car un meme
 * fuseau peut avoir un decalage different selon la saison (heure ete/hiver
 * en Europe par exemple) - on ne peut pas utiliser une constante fixe.
 * Implementation native (Intl), sans dependance externe.
 */
function decalageMinutes(timeZone: string, instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const commeUTC = Date.UTC(val('year'), val('month') - 1, val('day'), val('hour'), val('minute'), val('second'))
  return Math.round((commeUTC - instant.getTime()) / 60_000)
}

/** Construit le Date UTC correspondant a une heure "murale" locale donnee, dans un fuseau. */
function heureLocaleVersUtc(annee: number, mois: number, jour: number, heure: number, minute: number, timeZone: string): Date {
  // Premiere estimation en traitant l'heure demandee comme si elle etait deja en UTC,
  // puis on corrige avec le vrai decalage du fuseau a cet instant (une iteration
  // suffit dans l'immense majorite des cas, y compris pres des changements d'heure).
  const estimation = new Date(Date.UTC(annee, mois, jour, heure, minute, 0, 0))
  const decalage = decalageMinutes(timeZone, estimation)
  return new Date(estimation.getTime() - decalage * 60_000)
}

/** Calcule les creneaux disponibles (non occupes) sur les prochains jours ouvres,
 * dans le fuseau horaire du cabinet (gere aussi l'heure ete/hiver automatiquement).
 */
export function calculerCreneauxDisponibles(params: {
  busy: { start: string; end: string }[]
  joursAVenir: number
  heureDebut: string // "09:00"
  heureFin: string // "18:00"
  dureeMinutes: number
  fuseauHoraire: string // ex: "Africa/Tunis"
}): { debut: Date; fin: Date }[] {
  const { busy, joursAVenir, heureDebut, heureFin, dureeMinutes, fuseauHoraire } = params
  const [hD, mD] = heureDebut.split(':').map(Number)
  const [hF, mF] = heureFin.split(':').map(Number)
  const creneaux: { debut: Date; fin: Date }[] = []
  const maintenant = new Date()

  // Jour/mois/annee "vus" depuis le fuseau du cabinet (pas UTC), pour que le
  // jour de la semaine (week-end exclu) soit correct de son point de vue.
  const dtfJour = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseauHoraire,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })

  for (let j = 0; j < joursAVenir; j++) {
    const instantApprox = new Date(maintenant.getTime() + j * 24 * 60 * 60_000)
    const parts = dtfJour.formatToParts(instantApprox)
    const val = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const annee = Number(val('year'))
    const mois = Number(val('month')) - 1
    const jourDuMois = Number(val('day'))
    const jourSemaine = val('weekday') // "Sat"/"Sun" en anglais avec en-CA
    if (jourSemaine === 'Sat' || jourSemaine === 'Sun') continue // week-end exclu

    const debutJournee = heureLocaleVersUtc(annee, mois, jourDuMois, hD, mD, fuseauHoraire)
    const finJournee = heureLocaleVersUtc(annee, mois, jourDuMois, hF, mF, fuseauHoraire)

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

/** Formate un instant UTC en heure murale "HH:MM" et date "YYYY-MM-DD" dans un fuseau donne. */
export function heureEtDateLocale(instant: Date, timeZone: string): { date: string; heure: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(instant)
  const val = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { date: `${val('year')}-${val('month')}-${val('day')}`, heure: `${val('hour')}:${val('minute')}` }
}
