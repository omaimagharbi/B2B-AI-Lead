import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recupererCreneauxOccupes, creerEvenementGoogle, calculerCreneauxDisponibles } from '@/lib/google-calendar'
import { envoyerEmail } from '@/lib/notifications'
import { logErreur } from '@/lib/erreurs'

async function chargerContexte(token: string) {
  const { data: diagnostic } = await supabaseAdmin
    .from('diagnostics')
    .select(
      'id, client_id, target_id, targets(nom, email), clients(id, nom_entreprise, email, google_calendar_connecte, google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expiry, google_calendar_id, reservation_duree_minutes, reservation_heure_debut, reservation_heure_fin)'
    )
    .eq('token_acces', token)
    .single()

  if (!diagnostic) return null

  type ClientRow = {
    id: string
    nom_entreprise: string
    email: string | null
    google_calendar_connecte: boolean
    google_calendar_access_token: string | null
    google_calendar_refresh_token: string | null
    google_calendar_token_expiry: string | null
    google_calendar_id: string | null
    reservation_duree_minutes: number | null
    reservation_heure_debut: string | null
    reservation_heure_fin: string | null
  }
  type TargetRow = { nom: string; email: string | null }

  const client = diagnostic.clients as unknown as ClientRow | null
  const target = diagnostic.targets as unknown as TargetRow | null
  if (!client) return null

  return { diagnostic, client, target }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const contexte = await chargerContexte(params.token)
  if (!contexte) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 })
  const { client } = contexte

  if (!client.google_calendar_connecte) {
    return NextResponse.json({ connecte: false, creneaux: [] })
  }

  try {
    const maintenant = new Date()
    const dans14Jours = new Date(maintenant.getTime() + 14 * 24 * 60 * 60 * 1000)
    const busy = await recupererCreneauxOccupes(client, maintenant, dans14Jours)
    const creneaux = calculerCreneauxDisponibles({
      busy,
      joursAVenir: 14,
      heureDebut: client.reservation_heure_debut ?? '09:00',
      heureFin: client.reservation_heure_fin ?? '18:00',
      dureeMinutes: client.reservation_duree_minutes ?? 30,
    })
    return NextResponse.json({
      connecte: true,
      nom_cabinet: client.nom_entreprise,
      creneaux: creneaux.slice(0, 40).map((c) => ({ debut: c.debut.toISOString(), fin: c.fin.toISOString() })),
    })
  } catch (err) {
    await logErreur('/api/reserver/[token] GET', err)
    return NextResponse.json({ error: 'Impossible de récupérer les disponibilités' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const contexte = await chargerContexte(params.token)
  if (!contexte) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 })
  const { client, target } = contexte

  if (!client.google_calendar_connecte) {
    return NextResponse.json({ error: "Le calendrier n'est pas connecté" }, { status: 400 })
  }

  const { debut } = await req.json()
  if (!debut) return NextResponse.json({ error: 'Créneau manquant' }, { status: 400 })

  const dateDebut = new Date(debut)
  const dureeMinutes = client.reservation_duree_minutes ?? 30
  const dateFin = new Date(dateDebut.getTime() + dureeMinutes * 60_000)

  try {
    // On revalide la disponibilite juste avant de creer l'evenement, pour
    // eviter un double-booking entre l'affichage des creneaux et le clic.
    const busy = await recupererCreneauxOccupes(client, dateDebut, dateFin)
    const chevauche = busy.some(
      (b) => dateDebut.getTime() < new Date(b.end).getTime() && dateFin.getTime() > new Date(b.start).getTime()
    )
    if (chevauche) {
      return NextResponse.json({ error: 'Ce créneau vient d\'être pris, choisis-en un autre' }, { status: 409 })
    }

    const googleEventId = await creerEvenementGoogle(client, {
      titre: `Échange avec ${target?.nom ?? 'un prospect'}`,
      description: `Rendez-vous pris automatiquement suite à un diagnostic PiloBrain.`,
      debut: dateDebut,
      fin: dateFin,
      emailInvite: target?.email ?? undefined,
    })

    // Meme decalage que dans calculerCreneauxDisponibles (lib/google-calendar.ts) :
    // date_evenement/heure_debut doivent refleter l'heure de Tunisie affichee au
    // cabinet dans "Mon Calendrier", pas l'heure UTC du serveur.
    const dateDebutTunis = new Date(dateDebut.getTime() + 60 * 60_000)
    await supabaseAdmin.from('calendrier_entrees').insert({
      client_id: client.id,
      titre: `Échange avec ${target?.nom ?? 'un prospect'}`,
      description: 'Réservé en ligne par le prospect suite au diagnostic.',
      date_evenement: dateDebutTunis.toISOString().slice(0, 10),
      heure_debut: dateDebutTunis.toISOString().slice(11, 16),
      duree_minutes: dureeMinutes,
      type: 'rdv',
      target_id: contexte.diagnostic.target_id,
      google_event_id: googleEventId,
    })

    if (client.email) {
      await envoyerEmail(
        client.email,
        `Bonjour,\n\n${target?.nom ?? 'Un prospect'} vient de réserver un créneau le ${dateDebut.toLocaleString('fr-FR')}. L'événement a été ajouté à votre Google Calendar.`
      )
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    await logErreur('/api/reserver/[token] POST', err)
    return NextResponse.json({ error: 'Impossible de réserver ce créneau' }, { status: 500 })
  }
}
