// Traduction du rapport valide par l'expert (Etape 5) dans la langue choisie
// manuellement par le commercial avant l'envoi au prospect. Le contenu a
// deja ete relu/corrige en francais par l'humain (Etape 4) : on ne traduit
// qu'au moment de l'envoi, jamais avant, pour ne jamais perdre la version
// de reference que l'expert a validee.
//
// Meme ordre de fournisseur que lib/classification.ts et
// app/api/diagnostic/route.ts : Gemini (gratuit) -> Anthropic (payant) ->
// repli = on renvoie le texte francais tel quel (mieux qu'un envoi casse).

export type LangueRapport = 'fr' | 'en' | 'ar'

type ContenuRapport = {
  titre: string
  synthese: string
  etapes: { nom: string; description: string }[]
  commentaire_expert?: string | null
}

const NOM_LANGUE: Record<LangueRapport, string> = {
  fr: 'francais',
  en: 'anglais',
  ar: 'arabe litteraire (fusha), registre professionnel',
}

function construirePromptTraduction(contenu: ContenuRapport, langue: LangueRapport): string {
  return `Traduis ce JSON en ${NOM_LANGUE[langue]}, registre professionnel B2B. Garde EXACTEMENT la meme structure JSON, ne traduis que les valeurs texte, jamais les cles. Ne rajoute aucun commentaire, reponds UNIQUEMENT avec le JSON traduit :\n\n${JSON.stringify(
    contenu
  )}`
}

function extraireJson<T>(texte: string, secours: T): T {
  const match = texte.match(/\{[\s\S]*\}/)
  if (!match) return secours
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return secours
  }
}

async function traduireAvecGemini(
  contenu: ContenuRapport,
  langue: LangueRapport,
  apiKey: string
): Promise<ContenuRapport> {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-3.7-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: construirePromptTraduction(contenu, langue) }] }],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  const texte = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return extraireJson(texte, contenu)
}

async function traduireAvecAnthropic(
  contenu: ContenuRapport,
  langue: LangueRapport,
  apiKey: string
): Promise<ContenuRapport> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: construirePromptTraduction(contenu, langue) }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  const texte = bloc && 'text' in bloc ? bloc.text : ''
  return extraireJson(texte, contenu)
}

// Traduit le rapport si necessaire. Renvoie le contenu tel quel si la langue
// demandee est 'fr' (deja la langue de redaction) ou si aucune IA n'est
// disponible (mieux vaut envoyer en francais que ne rien envoyer).
export async function traduireRapportSiNecessaire(
  contenu: ContenuRapport,
  langue: LangueRapport
): Promise<ContenuRapport> {
  if (langue === 'fr') return contenu

  const geminiKey = process.env.GEMINI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (geminiKey) {
    try {
      return await traduireAvecGemini(contenu, langue, geminiKey)
    } catch (err) {
      console.error('Gemini indisponible pour la traduction, on essaie la suite:', err)
    }
  }

  if (anthropicKey) {
    try {
      return await traduireAvecAnthropic(contenu, langue, anthropicKey)
    } catch (err) {
      console.error('Anthropic indisponible pour la traduction, envoi en francais:', err)
    }
  }

  return contenu
}

// Message court envoye au prospect (WhatsApp/email) pour l'informer que son
// rapport est pret - traduit lui aussi selon la langue choisie.
export function messageNotificationParLangue(params: {
  langue: LangueRapport
  nomProspect: string
  nomCabinet: string
  lien: string
  lienDesinscription: string
}): string {
  const { langue, nomProspect, nomCabinet, lien, lienDesinscription } = params

  if (langue === 'en') {
    return `Hello ${nomProspect},\n\n${nomCabinet} has reviewed your case and prepared a personalized solution:\n${lien}\n\n---\nTo unsubscribe: ${lienDesinscription}`
  }
  if (langue === 'ar') {
    return `مرحبًا ${nomProspect}،\n\nقام ${nomCabinet} بدراسة ملفكم ويقترح عليكم حلاً مخصصاً:\n${lien}\n\n---\nلإلغاء الاشتراك: ${lienDesinscription}`
  }
  return `Bonjour ${nomProspect},\n\n${nomCabinet} a etudie votre dossier et vous propose une solution personnalisee :\n${lien}\n\n---\nPour ne plus recevoir de message : ${lienDesinscription}`
}
