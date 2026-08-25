import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Agregat = { canal: string; total: number; gagnes: number; taux: number }

type SortieStrategie = {
  commercial: string
  marketing: string
  filtresRecommandes: { postes: string[]; secteur: string; taille: string } | null
  scriptAppel: string
  scriptLinkedin: string
  guideQualification: string[]
  ligneEditoriale: string
  leadMagnets: string[]
}

function agreger(cles: (string | null)[], gagnes: boolean[]): Agregat[] {
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

const FORMAT_JSON_ATTENDU = `Réponds UNIQUEMENT avec un objet JSON valide (sans balises markdown, sans texte avant/après), exactement dans ce format :
{
  "commercial": "3 recommandations courtes séparées par un point, sur où concentrer les efforts de vente",
  "marketing": "2-3 recommandations courtes séparées par un point, sur quels thèmes/formats de contenu prioriser",
  "filtresRecommandes": { "postes": ["poste1", "poste2"], "secteur": "nom du secteur le plus prometteur", "taille": "pme ou grande_entreprise ou indifferent" },
  "scriptAppel": "une trame d'appel téléphonique complète et concrète (5-8 phrases), adaptée au profil ciblé et à l'expertise du cabinet",
  "scriptLinkedin": "un message LinkedIn court et concret (3-5 phrases) à envoyer à un décideur ciblé",
  "guideQualification": ["question 1 exacte à poser au premier rendez-vous", "question 2", "question 3"],
  "ligneEditoriale": "1-2 phrases définissant l'angle éditorial à adopter pour séduire le persona ciblé",
  "leadMagnets": ["idée de contenu gratuit 1 pour capter des emails", "idée 2"]
}`

async function genererJsonGemini(prompt: string, apiKey: string): Promise<string> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-3.7-flash'
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

async function genererJsonAnthropic(prompt: string, apiKey: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
}

// Repli 100% rule-based (pas d'IA configuree ou IA indisponible) : reste
// utile et concret en s'appuyant sur les vraies donnees du cabinet plutot
// que de renvoyer du vide, sur le meme principe que genererBrouillonSimule
// pour les diagnostics.
function genererSortieSimulee(params: {
  meilleurCanal: Agregat | null
  meilleurSegment: Agregat | null
  themePrincipal: Agregat | null
  postesCibles: string[]
  secteurActivite: string | null
  tailleEntreprise: string
  motsClesExpertise: string | null
  ideesRecuesMarche: string | null
  positionnementSite: string | null
}): SortieStrategie {
  const {
    meilleurCanal,
    meilleurSegment,
    themePrincipal,
    postesCibles,
    secteurActivite,
    tailleEntreprise,
    motsClesExpertise,
    ideesRecuesMarche,
    positionnementSite,
  } = params

  const posteRef = postesCibles[0] ?? 'décideur'
  const expertiseRef = motsClesExpertise?.split(',')[0]?.trim() || 'votre domaine d\'expertise'

  const commercial = [
    meilleurCanal
      ? `Ton canal le plus efficace est "${meilleurCanal.canal}" (${meilleurCanal.taux}% de conversion) — concentre ton budget de sourcing dessus.`
      : 'Pas assez de données par canal pour recommander une priorité.',
    meilleurSegment
      ? `Le segment "${meilleurSegment.canal}" convertit le mieux (${meilleurSegment.taux}%) — adapte ton message pour ce type de besoin.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  const marketing = themePrincipal
    ? `Le thème "${themePrincipal.canal}" revient le plus souvent dans tes suggestions — priorise-le dans tes prochaines publications.`
    : 'Pas encore assez de contenu marketing généré pour dégager une tendance.'

  return {
    commercial,
    marketing,
    filtresRecommandes: {
      postes: postesCibles.slice(0, 3),
      secteur: secteurActivite ?? '',
      taille: tailleEntreprise,
    },
    scriptAppel:
      `Bonjour, je suis [ton prénom] de [nom du cabinet]. Je vous contacte car nous accompagnons des ${posteRef}s ` +
      `sur des problématiques de ${expertiseRef}. Est-ce un sujet d'actualité pour vous en ce moment ? ` +
      `[Laisser répondre, puis :] Ce que nous proposons, c'est un diagnostic rapide de votre situation, sans engagement, ` +
      `pour voir si un accompagnement aurait du sens. Est-ce que 15 minutes cette semaine seraient possibles ?`,
    scriptLinkedin:
      `Bonjour [prénom], je vois que vous êtes ${posteRef} chez [entreprise]. Nous accompagnons des profils similaires ` +
      `sur des sujets de ${expertiseRef}. Seriez-vous ouvert(e) à un échange rapide pour voir si cela pourrait vous être utile ?`,
    guideQualification: [
      `Quel est l'objectif chiffré (chiffre d'affaires, budget, délai) impacté par ce problème ?`,
      `Qui est le décisionnaire final pour ce type de projet/budget ?`,
      `Depuis combien de temps ce sujet est-il une priorité pour vous ?`,
    ],
    ligneEditoriale: ideesRecuesMarche
      ? `Pour contrer l'idée reçue "${ideesRecuesMarche.slice(0, 100)}", publiez du contenu qui démontre concrètement l'impact terrain de votre expertise.`
      : positionnementSite
      ? `Publiez autour de : ${positionnementSite.slice(0, 140)}`
      : `Publiez sur les problématiques concrètes de vos ${posteRef}s cibles, avec des exemples chiffrés plutôt que de la théorie.`,
    leadMagnets: [
      `Un guide PDF court : "Comment [résoudre le problème principal de vos ${posteRef}s cibles]"`,
      `Une checklist d'auto-diagnostic à télécharger contre une adresse email`,
    ],
  }
}

function parserSortieIA(texteBrut: string): Partial<SortieStrategie> | null {
  try {
    const nettoye = texteBrut.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(nettoye)
    return {
      commercial: typeof parsed.commercial === 'string' ? parsed.commercial : undefined,
      marketing: typeof parsed.marketing === 'string' ? parsed.marketing : undefined,
      filtresRecommandes:
        parsed.filtresRecommandes && typeof parsed.filtresRecommandes === 'object'
          ? {
              postes: Array.isArray(parsed.filtresRecommandes.postes) ? parsed.filtresRecommandes.postes : [],
              secteur: parsed.filtresRecommandes.secteur ?? '',
              taille: parsed.filtresRecommandes.taille ?? '',
            }
          : undefined,
      scriptAppel: typeof parsed.scriptAppel === 'string' ? parsed.scriptAppel : undefined,
      scriptLinkedin: typeof parsed.scriptLinkedin === 'string' ? parsed.scriptLinkedin : undefined,
      guideQualification: Array.isArray(parsed.guideQualification) ? parsed.guideQualification : undefined,
      ligneEditoriale: typeof parsed.ligneEditoriale === 'string' ? parsed.ligneEditoriale : undefined,
      leadMagnets: Array.isArray(parsed.leadMagnets) ? parsed.leadMagnets : undefined,
    }
  } catch {
    return null
  }
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

    const { data: clientDataRaw } = await supabaseAdmin
      .from('clients')
      .select(
        'taux_closing_historique, mots_cles_expertise, idees_recues_marche, motifs_rejet_passes, ' +
          'canaux_echoues, volume_equipe_commerciale, positionnement_site, ligne_editoriale_reseaux, ' +
          'mode_ciblage, secteur_activite, taille_entreprise, taille_min_salaries, taille_max_salaries, ' +
          'profil_particulier, portee_geographique, villes_ciblees, reseaux_actifs, blog_actif, ' +
          'base_email_existante, budget_publicitaire, objectif_chiffre'
      )
      .eq('id', clientUser.client_id)
      .single()

    const clientData = clientDataRaw as unknown as {
      taux_closing_historique: number | null
      mots_cles_expertise: string | null
      idees_recues_marche: string | null
      motifs_rejet_passes: string | null
      canaux_echoues: string | null
      volume_equipe_commerciale: string | null
      positionnement_site: string | null
      ligne_editoriale_reseaux: string | null
      mode_ciblage: string | null
      secteur_activite: string | null
      taille_entreprise: string | null
      taille_min_salaries: number | null
      taille_max_salaries: number | null
      profil_particulier: string | null
      portee_geographique: string | null
      villes_ciblees: string | null
      reseaux_actifs: Record<string, boolean> | null
      blog_actif: boolean | null
      base_email_existante: string | null
      budget_publicitaire: string | null
      objectif_chiffre: string | null
    } | null

    const { data: professionsData } = await supabaseAdmin
      .from('client_professions')
      .select('profession')
      .eq('client_id', clientUser.client_id)
    const postesCibles = (professionsData ?? []).map((p) => p.profession)

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
      suggestionsMarketing.map(() => false)
    ).map((a) => ({ ...a, taux: 0 }))

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
        filtresRecommandes: null,
        scriptAppel: null,
        scriptLinkedin: null,
        guideQualification: [],
        ligneEditoriale: null,
        leadMagnets: [],
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

    const reseauxActifs = (clientData?.reseaux_actifs ?? {}) as Record<string, boolean>
    const reseauxActifsTexte = ['linkedin', 'facebook', 'instagram']
      .filter((r) => reseauxActifs?.[r])
      .join(', ')

    const resumeProfil = `
Profil cible : ${
      clientData?.mode_ciblage === 'particulier'
        ? `Particuliers — ${clientData?.profil_particulier || 'non précisé'}`
        : `Entreprises — postes visés : ${postesCibles.join(', ') || 'non précisé'} ; secteur : ${
            clientData?.secteur_activite || 'indifférent'
          } ; taille : ${clientData?.taille_entreprise || 'indifférent'}${
            clientData?.taille_min_salaries || clientData?.taille_max_salaries
              ? ` (${clientData?.taille_min_salaries ?? '?'}-${clientData?.taille_max_salaries ?? '+'} salariés)`
              : ''
          }`
    }
Portée géographique : ${clientData?.portee_geographique || 'non précisée'}${
      clientData?.portee_geographique === 'local' && clientData?.villes_ciblees
        ? ` (${clientData.villes_ciblees})`
        : ''
    }
Réseaux sociaux actifs : ${reseauxActifsTexte || 'aucun déclaré'}
Blog actif : ${clientData?.blog_actif ? 'oui' : 'non'}
Base email existante : ${clientData?.base_email_existante || 'non déclarée'}
Budget publicitaire : ${clientData?.budget_publicitaire || 'non précisé'}
Objectifs chiffrés : ${clientData?.objectif_chiffre || 'non précisés'}
`.trim()

    const resumeCommercial = `
Données du cabinet (taux de conversion = % de cibles gagnées) :
Par canal de sourcing : ${parCanal.map((a) => `${a.canal} (${a.gagnes}/${a.total}, ${a.taux}%)`).join(', ') || 'pas assez de données'}
Par segment de besoin : ${parSegment.map((a) => `${a.canal} (${a.gagnes}/${a.total}, ${a.taux}%)`).join(', ') || 'pas assez de données'}
${
  clientData?.taux_closing_historique
    ? `Taux de closing historique du cabinet AVANT la plateforme (a comparer aux chiffres ci-dessus pour estimer le gain) : ${clientData.taux_closing_historique}%.`
    : ''
}
${
  clientData?.motifs_rejet_passes
    ? `Objections/motifs de rejet recurrents du passe (a anticiper et casser dans l'argumentaire commercial) : ${clientData.motifs_rejet_passes}`
    : ''
}
${
  clientData?.canaux_echoues
    ? `Canaux de prospection deja tentes SANS succes par le passe (a eviter de recommander) : ${clientData.canaux_echoues}`
    : ''
}
${
  clientData?.positionnement_site
    ? `Positionnement de marque extrait automatiquement du site web du cabinet (a respecter, ne pas devier) : ${clientData.positionnement_site}`
    : ''
}
${
  clientData?.ligne_editoriale_reseaux
    ? `Ligne editoriale/ton observe sur les reseaux du cabinet (LinkedIn/Facebook) : ${clientData.ligne_editoriale_reseaux}`
    : ''
}
${
  clientData?.volume_equipe_commerciale
    ? `Volume de travail actuel de l'equipe commerciale avant automatisation (point de comparaison pour chiffrer le gain de productivite) : ${clientData.volume_equipe_commerciale}`
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

    const prompt = `Tu es consultant en stratégie commerciale et marketing pour un cabinet de formation/conseil. Voici son profil de ciblage et ses données :\n\n${resumeProfil}\n\n${resumeCommercial}\n\n${resumeMarketing}\n\n${FORMAT_JSON_ATTENDU}`

    const geminiKey = process.env.GEMINI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let texteBrut = ''

    try {
      if (geminiKey) texteBrut = await genererJsonGemini(prompt, geminiKey)
      else if (anthropicKey) texteBrut = await genererJsonAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('IA indisponible pour la strategie:', err)
    }

    const sortieSimulee = genererSortieSimulee({
      meilleurCanal: parCanal[0] ?? null,
      meilleurSegment: parSegment[0] ?? null,
      themePrincipal: parThemeMarketing[0] ?? null,
      postesCibles,
      secteurActivite: clientData?.secteur_activite ?? null,
      tailleEntreprise: clientData?.taille_entreprise ?? 'indifferent',
      motsClesExpertise: clientData?.mots_cles_expertise ?? null,
      ideesRecuesMarche: clientData?.idees_recues_marche ?? null,
      positionnementSite: clientData?.positionnement_site ?? null,
    })

    const parsedIA = texteBrut ? parserSortieIA(texteBrut) : null

    const sortie: SortieStrategie = {
      commercial: parsedIA?.commercial || sortieSimulee.commercial,
      marketing: parsedIA?.marketing || sortieSimulee.marketing,
      filtresRecommandes: parsedIA?.filtresRecommandes || sortieSimulee.filtresRecommandes,
      scriptAppel: parsedIA?.scriptAppel || sortieSimulee.scriptAppel,
      scriptLinkedin: parsedIA?.scriptLinkedin || sortieSimulee.scriptLinkedin,
      guideQualification:
        parsedIA?.guideQualification && parsedIA.guideQualification.length > 0
          ? parsedIA.guideQualification
          : sortieSimulee.guideQualification,
      ligneEditoriale: parsedIA?.ligneEditoriale || sortieSimulee.ligneEditoriale,
      leadMagnets:
        parsedIA?.leadMagnets && parsedIA.leadMagnets.length > 0 ? parsedIA.leadMagnets : sortieSimulee.leadMagnets,
    }

    const { data: historiquePrecedent } = await supabaseAdmin
      .from('strategies_generees')
      .select(
        'id, recommandation_commerciale, recommandation_marketing, script_appel, script_linkedin, ligne_editoriale, created_at'
      )
      .eq('client_id', clientUser.client_id)
      .order('created_at', { ascending: false })
      .limit(10)

    await supabaseAdmin.from('strategies_generees').insert({
      client_id: clientUser.client_id,
      recommandation_commerciale: sortie.commercial,
      recommandation_marketing: sortie.marketing,
      stats_json: { parCanal, parSegment, parThemeMarketing },
      filtres_recommandes: sortie.filtresRecommandes,
      script_appel: sortie.scriptAppel,
      script_linkedin: sortie.scriptLinkedin,
      guide_qualification: sortie.guideQualification,
      ligne_editoriale: sortie.ligneEditoriale,
      lead_magnets: sortie.leadMagnets,
      profil_utilise_json: {
        mode_ciblage: clientData?.mode_ciblage,
        postes_cibles: postesCibles,
        secteur_activite: clientData?.secteur_activite,
        taille_entreprise: clientData?.taille_entreprise,
        portee_geographique: clientData?.portee_geographique,
      },
    })

    return NextResponse.json({
      succes: true,
      recommandationCommerciale: sortie.commercial,
      recommandationMarketing: sortie.marketing,
      parCanal,
      parSegment,
      parThemeMarketing,
      historique: historiquePrecedent ?? [],
      filtresRecommandes: sortie.filtresRecommandes,
      scriptAppel: sortie.scriptAppel,
      scriptLinkedin: sortie.scriptLinkedin,
      guideQualification: sortie.guideQualification,
      ligneEditoriale: sortie.ligneEditoriale,
      leadMagnets: sortie.leadMagnets,
    })
  } catch (err) {
    console.error('Erreur /api/strategie/generer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
