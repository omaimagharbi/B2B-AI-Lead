import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Recommandation, ContenuMarketing, Segment } from '@/lib/strategie'

function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const LABEL_URGENCE: Record<string, string> = {
  haute: '🟥 Urgent',
  moyenne: '🟨 Modéré',
  basse: '🟩 Planification',
}

const LABEL_PRIORITE: Record<string, string> = {
  haute: '🔴 Priorite haute',
  moyenne: '🟠 Priorite moyenne',
  basse: '⚪ Priorite basse',
}

// Le formulaire prospect (app/diagnostic/[token]/page.tsx) envoie un texte
// structure en 4 lignes ("Défi / objectif : ...", "Depuis quand : ...",
// "Déjà essayé : ...", "Urgence à agir : ..."). On le reparse ici pour
// afficher "Historique & impact" sans redemander ces infos au commercial.
function parserReponseStructuree(texte: string | null) {
  const champs = { defi: '', depuisQuand: '', dejaEssaye: '', urgence: '' }
  if (!texte) return champs
  for (const ligne of texte.split('\n')) {
    if (ligne.startsWith('Défi / objectif :')) champs.defi = ligne.replace('Défi / objectif :', '').trim()
    else if (ligne.startsWith('Depuis quand :')) champs.depuisQuand = ligne.replace('Depuis quand :', '').trim()
    else if (ligne.startsWith('Déjà essayé :')) champs.dejaEssaye = ligne.replace('Déjà essayé :', '').trim()
    else if (ligne.startsWith('Urgence à agir :')) champs.urgence = ligne.replace('Urgence à agir :', '').trim()
  }
  return champs
}

