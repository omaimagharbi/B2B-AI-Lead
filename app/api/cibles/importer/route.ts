import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { genererSignalIA } from '@/lib/classification'
import { quotaCiblesDisponible } from '@/lib/quotas'

type ContactImporte = {
  nom: string
  telephone?: string | null
  email?: string | null
  entreprise?: string | null
  pays?: string | null
  canal?: string | null
  resultat?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, anonKey)

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 })
    }

    const { data: clientUser } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('auth_user_id', userData.user.id)
      .single()

    if (!clientUser) {
      return NextResponse.json({ error: 'Aucun cabinet associe' }, { status: 403 })
    }

    const { contacts } = (await req.json()) as { contacts: ContactImporte[] }
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'Aucun contact a importer' }, { status: 400 })
    }

    // Dedoublonnage sur email et telephone (un CSV importe n'a en general pas
    // de linkedin_url, contrairement au sourcing automatique).
    const { data: ciblesExistantes } = await supabaseAdmin
      .from('targets')
      .select('email, telephone')
      .eq('client_id', clientUser.client_id)

    const emailsExistants = new Set(
      (ciblesExistantes ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean)
    )
    const telsExistants = new Set(
      (ciblesExistantes ?? []).map((c) => c.telephone?.replace(/[^0-9]/g, '')).filter(Boolean)
    )

    const vus = new Set<string>()
    let ignoresSansNom = 0

    const lignes = contacts
      .filter((c) => {
        if (!c.nom?.trim()) {
          ignoresSansNom += 1
          return false
        }
        const emailNorm = c.email?.toLowerCase().trim()
        const telNorm = c.telephone?.replace(/[^0-9]/g, '')
        const cleUnicite = emailNorm || telNorm || c.nom.trim().toLowerCase()

        if (
          (emailNorm && emailsExistants.has(emailNorm)) ||
          (telNorm && telsExistants.has(telNorm)) ||
          vus.has(cleUnicite)
        ) {
          return false
        }
        vus.add(cleUnicite)
        return true
      })
      .map((c) => {
        const resultatNorm = c.resultat?.trim().toLowerCase()
        const resultatHistorique =
          resultatNorm && ['gagne', 'gagné', 'won', 'oui', 'accepte', 'accepté'].includes(resultatNorm)
            ? 'gagne'
            : resultatNorm && ['perdu', 'lost', 'non', 'refuse', 'refusé'].includes(resultatNorm)
            ? 'perdu'
            : null

        return {
          client_id: clientUser.client_id,
          nom: c.nom.trim(),
          telephone: c.telephone?.trim() || null,
          email: c.email?.trim() || null,
          entreprise_ou_objectif: c.entreprise?.trim() || null,
          country: c.pays?.trim() || null,
          source_scraping: c.canal?.trim() || null,
          resultat_historique: resultatHistorique,
          statut: resultatHistorique ? 'contacte' : 'nouveau',
          signal_ia: genererSignalIA({
            poste: null,
            entreprise: c.entreprise?.trim() || null,
            segmentCategorie: null,
            segmentUrgence: null,
          }),
        }
      })

    if (lignes.length === 0) {
      return NextResponse.json({
        succes: true,
        nombre_ajoute: 0,
        doublons_ignores: contacts.length - ignoresSansNom,
        sans_nom_ignores: ignoresSansNom,
      })
    }

    const quota = await quotaCiblesDisponible(clientUser.client_id, lignes.length)
    if (!quota.autorise) {
      return NextResponse.json(
        {
          error: `Quota mensuel atteint (${quota.consomme}/${quota.quota} cibles ce mois-ci). Contacte l'administrateur pour l'augmenter.`,
        },
        { status: 403 }
      )
    }

    const { error: insertError } = await supabaseAdmin.from('targets').insert(lignes)
    if (insertError) {
      return NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 })
    }

    return NextResponse.json({
      succes: true,
      nombre_ajoute: lignes.length,
      doublons_ignores: contacts.length - lignes.length - ignoresSansNom,
      sans_nom_ignores: ignoresSansNom,
    })
  } catch (err) {
    console.error('Erreur /api/cibles/importer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
