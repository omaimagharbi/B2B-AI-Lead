import Anthropic from '@anthropic-ai/sdk'
import { genererSignalIA as genererSignalTemplate } from '@/lib/classification'

// Genere le "💡 Signal détecté : ..." affiché sous le nom du prospect sur sa
// carte, a partir d'un vrai contexte externe (bio/activite recente
// LinkedIn, posts Facebook...) plutot que de simplement recomposer les
// champs deja connus (poste/entreprise). Meme precaution "timeout" que les
// autres appels IA de la plateforme (voir app/api/diagnostic/route.ts) :
// un appel qui traine ne doit jamais faire echouer tout le sourcing.
const TIMEOUT_IA_MS = 12_000

const CONSIGNE = `Tu aides un cabinet de formation/conseil a reperer un besoin potentiel chez un prospect, a partir d'un extrait de son profil professionnel ou de son activite sur les reseaux sociaux.

Écris UNE SEULE phrase courte (max 20 mots), au format exact :
"💡 Signal détecté : <fait observé> → <besoin potentiel>."
(pour un particulier, uniquement le fait observé, sans flèche ni besoin professionnel)

Règles strictes :
- Base-toi UNIQUEMENT sur les faits presents dans l'extrait fourni, n'invente jamais un fait qui n'y figure pas.
- Si l'extrait ne contient aucun signal exploitable (pas d'info sur une embauche, un projet, une activité récente pertinente), réponds exactement: AUCUN_SIGNAL
- Reste factuel et concis, pas de superlatifs ni de ton commercial appuyé.`

async function appellerGemini(prompt: string, apiKey: string): Promise<string> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_IA_MS)
  let res: Response
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: CONSIGNE }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        signal: controleur.signal,
      }
    )
  } finally {
    clearTimeout(minuteur)
  }
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
}

async function appellerAnthropic(prompt: string, apiKey: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey, timeout: TIMEOUT_IA_MS })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 100,
    system: CONSIGNE,
    messages: [{ role: 'user', content: prompt }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return (bloc && 'text' in bloc ? bloc.text : '').trim()
}

/**
 * Genere un signal a partir du contexte brut scrape (bio, activite recente,
 * posts). Retombe sur la version "template" (recomposition de champs deja
 * connus, sans IA) si aucun contexte brut n'est disponible ou si les deux
 * fournisseurs IA echouent - jamais de blocage du sourcing pour ca.
 */
export async function genererSignalDepuisContexte(params: {
  contexteBrut: string | null
  poste: string | null
  entreprise: string | null
  modeCiblage: 'entreprise' | 'particulier'
  segmentCategorie: string | null
  segmentUrgence: string | null
}): Promise<string | null> {
  const { contexteBrut, poste, entreprise, modeCiblage, segmentCategorie, segmentUrgence } = params

  const repli = () =>
    genererSignalTemplate({ poste, entreprise, segmentCategorie, segmentUrgence })

  if (!contexteBrut || !contexteBrut.trim()) return repli()

  const prompt = `Mode de ciblage : ${modeCiblage === 'particulier' ? 'particulier (formation individuelle)' : 'entreprise (poste : ' + (poste ?? 'inconnu') + (entreprise ? `, entreprise : ${entreprise}` : '') + ')'}
Extrait du profil / de l'activité récente :
"""
${contexteBrut.slice(0, 1500)}
"""`

  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  let resultat: string | null = null
  if (geminiKey) {
    try {
      resultat = await appellerGemini(prompt, geminiKey)
    } catch (err) {
      console.error('Signal IA - Gemini indisponible, on essaie Anthropic:', err)
    }
  }
  if (!resultat && anthropicKey) {
    try {
      resultat = await appellerAnthropic(prompt, anthropicKey)
    } catch (err) {
      console.error('Signal IA - Anthropic indisponible:', err)
    }
  }

  if (!resultat || resultat.includes('AUCUN_SIGNAL')) return repli()
  return resultat
}
