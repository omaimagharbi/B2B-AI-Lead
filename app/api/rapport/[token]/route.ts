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
  haute: '🔴 Urgence haute',
  moyenne: '🟠 Urgence moyenne',
  basse: '🟢 Urgence basse',
}

const LABEL_PRIORITE: Record<string, string> = {
  haute: '🔴 Priorite haute',
  moyenne: '🟠 Priorite moyenne',
  basse: '⚪ Priorite basse',
}

// Rapport interne pour le cabinet (jamais accessible/envoye au prospect).
// Identifie par le token_acces du diagnostic (deja unique et non devinable).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: diagnostic, error } = await supabaseAdmin
    .from('diagnostics')
    .select(
      `id, phrase_brute_prospect, json_ia_brouillon, json_expert_valide, recommandations_json,
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

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Rapport - ${echapperHtml(target?.nom ?? 'Prospect')}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#0b1120; color:#e2e8f0; margin:0; padding:32px; }
  .conteneur { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sous-titre { color:#94a3b8; font-size:13px; margin-bottom:24px; }
  .carte { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:20px; margin-bottom:20px; }
  .carte h2 { font-size:15px; text-transform:uppercase; letter-spacing:0.03em; color:#94a3b8; margin:0 0 12px 0; }
  .badges { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
  .badge { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; background:#1f2937; }
  .score { font-size:32px; font-weight:800; }
  .reco { border-left:3px solid #6366f1; padding:8px 12px; margin-bottom:10px; background:#0f172a; border-radius:0 8px 8px 0; }
  .reco-titre { font-weight:700; font-size:14px; }
  .reco-action { color:#cbd5e1; font-size:13px; margin-top:2px; }
  .etape { background:#0f172a; border-radius:8px; padding:10px 14px; margin-bottom:8px; }
  .etape b { font-size:13px; }
  .etape p { color:#94a3b8; font-size:13px; margin:4px 0 0 0; }
  @media print { body { background:white; color:black; } .carte { border:1px solid #ccc; background:white; } }
</style>
</head>
<body>
  <div class="conteneur">
    <h1>Rapport prospect — ${echapperHtml(target?.nom ?? 'Prospect')}</h1>
    <p class="sous-titre">${echapperHtml(client?.nom_entreprise ?? '')} · usage interne, ne pas transmettre au prospect</p>

    <div class="carte">
      <h2>Prospect</h2>
      <p><b>${echapperHtml(target?.nom ?? '-')}</b> — ${echapperHtml(target?.entreprise_ou_objectif ?? '-')}</p>
      <p style="color:#94a3b8;font-size:13px;">${echapperHtml(target?.poste_ou_budget ?? '')}${target?.country ? ' · ' + echapperHtml(target.country) : ''}</p>
      <p style="color:#94a3b8;font-size:13px;">${target?.telephone ? '📞 ' + echapperHtml(target.telephone) : ''} ${target?.email ? '✉️ ' + echapperHtml(target.email) : ''}</p>
    </div>

    <div class="carte">
      <h2>Score de chaleur du lead</h2>
      <div class="score" style="color:${couleurScore}">${score}/100</div>
      <div class="badges" style="margin-top:10px;">
        ${reco ? `<span class="badge">${echapperHtml(LABEL_URGENCE[reco.segment.urgence] ?? reco.segment.urgence)}</span>` : ''}
        ${reco ? `<span class="badge">Categorie : ${echapperHtml(reco.segment.categorie)}</span>` : ''}
        ${reco?.segment.budget_mentionne ? `<span class="badge">💰 Budget evoque</span>` : ''}
      </div>
    </div>

    <div class="carte">
      <h2>Ce que le prospect a decrit</h2>
      <p style="font-style:italic; color:#cbd5e1;">"${echapperHtml(diagnostic.phrase_brute_prospect ?? '')}"</p>
    </div>

    ${
      reco && reco.recommandations.length > 0
        ? `<div class="carte">
      <h2>Recommandations commerciales (regles, sans IA generative)</h2>
      ${reco.recommandations
        .map(
          (r) => `<div class="reco">
        <div class="reco-titre">${echapperHtml(r.titre)} <span style="font-weight:400;font-size:11px;color:#94a3b8;">(${echapperHtml(LABEL_PRIORITE[r.priorite] ?? r.priorite)})</span></div>
        <div class="reco-action">${echapperHtml(r.action)}</div>
      </div>`
        )
        .join('')}
    </div>`
        : ''
    }

    ${
      reco?.contenuMarketing
        ? `<div class="carte">
      <h2>Contenu marketing suggere (pont commercial ↔ marketing)</h2>
      <p><b>${echapperHtml(reco.contenuMarketing.titre)}</b></p>
      <p style="color:#cbd5e1;font-size:13px;">${echapperHtml(reco.contenuMarketing.accroche_linkedin)}</p>
      <p style="color:#94a3b8;font-size:12px;">Format suggere : ${echapperHtml(reco.contenuMarketing.format_suggere)}</p>
    </div>`
        : ''
    }

    ${
      brouillon
        ? `<div class="carte">
      <h2>Diagnostic (${echapperHtml(brouillon.methodologie ?? '')})</h2>
      <p><b>${echapperHtml(brouillon.titre ?? '')}</b></p>
      <p style="color:#cbd5e1;font-size:13px;">${echapperHtml(brouillon.synthese ?? '')}</p>
      ${(brouillon.etapes ?? [])
        .map((e) => `<div class="etape"><b>${echapperHtml(e.nom)}</b><p>${echapperHtml(e.description)}</p></div>`)
        .join('')}
    </div>`
        : ''
    }

    ${
      brouillon?.packs_proposes && brouillon.packs_proposes.length > 0
        ? `<div class="carte">
      <h2>Packs proposes</h2>
      ${brouillon.packs_proposes
        .map(
          (p) =>
            `<div class="etape"><b>${echapperHtml(p.nom)}</b> — ${p.prix_indicatif} <p>${echapperHtml(p.description)}</p></div>`
        )
        .join('')}
    </div>`
        : ''
    }
  </div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
