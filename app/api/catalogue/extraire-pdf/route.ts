import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'

// Lit un document catalogue (brochure/syllabus) uploade par le cabinet et en
// extrait les champs (nom, description, prix, duree, public cible), pour
// pre-remplir le formulaire au lieu de tout retaper a la main.
// Formats supportes : PDF, images (photo de brochure), Word (.docx), texte brut.

const CONSIGNE_EXTRACTION = `Ce document est une brochure/catalogue de formations ou de services. Il peut contenir UNE SEULE offre ou PLUSIEURS offres distinctes (catalogue complet). Repere chaque offre distincte et renvoie UNIQUEMENT du JSON valide, rien d'autre, avec ce format exact :
{"offres": [{"nom": "...", "description": "... (2-3 phrases max)", "prix": nombre ou null, "duree": "..." ou null, "public_cible": "..." ou null, "thematique": "..." ou null, "format": "inter_entreprise" ou "intra_entreprise" ou null, "mode_delivrance": "presentiel" ou "en_ligne" ou "blended" ou null, "usp": "... (element de differenciation, 1 phrase)" ou null}, ...]}
S'il n'y a qu'une seule offre dans le document, renvoie quand meme un tableau "offres" avec un seul element.`

type ContenuAExtraire =
  | { nature: 'document'; base64: string; mediaType: string }
  | { nature: 'image'; base64: string; mediaType: string }
  | { nature: 'texte'; texte: string }

async function extraireAvecAnthropic(contenu: ContenuAExtraire, apiKey: string) {
  const anthropic = new Anthropic({ apiKey })

  const blocContenu =
    contenu.nature === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: contenu.mediaType, data: contenu.base64 } }
      : contenu.nature === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: contenu.mediaType, data: contenu.base64 } }
      : { type: 'text', text: `Voici le contenu du document :\n\n${contenu.texte}` }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [blocContenu, { type: 'text', text: CONSIGNE_EXTRACTION }] as any,
      },
    ],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : '{}'
}

async function extraireAvecGemini(contenu: ContenuAExtraire, apiKey: string) {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-3.7-flash'

  const partieContenu =
    contenu.nature === 'texte'
      ? { text: `Voici le contenu du document :\n\n${contenu.texte}` }
      : { inline_data: { mime_type: contenu.mediaType, data: contenu.base64 } }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [partieContenu, { text: CONSIGNE_EXTRACTION }],
          },
        ],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
}

// Determine la nature du fichier (document/image/texte) a partir du mime type
// et, a defaut, de l'extension du nom de fichier.
function detecterContenu(
  fichierBase64: string,
  mimeType: string | undefined,
  nomFichier: string | undefined
): { type: 'pdf' | 'image' | 'docx' | 'doc' | 'texte' | 'inconnu'; mediaType: string } {
  const extension = (nomFichier ?? '').toLowerCase().split('.').pop() ?? ''

  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { type: 'pdf', mediaType: 'application/pdf' }
  }
  if ((mimeType ?? '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    const mediaType =
      mimeType && mimeType.startsWith('image/')
        ? mimeType
        : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
        ? 'image/webp'
        : extension === 'gif'
        ? 'image/gif'
        : 'image/jpeg'
    return { type: 'image', mediaType }
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return { type: 'docx', mediaType: mimeType ?? '' }
  }
  if (mimeType === 'application/msword' || extension === 'doc') {
    return { type: 'doc', mediaType: mimeType ?? '' }
  }
  if (mimeType === 'text/plain' || extension === 'txt' || extension === 'md') {
    return { type: 'texte', mediaType: 'text/plain' }
  }
  return { type: 'inconnu', mediaType: mimeType ?? '' }
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

    const body = await req.json()
    // Compatibilite avec l'ancien champ pdf_base64 (avant le support multi-format).
    const fichierBase64: string | undefined = body.fichier_base64 ?? body.pdf_base64
    const mimeType: string | undefined = body.mime_type
    const nomFichier: string | undefined = body.nom_fichier

    if (!fichierBase64) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const detection = detecterContenu(fichierBase64, mimeType, nomFichier)

    if (detection.type === 'inconnu') {
      return NextResponse.json(
        {
          error:
            "Format non reconnu. Formats acceptes : PDF, Word (.docx), image (png/jpg/webp) ou texte (.txt).",
        },
        { status: 400 }
      )
    }

    if (detection.type === 'doc') {
      return NextResponse.json(
        {
          error:
            "Le format .doc (ancien Word) n'est pas lisible automatiquement. Enregistre le fichier en .docx ou en PDF puis reessaie.",
        },
        { status: 400 }
      )
    }

    let contenu: ContenuAExtraire

    if (detection.type === 'docx') {
      try {
        const buffer = Buffer.from(fichierBase64, 'base64')
        const resultat = await mammoth.extractRawText({ buffer })
        const texte = resultat.value.trim()
        if (!texte) {
          return NextResponse.json(
            { error: 'Le document Word semble vide ou ne contient pas de texte lisible.' },
            { status: 400 }
          )
        }
        contenu = { nature: 'texte', texte: texte.slice(0, 15000) }
      } catch (err) {
        console.error('Erreur extraction .docx:', err)
        return NextResponse.json(
          { error: "Impossible de lire ce fichier Word. Verifie qu'il n'est pas corrompu." },
          { status: 400 }
        )
      }
    } else if (detection.type === 'texte') {
      const texte = Buffer.from(fichierBase64, 'base64').toString('utf-8').trim()
      if (!texte) {
        return NextResponse.json({ error: 'Le fichier texte est vide.' }, { status: 400 })
      }
      contenu = { nature: 'texte', texte: texte.slice(0, 15000) }
    } else if (detection.type === 'image') {
      contenu = { nature: 'image', base64: fichierBase64, mediaType: detection.mediaType }
    } else {
      contenu = { nature: 'document', base64: fichierBase64, mediaType: detection.mediaType }
    }

    const geminiKey = process.env.GEMINI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let texteBrut: string | null = null

    if (geminiKey) {
      try {
        texteBrut = await extraireAvecGemini(contenu, geminiKey)
      } catch (err) {
        console.error('Gemini indisponible pour extraction catalogue, on essaie la suite:', err)
      }
    }

    if (texteBrut === null && anthropicKey) {
      try {
        texteBrut = await extraireAvecAnthropic(contenu, anthropicKey)
      } catch (err) {
        console.error('Anthropic indisponible pour extraction catalogue:', err)
      }
    }

    if (texteBrut === null) {
      return NextResponse.json(
        {
          error:
            geminiKey || anthropicKey
              ? "Le service IA est momentanément indisponible, reessaie dans quelques instants"
              : "Aucune cle IA configuree (GEMINI_API_KEY ou ANTHROPIC_API_KEY), impossible d'extraire",
        },
        { status: 500 }
      )
    }

    const nettoye = texteBrut.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(nettoye)
    // Compatibilite : si jamais l'IA renvoie l'ancien format (un seul objet
    // plat au lieu de {offres: [...]}), on le normalise quand meme.
    const offres = Array.isArray(parsed.offres) ? parsed.offres : parsed.nom ? [parsed] : []

    return NextResponse.json({ succes: true, offres })
  } catch (err) {
    console.error('Erreur /api/catalogue/extraire-pdf:', err)
    return NextResponse.json({ error: "Erreur lors de l'extraction du fichier" }, { status: 500 })
  }
}
