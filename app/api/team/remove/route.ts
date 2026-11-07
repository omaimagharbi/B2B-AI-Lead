import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp } from '@/lib/notifications'
import { logActivity } from '@/lib/immo-os/activity'
import { ACTIVE_STATUSES } from '@/lib/immo-os/reminders'

// Supprime un membre de l'equipe (commercial ou directeur commercial).
// Reserve au proprietaire et au directeur commercial. On ne peut jamais
// supprimer le proprietaire du cabinet par ce chemin.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, anonKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const { data: demandeur } = await supabaseAdmin
      .from('client_users')
      .select('id, client_id, role, nom_complet')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!demandeur) {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const peutGererEquipe = demandeur.role === 'proprietaire' || demandeur.role === 'directeur_commercial'
    if (!peutGererEquipe) {
      return NextResponse.json(
        { error: 'Seul le proprietaire ou le directeur commercial peut retirer un membre' },
        { status: 403 }
      )
    }

    const { client_user_id } = await req.json()
    if (!client_user_id) {
      return NextResponse.json({ error: 'client_user_id manquant' }, { status: 400 })
    }

    const { data: cible } = await supabaseAdmin
      .from('client_users')
      .select('id, client_id, role, auth_user_id, nom_complet')
      .eq('id', client_user_id)
      .single()

    if (!cible || cible.client_id !== demandeur.client_id) {
      return NextResponse.json({ error: 'Membre introuvable dans ce cabinet' }, { status: 404 })
    }

    if (cible.role === 'proprietaire') {
      return NextResponse.json(
        { error: 'Impossible de supprimer le proprietaire du cabinet' },
        { status: 400 }
      )
    }

    if (cible.id === demandeur.id) {
      return NextResponse.json({ error: 'Tu ne peux pas te retirer toi-meme' }, { status: 400 })
    }

    // On supprime la ligne client_users (les cibles qui lui etaient assignees
    // repassent automatiquement a "non assigne" grace au on delete set null)
    const { error: deleteError } = await supabaseAdmin
      .from('client_users')
      .delete()
      .eq('id', client_user_id)

    if (deleteError) {
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    // Lot 2 : journal + alerte au directeur si des leads actifs restent attribues a ce membre (best-effort, ne bloque jamais le retrait)
    try {
      const nom = String(cible.nom_complet ?? '').trim()
      await logActivity({ clientId: demandeur.client_id, id: demandeur.id, name: demandeur.nom_complet ?? '', role: demandeur.role }, { action: 'team_remove', entity: 'team', label: nom, details: { role: cible.role } })
      if (nom) {
        const { data: restants } = await supabaseAdmin.from('re_leads').select('name').eq('client_id', demandeur.client_id).eq('agent', nom).in('status', ACTIVE_STATUSES).limit(200)
        const { data: cab } = await supabaseAdmin.from('clients').select('whatsapp_directeur').eq('id', demandeur.client_id).single()
        if (restants?.length && cab?.whatsapp_directeur) {
          const noms = restants.slice(0, 10).map((l) => l.name).join(', ')
          await envoyerWhatsapp(cab.whatsapp_directeur, `${nom} was removed from the team. ${restants.length} active lead${restants.length > 1 ? 's are' : ' is'} not reassigned: ${noms}${restants.length > 10 ? ` and ${restants.length - 10} more` : ''}. Reassign them from the Team page.`)
        }
      }
    } catch (e) { console.error('team/remove alerte:', e) }

    // On coupe aussi l'acces de connexion (sinon le compte auth existe toujours)
    if (cible.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(cible.auth_user_id).catch(() => null)
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/team/remove:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
