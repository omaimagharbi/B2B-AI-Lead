import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerWhatsapp, envoyerEmail } from '@/lib/notifications'
import { canalParPays } from '@/lib/pays'
import { logErreur } from '@/lib/erreurs'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type PackInput = { nom: string; prix_indicatif: number; description: string }

export async function POST(req: NextRequest) {
  try {
    const { diagnostic_id, json_expert_valide, packs } = (await req.json()) as {
      diagnostic_id: string
      json_expert_valide: {
        titre: string
        synthese: string
        methodologie: string
        etapes: { nom: string; description: string }[]
      }
      packs: PackInput[]
    }

    if (!diagnostic_id || !json_expert_valide) {
      return NextResponse.json({ error: 'Donnees manquantes' }, { status: 400 })
    }

    // 1. On recupere le diagnostic + la cible (pour savoir comment la contacter)
    const { data: diagnostic, error: diagError } = await supabaseAdmin
      .from('diagnostics')
      .select(
        'id, token_acces, client_id, targets(nom, telephone, email, country, token_desinscription), clients(nom_entreprise, logo_url)'
      )
      .eq('id', diagnostic_id)
      .single()

    if (diagError || !diagnostic) {
      return NextResponse.json({ error: 'Diagnostic introuvable' }, { status: 404 })
    }

    // @ts-ignore - jointure Supabase typee dynamiquement
    const target = diagnostic.targets as {
      nom: string
      telephone: string | null
      email: string | null
      country: string | null
      token_desinscription: string
    }
    // @ts-ignore - jointure Supabase typee dynamiquement
    const nomCabinet = diagnostic.clients?.nom_entreprise ?? 'Votre expert'
    // @ts-ignore - jointure Supabase typee dynamiquement
    const logoUrl = diagnostic.clients?.logo_url as string | null | undefined

    // 2. On sauvegarde la version validee par l'expert
    await supabaseAdmin
      .from('diagnostics')
      .update({
        json_expert_valide,
        statut_validation: 'valide_par_expert',
      })
      .eq('id', diagnostic_id)

    // 3. On (re)cree les packs proposes (on supprime les anciens au cas ou re-validation)
    await supabaseAdmin.from('leads_packs').delete().eq('diagnostic_id', diagnostic_id)

    if (packs && packs.length > 0) {
      await supabaseAdmin.from('leads_packs').insert(
        packs.map((p) => ({
          diagnostic_id,
          pack_propose_nom: p.nom,
          prix_pack: p.prix_indicatif,
          statut_vente: 'propose',
        }))
      )
    }

    // 4. On envoie le lien au prospect, par le canal adapte a son pays
    const lien = `${SITE_URL}/packs/${diagnostic.token_acces}`
    const lienDesinscription = `${SITE_URL}/desinscription/${target.token_desinscription}`
    const message = `Bonjour ${target.nom},\n\n${nomCabinet} a etudie votre dossier et vous propose une solution personnalisee :\n${lien}\n\n---\nPour ne plus recevoir de message : ${lienDesinscription}`

    const canal = canalParPays(target.country ?? 'FR')

    try {
      if (canal === 'whatsapp' && target.telephone) {
        await envoyerWhatsapp(target.telephone, message, logoUrl)
      } else if (target.email) {
        await envoyerEmail(target.email, message, logoUrl)
      } else {
        console.error('Aucun moyen de contact disponible pour cette cible')
      }
    } catch (err) {
      // On ne bloque pas la validation si l'envoi echoue, mais on le journalise
      console.error("Erreur lors de l'envoi au prospect:", err)
    }

    return NextResponse.json({ succes: true })
  } catch (err) {
    console.error('Erreur /api/diagnostic/validate:', err)
    await logErreur('/api/diagnostic/validate', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
