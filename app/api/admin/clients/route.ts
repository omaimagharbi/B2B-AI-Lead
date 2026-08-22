import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifie que la requete vient bien d'un utilisateur admin autorise
// (on compare son email au(x) email(s) admin defini(s) dans ADMIN_EMAILS)
async function estAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return false

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return adminEmails.includes(data.user.email)
}

export async function GET(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('id, nom_entreprise, email, statut_abonnement, plan_tarifaire, commission_pourcentage, acces_active, montant_abonnement, devise_abonnement, statut_paiement, date_echeance_paiement, mode_paiement, quota_cibles_mensuel, created_at, verticals(slug)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }

  // On compte separement les packs vendus par client (jointure via diagnostics)
  const { data: packsVendus } = await supabaseAdmin
    .from('leads_packs')
    .select('prix_pack, diagnostics!inner(client_id)')
    .eq('statut_vente', 'accepte')

  const comptageParClient = new Map<string, number>()
  const montantParClient = new Map<string, number>()
  for (const p of packsVendus ?? []) {
    // @ts-ignore - jointure Supabase typee dynamiquement
    const clientId = p.diagnostics?.client_id as string
    comptageParClient.set(clientId, (comptageParClient.get(clientId) ?? 0) + 1)
    montantParClient.set(clientId, (montantParClient.get(clientId) ?? 0) + (p.prix_pack ?? 0))
  }

  // Nombre total de cibles par client (activite de sourcing/prospection),
  // et consommation du mois en cours (pour la jauge de quota, Sprint 5).
  const { data: toutesLesCibles } = await supabaseAdmin.from('targets').select('client_id, created_at')
  const nbCiblesParClient = new Map<string, number>()
  const nbCiblesMoisEnCoursParClient = new Map<string, number>()
  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)

  for (const c of toutesLesCibles ?? []) {
    nbCiblesParClient.set(c.client_id, (nbCiblesParClient.get(c.client_id) ?? 0) + 1)
    if (c.created_at && new Date(c.created_at) >= debutMois) {
      nbCiblesMoisEnCoursParClient.set(
        c.client_id,
        (nbCiblesMoisEnCoursParClient.get(c.client_id) ?? 0) + 1
      )
    }
  }

  // Diagnostics en attente de validation par client (charge de travail en cours)
  const { data: diagsEnAttente } = await supabaseAdmin
    .from('diagnostics')
    .select('client_id')
    .eq('statut_validation', 'en_attente_validation')
  const nbAttenteParClient = new Map<string, number>()
  for (const d of diagsEnAttente ?? []) {
    nbAttenteParClient.set(d.client_id, (nbAttenteParClient.get(d.client_id) ?? 0) + 1)
  }

  const clientsAvecComptage = (clients ?? []).map((c) => {
    const montantVendu = montantParClient.get(c.id) ?? 0
    const commissionPourcentage = c.commission_pourcentage ?? 0
    // @ts-ignore - jointure Supabase typee dynamiquement (objet ou tableau selon la relation)
    const verticalJointure = c.verticals as { slug: string } | { slug: string }[] | null
    const vertical_slug = Array.isArray(verticalJointure)
      ? verticalJointure[0]?.slug ?? null
      : verticalJointure?.slug ?? null
    const { verticals: _verticals, ...clientSansJointure } = c as typeof c & { verticals?: unknown }
    return {
      ...clientSansJointure,
      vertical_slug,
      packs_vendus: comptageParClient.get(c.id) ?? 0,
      montant_vendu: montantVendu,
      commission_due: Math.round(montantVendu * (commissionPourcentage / 100) * 100) / 100,
      nb_cibles: nbCiblesParClient.get(c.id) ?? 0,
      nb_cibles_mois_en_cours: nbCiblesMoisEnCoursParClient.get(c.id) ?? 0,
      nb_diagnostics_attente: nbAttenteParClient.get(c.id) ?? 0,
    }
  })

  return NextResponse.json({ clients: clientsAvecComptage })
}

