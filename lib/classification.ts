// Classification du sentiment d'une reponse de prospect (WhatsApp/Email) :
// 'positive' -> declenche l'envoi du diagnostic complet par le commercial
// 'negative' -> le prospect decline, on n'insiste pas
// 'neutre'   -> reponse recue mais pas assez claire pour trancher automatiquement
//
// Meme ordre d'essai que app/api/diagnostic/route.ts : Gemini (gratuit) ->
// Anthropic (payant, meilleure qualite) -> repli par mots-cles (toujours
// disponible, aucune cle requise).

export type SentimentReponse = 'positive' | 'negative' | 'neutre'

const SYSTEM_PROMPT = `Tu analyses la reponse d'un prospect B2B a un premier message commercial court.
Ta seule tache : classer son intention en un seul mot parmi "positive", "negative", "neutre".

- "positive" : le prospect accepte, montre de l'interet, demande plus d'infos, dit oui, demande un rendez-vous.
- "negative" : le prospect refuse, dit ne pas etre interesse, demande d'arreter de le contacter.
- "neutre" : la reponse est ambigue, hors-sujet, ou ne permet pas de trancher.

Reponds UNIQUEMENT avec le mot exact ("positive", "negative" ou "neutre"), sans ponctuation, sans explication.`

function classifierParMotsCles(texte: string): SentimentReponse {
  const t = texte.toLowerCase()

  const motsNegatifs = [
    'pas interesse',
    "pas intéressé",
    'non merci',
    'stop',
    'desabonner',
    'désabonner',
    'ne plus',
    'jamais',
    'pas besoin',
  ]
  if (motsNegatifs.some((m) => t.includes(m))) return 'negative'

  const motsPositifs = [
    'oui',
    'interesse',
    'intéressé',
    "d'accord",
    'daccord',
    'ok pour',
    'envoyez',
    'envoyer',
    'rdv',
    'rendez-vous',
    'rendez vous',
    'quand',
    'appelez',
    'appeler',
    'volontiers',
    'avec plaisir',
  ]
  if (motsPositifs.some((m) => t.includes(m))) return 'positive'

  return 'neutre'
}

async function classifierGemini(texte: string, apiKey: string): Promise<SentimentReponse> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-3.7-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: texte }] }],
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)

  const data = await res.json()
  const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim().toLowerCase()
  if (rawText.includes('positive')) return 'positive'
  if (rawText.includes('negative')) return 'negative'
  return 'neutre'
}

async function classifierAnthropic(texte: string, apiKey: string): Promise<SentimentReponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 10,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: texte }],
  })

  const textBlock = message.content.find((block) => block.type === 'text')
  const rawText = (textBlock && 'text' in textBlock ? textBlock.text : '').trim().toLowerCase()
  if (rawText.includes('positive')) return 'positive'
  if (rawText.includes('negative')) return 'negative'
  return 'neutre'
}

export async function classifierReponse(texte: string): Promise<SentimentReponse> {
  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (geminiKey) {
    try {
      return await classifierGemini(texte, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible pour classification, on essaie la suite:', err)
    }
  }

  if (anthropicKey) {
    try {
      return await classifierAnthropic(texte, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible pour classification, repli mots-cles:', err)
    }
  }

  return classifierParMotsCles(texte)
}

// Genere une phrase courte "signal detecte" affichee sous le nom du prospect,
// a partir des seules donnees deja disponibles (pas d'appel IA : regles simples,
// donc gratuit et instantane, coherent avec le moteur de segmentation de
// lib/strategie.ts qui suit la meme philosophie "regles, pas d'IA generative").
export function genererSignalIA(params: {
  poste: string | null
  entreprise: string | null
  segmentCategorie: string | null
  segmentUrgence: string | null
}): string | null {
  const { poste, entreprise, segmentCategorie, segmentUrgence } = params

  if (!segmentCategorie && !poste) return null

  const cible = poste ? `${poste}${entreprise ? ` chez ${entreprise}` : ''}` : entreprise

  if (segmentUrgence === 'haute') {
    return `💡 Signal détecté : besoin urgent exprimé${cible ? ` — ${cible}` : ''}.`
  }
  if (segmentCategorie) {
    return `💡 Signal détecté : profil ${segmentCategorie}${cible ? ` — ${cible}` : ''}.`
  }
  return cible ? `💡 Signal détecté : ${cible}.` : null
}
