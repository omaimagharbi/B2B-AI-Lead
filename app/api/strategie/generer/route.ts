import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Agregat = { canal: string; total: number; gagnes: number; taux: number }

function agreger(
  cles: (string | null)[],
  gagnes: boolean[]
): Agregat[] {
  const map = new Map<string, { total: number; gagnes: number }>()
  cles.forEach((cle, i) => {
    const c = cle?.trim() || 'Non renseigné'
    const entree = map.get(c) ?? { total: 0, gagnes: 0 }
    entree.total += 1
    if (gagnes[i]) entree.gagnes += 1
    map.set(c, entree)
  })
  return Array.from(map.entries())
    .map(([canal, v]) => ({
      canal,
      total: v.total,
      gagnes: v.gagnes,
      taux: v.total > 0 ? Math.round((v.gagnes / v.total) * 100) : 0,
    }))
    .filter((a) => a.total >= 2) // on ignore le bruit statistique sur un seul cas
    .sort((a, b) => b.taux - a.taux)
}

async function genererTexteGemini(prompt: string, apiKey: string): Promise<string> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function genererTexteAnthropic(prompt: string, apiKey: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
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

    const { data: clientData } = await supabaseAdmin
      .from('clients')
      .select('taux_closing_historique, mots_cles_expertise, idees_recues_marche')
      .eq('id', clientUser.client_id)
      .single()

    const { data: cibles } = await supabaseAdmin
      .from('targets')
      .select('id, source_scraping, segment_categorie, segment_urgence, resultat_historique')
      .eq('client_id', clientUser.client_id)

    const { data: packsAcceptes } = await supabaseAdmin
      .from('leads_packs')
      .select('diagnostics!inner(client_id, target_id)')
      .eq('diagnostics.client_id', clientUser.client_id)
      .eq('statut_vente', 'accepte')

    const targetIdsGagnesReels = new Set(
      (packsAcceptes ?? [])
        .map((p) => {
          const diag = Array.isArray(p.diagnostics) ? p.diagnostics[0] : p.diagnostics
          return diag?.target_id as string | undefined
        })
        .filter(Boolean)
    )

    const cibleGagnee = (c: { id: string; resultat_historique: string | null }) =>
      c.resultat_historique === 'gagne' || targetIdsGagnesReels.has(c.id)

    // Contenu marketing deja genere (toutes les suggestions liees a ce cabinet),
    // pour degager les themes/formats qui reviennent le plus souvent.
    const { data: diagnosticsAvecContenu } = await supabaseAdmin
      .from('diagnostics')
      .select('recommandations_json')
      .eq('client_id', clientUser.client_id)

    const suggestionsMarketing = (diagnosticsAvecContenu ?? [])
      .map((d) => {
        const reco = d.recommandations_json as {
          contenuMarketing?: { format_suggere?: string }
          segment?: { categorie?: string }
        } | null
        return reco?.contenuMarketing ? reco.segment?.categorie ?? 'Non catégorisé' : null
      })
      .filter((c): c is string => c !== null)

    const parThemeMarketing = agreger(
      suggestionsMarketing,
      suggestionsMarketing.map(() => false) // pas de notion de "gagne" ici, juste la frequence
    ).map((a) => ({ ...a, taux: 0 })) // le taux n'a pas de sens ici, seul le total compte

    if (!cibles || cibles.length < 4) {
      return NextResponse.json({
        succes: true,
        recommandationCommerciale:
          "Pas encore assez de données pour dégager une vraie tendance (au moins quelques dizaines de cibles avec un résultat sont nécessaires). Importe d'anciens clients avec leur résultat (colonne \"resultat\": gagné/perdu), ou continue à utiliser la plateforme puis régénère la stratégie plus tard.",
        recommandationMarketing: null,
        parCanal: [],
        parSegment: [],
        parThemeMarketing: [],
        historique: [],
      })
    }

    const gagnesArray = cibles.map(cibleGagnee)
    const parCanal = agreger(
      cibles.map((c) => c.source_scraping),
      gagnesArray
    )
    const parSegment = agreger(
      cibles.map((c) => c.segment_categorie),
      gagnesArray
    )

    const resumeCommercial = `
Données du cabinet (taux de conversion = % de cibles gagnées) :
Par canal de sourcing : ${parCanal.map((a) => `${a.canal} (${a.gagnes}/${a.total}, ${a.taux}%)`).join(', ') || 'pas assez de données'}
Par segment de besoin : ${parSegment.map((a) => `${a.canal} (${a.gagnes}/${a.total}, ${a.taux}%)`).join(', ') || 'pas assez de données'}
${
  clientData?.taux_closing_historique
    ? `Taux de closing historique du cabinet AVANT la plateforme (a comparer aux chiffres ci-dessus pour estimer le gain) : ${clientData.taux_closing_historique}%.`
    : ''
}
`.trim()

    const resumeMarketing = [
      parThemeMarketing.length > 0
        ? `Thèmes de contenu marketing déjà générés, par fréquence : ${parThemeMarketing
            .map((a) => `${a.canal} (${a.total} suggestion(s))`)
            .join(', ')}`
        : 'Pas encore de contenu marketing généré.',
      clientData?.mots_cles_expertise
        ? `Périmètre technique reel du cabinet (rester dans ce cadre, ne jamais devier hors-sujet) : ${clientData.mots_cles_expertise}.`
        : '',
      clientData?.idees_recues_marche
        ? `Idée reçue du marché à contrer en priorité via du contenu de type "matrice de contre-objection" (thought leadership) : ${clientData.idees_recues_marche}`
        : '',
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `Tu es consultant en stratégie commerciale et marketing pour un cabinet de formation/conseil. Voici ses données :\n\n${resumeCommercial}\n\n${resumeMarketing}\n\nRéponds en français, sans jargon, EXACTEMENT dans ce format (rien d'autre) :\nCOMMERCIAL: <3 recommandations courtes séparées par un point, sur où concentrer les efforts de vente>\nMARKETING: <2-3 recommandations courtes séparées par un point, sur quels thèmes/formats de contenu prioriser>`

    const geminiKey = process.env.GEMINI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let texteBrut = ''

    try {
      if (geminiKey) texteBrut = await genererTexteGemini(prompt, geminiKey)
      else if (anthropicKey) texteBrut = await genererTexteAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('IA indisponible pour la strategie:', err)
    }

    let recommandationCommerciale = ''
    let recommandationMarketing = ''

    const matchCommercial = texteBrut.match(/COMMERCIAL:\s*([\s\S]*?)(?:MARKETING:|$)/i)
    const matchMarketing = texteBrut.match(/MARKETING:\s*([\s\S]*)/i)
    if (matchCommercial) recommandationCommerciale = matchCommercial[1].trim()
    if (matchMarketing) recommandationMarketing = matchMarketing[1].trim()

    if (!recommandationCommerciale) {
      const meilleurCanal = parCanal[0]
      const meilleurSegment = parSegment[0]
      recommandationCommerciale = [
        meilleurCanal
          ? `Ton canal le plus efficace est "${meilleurCanal.canal}" (${meilleurCanal.taux}% de conversion) — concentre ton budget de sourcing dessus.`
          : 'Pas assez de données par canal pour recommander une priorité.',
        meilleurSegment
          ? `Le segment "${meilleurSegment.canal}" convertit le mieux (${meilleurSegment.taux}%) — adapte ton message pour ce type de besoin.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
    }

    if (!recommandationMarketing) {
      const themePrincipal = parThemeMarketing[0]
      recommandationMarketing = themePrincipal
        ? `Le thème "${themePrincipal.canal}" revient le plus souvent dans tes suggestions — priorise-le dans tes prochaines publications.`
        : 'Pas encore assez de contenu marketing généré pour dégager une tendance.'
    }

    const { data: historiquePrecedent } = await supabaseAdmin
      .from('strategies_generees')
      .select('id, recommandation_commerciale, recommandation_marketing, created_at')
      .eq('client_id', clientUser.client_id)
      .order('created_at', { ascending: false })
      .limit(10)

    await supabaseAdmin.from('strategies_generees').insert({
      client_id: clientUser.client_id,
      recommandation_commerciale: recommandationCommerciale,
      recommandation_marketing: recommandationMarketing,
      stats_json: { parCanal, parSegment, parThemeMarketing },
    })

    return NextResponse.json({
      succes: true,
      recommandationCommerciale,
      recommandationMarketing,
      parCanal,
      parSegment,
      parThemeMarketing,
      historique: historiquePrecedent ?? [],
    })
  } catch (err) {
    console.error('Erreur /api/strategie/generer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