// Rapport interne pour le cabinet (jamais accessible/envoye au prospect) -
// ouvert par le commercial avant son appel. Identifie par le token_acces
// du diagnostic (deja unique et non devinable).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: diagnostic, error } = await supabaseAdmin
    .from('diagnostics')
    .select(
      `id, phrase_brute_prospect, json_ia_brouillon, json_expert_valide, recommandations_json,
       commentaire_expert, created_at,
       clients(nom_entreprise, logo_url),
       targets(nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, segment_categorie, segment_urgence, score_chaleur)`
    )
    .eq('token_acces', params.token)
    .single()

  if (error || !diagnostic) {
    return new NextResponse('Rapport introuvable ou lien invalide.', { status: 404 })
  }

  // @ts-ignore - jointures Supabase typees dynamiquement
  const client = diagnostic.clients as { nom_entreprise: string; logo_url: string | null } | null
  // @ts-ignore - jointures Supabase typees dynamiquement
  const target = diagnostic.targets as {
    nom: string
    entreprise_ou_objectif: string | null
    poste_ou_budget: string | null
    telephone: string | null
    email: string | null
    country: string | null
    segment_categorie: string | null
    segment_urgence: string | null
    score_chaleur: number | null
  } | null

  const reco = diagnostic.recommandations_json as {
    segment: Segment
    score: number
    recommandations: Recommandation[]
    contenuMarketing: ContenuMarketing
    explicationScore?: string
    besoinSousJacent?: string
  } | null

  const brouillon = (diagnostic.json_expert_valide ?? diagnostic.json_ia_brouillon) as {
    titre?: string
    synthese?: string
    methodologie?: string
    etapes?: { nom: string; description: string }[]
    packs_proposes?: { nom: string; prix_indicatif: number; description: string }[]
  } | null

  const score = reco?.score ?? target?.score_chaleur ?? 0
  const couleurScore = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const urgence = reco?.segment.urgence ?? target?.segment_urgence ?? 'moyenne'
  const champs = parserReponseStructuree(diagnostic.phrase_brute_prospect)
  const solutionRecommandee = brouillon?.packs_proposes?.[0] ?? null
  const dateRapport = new Date(diagnostic.created_at ?? Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const dashboardUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/dashboard`

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Plan d'action & diagnostic - ${echapperHtml(target?.nom ?? 'Prospect')}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#0b1120; color:#e2e8f0; margin:0; padding:32px; }
  .conteneur { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .sous-titre { color:#94a3b8; font-size:13px; margin-bottom:24px; }
  .carte { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:20px; margin-bottom:20px; }
  .carte h2 { font-size:15px; text-transform:uppercase; letter-spacing:0.03em; color:#94a3b8; margin:0 0 4px 0; }
  .carte .soustitre-carte { font-size:11px; color:#64748b; margin:0 0 12px 0; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
  .badge { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; background:#1f2937; }
  .score { font-size:32px; font-weight:800; }
  .explication { color:#94a3b8; font-size:12px; font-style:italic; margin-top:6px; }
  .besoin { color:#38bdf8; font-size:14px; font-weight:600; margin-top:10px; }
  .reco { border-left:3px solid #6366f1; padding:8px 12px; margin-bottom:10px; background:#0f172a; border-radius:0 8px 8px 0; }
  .reco-titre { font-weight:700; font-size:14px; }
  .reco-action { color:#cbd5e1; font-size:13px; margin-top:2px; }
  .etape { background:#0f172a; border-radius:8px; padding:10px 14px; margin-bottom:8px; }
  .etape b { font-size:13px; }
  .etape p { color:#94a3b8; font-size:13px; margin:4px 0 0 0; }
  .cta { display:block; text-align:center; background:#6366f1; color:white; text-decoration:none; font-weight:700; padding:14px; border-radius:10px; margin-top:8px; }
  @media print { body { background:white; color:black; } .carte { border:1px solid #ccc; background:white; } .cta { display:none; } }
</style>
</head>
<body>
  <div class="conteneur">
    <div class="badges" style="margin-bottom:10px;">
      <span class="badge">${echapperHtml(LABEL_URGENCE[urgence] ?? urgence)}</span>
    </div>
    <h1>Plan d'Action & Diagnostic de Formation Personnalisé</h1>
    <p class="sous-titre">
      Pour ${echapperHtml(target?.nom ?? 'Prospect')}${target?.poste_ou_budget ? ' — ' + echapperHtml(target.poste_ou_budget) : ''}${target?.entreprise_ou_objectif ? ' — ' + echapperHtml(target.entreprise_ou_objectif) : ''}<br/>
      Pré-analysé par l'IA et validé par ${echapperHtml(client?.nom_entreprise ?? 'votre expert')} · ${echapperHtml(dateRapport)}<br/>
      <span style="color:#64748b;">Usage interne — ne pas transmettre tel quel au prospect</span>
    </p>

    <div class="carte">
      <h2>Score de chaleur du lead</h2>
      <div class="score" style="color:${couleurScore}">${score}/100</div>
      <div class="badges" style="margin-top:10px;">
        ${reco ? `<span class="badge">${echapperHtml(LABEL_URGENCE[reco.segment.urgence] ?? reco.segment.urgence)}</span>` : ''}
        ${reco ? `<span class="badge">Categorie : ${echapperHtml(reco.segment.categorie)}</span>` : ''}
        ${reco?.segment.budget_mentionne ? `<span class="badge">💰 Budget evoque</span>` : ''}
      </div>
      ${reco?.explicationScore ? `<p class="explication">${echapperHtml(reco.explicationScore)}</p>` : ''}
    </div>

    <div class="carte">
      <h2>Analyse de la situation actuelle</h2>
      <p style="font-style:italic; color:#cbd5e1;">"${echapperHtml(champs.defi || diagnostic.phrase_brute_prospect || '')}"</p>
      ${reco?.besoinSousJacent ? `<p class="besoin">${echapperHtml(reco.besoinSousJacent)}</p>` : ''}
      ${
        champs.depuisQuand || champs.dejaEssaye
          ? `<p style="color:#94a3b8;font-size:13px;margin-top:10px;">
              ${champs.depuisQuand ? `Cette situation dure depuis <b>${echapperHtml(champs.depuisQuand)}</b>. ` : ''}
              ${champs.dejaEssaye ? `Déjà tenté : ${echapperHtml(champs.dejaEssaye)}.` : ''}
            </p>`
          : ''
      }
    </div>

    ${
      reco && reco.recommandations.length > 0
        ? `<div class="carte">
      <h2>Recommandations commerciales</h2>
      <p class="soustitre-carte">Guide d'entretien recommandé pour votre appel</p>
      ${reco.recommandations
        .map(
          (r) => `<div class="reco">
        <div class="reco-titre">${echapperHtml(r.titre)} <span style="font-weight:400;font-size:11px;color:#94a3b8;">(${echapperHtml(LABEL_PRIORITE[r.priorite] ?? r.priorite)})</span></div>
        <div class="reco-action">${echapperHtml(r.action)}</div>
        ${
          r.questions && r.questions.length > 0
            ? `<ul style="margin:6px 0 0 18px;padding:0;font-size:13px;color:#94a3b8;">${r.questions
                .map((q) => `<li>${echapperHtml(q)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </div>`
        )
        .join('')}
    </div>`
        : ''
    }

    ${
      reco?.contenuMarketing
        ? `<div class="carte">
      <h2>Stratégie de contenu & attractivité</h2>
      <p class="soustitre-carte">Idée de publication liée à ce profil de prospect</p>
      <p><b>${echapperHtml(reco.contenuMarketing.titre)}</b></p>
      <p style="color:#cbd5e1;font-size:13px;">${echapperHtml(reco.contenuMarketing.accroche_linkedin)}</p>
      <p style="color:#94a3b8;font-size:12px;">Format suggere : ${echapperHtml(reco.contenuMarketing.format_suggere)}</p>
    </div>`
        : ''
    }

    ${
      brouillon
        ? `<div class="carte">
      <h2>Plan d'action pédagogique recommandé</h2>
      <p class="soustitre-carte">Méthodologie ${echapperHtml(brouillon.methodologie ?? '')}</p>
      <p><b>${echapperHtml(brouillon.titre ?? '')}</b></p>
      <p style="color:#cbd5e1;font-size:13px;">${echapperHtml(brouillon.synthese ?? '')}</p>
      ${(brouillon.etapes ?? [])
        .map((e) => `<div class="etape"><b>${echapperHtml(e.nom)}</b><p>${echapperHtml(e.description)}</p></div>`)
        .join('')}
    </div>`
        : ''
    }

    ${
      solutionRecommandee
        ? `<div class="carte">
      <h2>Solution recommandée du catalogue</h2>
      <p><b>📦 ${echapperHtml(solutionRecommandee.nom)}</b>${solutionRecommandee.prix_indicatif ? ` — ${solutionRecommandee.prix_indicatif}` : ''}</p>
      <p style="color:#cbd5e1;font-size:13px;">${echapperHtml(solutionRecommandee.description ?? '')}</p>
    </div>`
        : ''
    }

    ${
      diagnostic.commentaire_expert
        ? `<div class="carte">
      <h2>💬 Commentaire de l'expert</h2>
      <p style="color:#cbd5e1;font-size:13px;font-style:italic;">${echapperHtml(diagnostic.commentaire_expert)}</p>
    </div>`
        : ''
    }

    <a href="${dashboardUrl}" class="cta">👉 Bloquer un créneau d'échange de 15 min</a>
  </div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
