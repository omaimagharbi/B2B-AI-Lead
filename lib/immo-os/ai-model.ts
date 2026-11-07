// Nom du modele IA utilise par le Real Estate OS. Aucune cle ici : les cles restent dans les variables d'environnement.
// Claude : variable IMMO_CLAUDE_MODEL (sinon valeur par defaut ci-dessous). Gemini : GEMINI_MODEL.
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5'
export const FALLBACK_CLAUDE_MODEL = 'claude-sonnet-5' // essaye une fois si le modele configure est refuse (404)
export const claudeModel = (): string => (process.env.IMMO_CLAUDE_MODEL ?? '').trim() || DEFAULT_CLAUDE_MODEL
export const geminiModel = (): string => (process.env.GEMINI_MODEL ?? '').trim() || 'gemini-2.5-flash'

// Fournisseur qui repondra en premier (meme ordre que l'assistant : Gemini puis Claude).
export function activeAi(): { provider: 'gemini' | 'anthropic' | 'none'; model: string | null } {
  if (process.env.GEMINI_API_KEY) return { provider: 'gemini', model: geminiModel() }
  if (process.env.ANTHROPIC_API_KEY) return { provider: 'anthropic', model: claudeModel() }
  return { provider: 'none', model: null }
}