// Supprime definitivement un cabinet (utilise pour nettoyer les comptes de
// test crees pendant les demos). Supprime aussi les comptes Supabase Auth
// de tous les membres du cabinet (proprietaire + equipe invitee), car
// supprimer uniquement la ligne "clients" ne supprime pas les comptes
// auth.users lies - ils resteraient utilisables pour se connecter (avec un
// dashboard vide). Toutes les tables filles (targets, diagnostics, cibles,
// etc.) sont en "on delete cascade" sur clients.id, donc un seul delete
// suffit cote donnees metier.
export async function DELETE(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { client_id } = await req.json()

  if (!client_id) {
    return NextResponse.json({ error: 'client_id manquant' }, { status: 400 })
  }

  // 1. Recuperer tous les comptes auth lies a ce cabinet (proprietaire + equipe)
  const { data: membres, error: erreurMembres } = await supabaseAdmin
    .from('client_users')
    .select('id, auth_user_id')
    .eq('client_id', client_id)

  if (erreurMembres) {
    console.error('Erreur lecture membres avant suppression:', erreurMembres)
    return NextResponse.json({ error: 'Erreur de lecture des membres' }, { status: 500 })
  }

  // 2. Supprimer explicitement les lignes filles qui pourraient bloquer la
  // suppression du cabinet si leur contrainte n'est pas en "on delete
  // cascade" (le schema de base, cree avant ces migrations, n'est pas
  // verifiable ici) - dans le doute on nettoie nous-memes plutot que de
  // compter uniquement sur le cascade SQL.
  await supabaseAdmin.from('client_users').delete().eq('client_id', client_id)
  await supabaseAdmin.from('targets').delete().eq('client_id', client_id)
  await supabaseAdmin.from('diagnostics').delete().eq('client_id', client_id)

  // 3. Supprimer la ligne clients (cascade sur le reste : catalogue, taches,
  // messages, notes, historique de strategie, etc.)
  const { error: erreurSuppression } = await supabaseAdmin
    .from('clients')
    .delete()
    .eq('id', client_id)

  if (erreurSuppression) {
    console.error('Erreur suppression client:', erreurSuppression)
    return NextResponse.json(
      { error: `Erreur lors de la suppression du cabinet : ${erreurSuppression.message}` },
      { status: 500 }
    )
  }

  // 4. Supprimer chaque compte Supabase Auth associe (best-effort : si l'un
  // echoue on continue les autres et on le signale dans la reponse)
  const echecsAuth: string[] = []
  for (const m of membres ?? []) {
    if (!m.auth_user_id) continue
    const { error } = await supabaseAdmin.auth.admin.deleteUser(m.auth_user_id)
    if (error) echecsAuth.push(m.auth_user_id)
  }

  return NextResponse.json({ succes: true, comptes_auth_non_supprimes: echecsAuth })
}

export async function POST(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const {
    client_id,
    statut_abonnement,
    plan_tarifaire,
    commission_pourcentage,
    acces_active,
    montant_abonnement,
    devise_abonnement,
    statut_paiement,
    date_echeance_paiement,
    mode_paiement,
    quota_cibles_mensuel,
  } = await req.json()

  if (!client_id) {
    return NextResponse.json({ error: 'client_id manquant' }, { status: 400 })
  }

  const misAJour: Record<string, unknown> = {}
  if (statut_abonnement !== undefined) misAJour.statut_abonnement = statut_abonnement
  if (plan_tarifaire !== undefined) misAJour.plan_tarifaire = plan_tarifaire
  if (commission_pourcentage !== undefined) misAJour.commission_pourcentage = commission_pourcentage
  if (acces_active !== undefined) misAJour.acces_active = acces_active
  if (montant_abonnement !== undefined) misAJour.montant_abonnement = montant_abonnement
  if (devise_abonnement !== undefined) misAJour.devise_abonnement = devise_abonnement
  if (statut_paiement !== undefined) misAJour.statut_paiement = statut_paiement
  if (date_echeance_paiement !== undefined) misAJour.date_echeance_paiement = date_echeance_paiement
  if (mode_paiement !== undefined) misAJour.mode_paiement = mode_paiement
  if (quota_cibles_mensuel !== undefined) misAJour.quota_cibles_mensuel = quota_cibles_mensuel

  const { error } = await supabaseAdmin.from('clients').update(misAJour).eq('id', client_id)

  if (error) {
    return NextResponse.json({ error: 'Erreur de mise a jour' }, { status: 500 })
  }

  return NextResponse.json({ succes: true })
}
