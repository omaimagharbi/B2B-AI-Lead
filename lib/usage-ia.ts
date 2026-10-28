import { supabaseAdmin } from '@/lib/supabase-admin'

// Tarifs approximatifs (USD pour 1 million de tokens), a ajuster si les
// grilles tarifaires des fournisseurs changent. Sources : pages tarifs
// publiques Anthropic (Claude Sonnet) et Google (Gemini Flash) au moment
// de l'ecriture - ce sont des ESTIMATIONS pour piloter la marge, pas des
// factures exactes.
const TARIFS_USD_PAR_MILLION_TOKENS = {
  anthropic: { entree: 3, sortie: 15 },
  gemini: { entree: 0, sortie: 0 }, // palier gratuit utilise en priorite dans ce projet
} as const

export function estimerCoutUsd(
  fournisseur: 'anthropic' | 'gemini',
  tokensEntree: number,
  tokensSortie: number
): number {
  const tarif = TARIFS_USD_PAR_MILLION_TOKENS[fournisseur]
  const cout =
    (tokensEntree / 1_000_000) * tarif.entree + (tokensSortie / 1_000_000) * tarif.sortie
  return Math.round(cout * 100000) / 100000
}

// Enregistre la consommation reelle d'un appel IA pour un client. Best-effort,
// ne doit jamais faire echouer le flux principal (generation de diagnostic).
export async function enregistrerUsageIA(params: {
  clientId: string | null
  fournisseur: 'anthropic' | 'gemini'
  tokensEntree: number
  tokensSortie: number
  source?: string // ex. 'immo' : permet de compter l'usage par fonctionnalite (colonne ajoutee par la migration 72)
}) {
  const { clientId, fournisseur, tokensEntree, tokensSortie, source } = params
  try {
    const ligne = {
      client_id: clientId,
      fournisseur,
      tokens_entree: tokensEntree,
      tokens_sortie: tokensSortie,
      cout_estime_usd: estimerCoutUsd(fournisseur, tokensEntree, tokensSortie),
    }
    const payload: Record<string, unknown> = source ? { ...ligne, source } : ligne
    const { error } = await supabaseAdmin.from('usage_ia').insert(payload)
    // Colonne source absente (migration 72 pas faite) : on enregistre quand meme la consommation
    if (error && source) await supabaseAdmin.from('usage_ia').insert(ligne)
  } catch (err) {
    console.error('Erreur enregistrement usage IA (non bloquant):', err)
  }
}
