import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'

// Extrait le texte brut d'un fichier uploade (docx/pdf/image/txt) pour
// pre-remplir (en l'ajoutant a la suite) le manuel d'utilisation du chatbot
// support, au lieu d'obliger l'admin a tout retaper a la main.
// Contrairement a l'extraction catalogue, on ne demande pas des champs
// structures : on veut juste une retranscription fidele et complete.

const CONSIGNE = `Retranscris fidelement et integralement tout le texte utile de ce document (instructions, etapes, explications). Ne resume pas, ne reformule pas, n'ajoute aucun commentaire. Reponds UNIQUEMENT avec le texte brut extrait, sans introduction ni conclusion.`

type ContenuAExtraire =
  | { nature: 'document'; base64: string; mediaType: string }
  | { nature: 'image'; base64: string; mediaType: string }

async function extraireAvecAnthropic(contenu: ContenuAExtraire, apiKey: string) {
  const anthropic = new Anthropic({ apiKey })
  const blocContenu =
    contenu.nature === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: contenu.mediaType, data: contenu.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: contenu.mediaType, data: contenu.base64 } }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: [blocContenu, { type: 'text', text: CONSIGNE }] as any }],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : ''
}

async function extraireAvecGemini(contenu: ContenuAExtraire, apiKey: string) {
  const modele = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ inline_data: { mime_type: contenu.mediaType, data: contenu.base64 } }, { text: CONSIGNE }],
          },
        ],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function detecterType(
  mimeType: string | undefined,
  nomFichier: string | undefined
): 'pdf' | 'image' | 'docx' | 'doc' | 'texte' | 'inconnu' {
  const extension = (nomFichier ?? '').toLowerCase().split('.').pop() ?? ''
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf'
  if ((mimeType ?? '').startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return 'image'
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  )
    return 'docx'
  if (mimeType === 'application/msword' || extension === 'doc') return 'doc'
  if (mimeType === 'text/plain' || extension === 'txt' || extension === 'md') return 'texte'
  return 'inconnu'
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
    const fichierBase64: string | undefined = body.fichier_base64
    const mimeType: string | undefined = body.mime_type
    const nomFichier: string | undefined = body.nom_fichier

    if (!fichierBase64) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const type = detecterType(mimeType, nomFichier)

    if (type === 'inconnu') {
      return NextResponse.json(
        { error: 'Format non reconnu. Formats acceptes : Word (.docx), PDF, image ou texte (.txt).' },
        { status: 400 }
      )
    }
    if (type === 'doc') {
      return NextResponse.json(
        { error: "Le format .doc (ancien Word) n'est pas lisible automatiquement. Enregistre en .docx ou en PDF." },
        { status: 400 }
      )
    }

    if (type === 'docx') {
      const buffer = Buffer.from(fichierBase64, 'base64')
      const resultat = await mammoth.extractRawText({ buffer })
      const texte = resultat.value.trim()
      if (!texte) {
        return NextResponse.json({ error: 'Le document Word semble vide.' }, { status: 400 })
      }
      return NextResponse.json({ succes: true, texte: texte.slice(0, 30000) })
    }

    if (type === 'texte') {
      const texte = Buffer.from(fichierBase64, 'base64').toString('utf-8').trim()
      if (!texte) {
        return NextResponse.json({ error: 'Le fichier texte est vide.' }, { status: 400 })
      }
      return NextResponse.json({ succes: true, texte: texte.slice(0, 30000) })
    }

    // PDF ou image : passe par l'IA (Anthropic lit les PDF/images nativement)
    const contenu: ContenuAExtraire =
      type === 'image'
        ? { nature: 'image', base64: fichierBase64, mediaType: mimeType ?? 'image/png' }
        : { nature: 'document', base64: fichierBase64, mediaType: 'application/pdf' }

    const geminiKey = process.env.GEMINI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let texte: string | null = null

    if (geminiKey) {
      try {
        texte = await extraireAvecGemini(contenu, geminiKey)
      } catch (err) {
        console.error('Gemini indisponible pour extraction manuel chatbot:', err)
      }
    }
    if (!texte && anthropicKey) {
      try {
        texte = await extraireAvecAnthropic(contenu, anthropicKey)
      } catch (err) {
        console.error('Anthropic indisponible pour extraction manuel chatbot:', err)
      }
    }
    if (!texte) {
      return NextResponse.json(
        {
          error:
            geminiKey || anthropicKey
              ? 'Le service IA est momentanément indisponible, reessaie dans quelques instants.'
              : "Aucune cle IA configuree (GEMINI_API_KEY ou ANTHROPIC_API_KEY), impossible d'extraire un PDF/image.",
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ succes: true, texte: texte.trim().slice(0, 30000) })
  } catch (err) {
    console.error('Erreur /api/admin/manuel-chatbot/extraire-texte:', err)
    return NextResponse.json({ error: "Erreur lors de l'extraction du fichier" }, { status: 500 })
  }
}
