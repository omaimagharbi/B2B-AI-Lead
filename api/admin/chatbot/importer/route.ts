import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

// Retour terrain (doc changement_plateforme) : le manuel du chatbot doit
// pouvoir etre fourni comme un document telecharge (Word ou PDF), pas
// retape a la main dans la zone de texte. On extrait le texte du fichier
// importe et on le renvoie pour relecture/edition avant sauvegarde (meme
// logique que /api/catalogue/extraire-pdf : on n'ecrase rien tant que
// l'admin n'a pas clique sur "Enregistrer le manuel").
// - .docx / .txt / .md : extraction locale (mammoth / lecture directe).
// - .pdf : pas de parseur local fiable dans ce projet -> on demande a
//   l'IA (Anthropic, avec Gemini en secours) de transcrire le texte brut
//   du document, sans reformulation ni resume.

const CONSIGNE_TRANSCRIPTION = `Ce document est un manuel d'utilisation interne. Transcris INTEGRALEMENT son contenu textuel, sans le resumer, sans commentaire ni introduction de ta part. Reponds UNIQUEMENT avec le texte transcrit (tu peux garder une structure simple par lignes/paragraphes).`

async function estAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, anonKey)

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return false

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return adminEmails.includes(data.user.email)
}

async function transcrireAvecAnthropic(base64: string, apiKey: string) {
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: CONSIGNE_TRANSCRIPTION },
        ] as any,
      },
    ],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text.trim() : ''
}

async function transcrireAvecGemini(base64: string, apiKey: string) {
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
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64 } },
              { text: CONSIGNE_TRANSCRIPTION },
            ],
          },
        ],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
}

export async function POST(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  try {
    const { fichier_base64: fichierBase64, mime_type: mimeType, nom_fichier: nomFichier } = await req.json()

    if (!fichierBase64) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    }

    const extension = (nomFichier ?? '').toLowerCase().split('.').pop() ?? ''
    const estDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === 'docx'
    const estDoc = mimeType === 'application/msword' || extension === 'doc'
    const estTexte = mimeType === 'text/plain' || extension === 'txt' || extension === 'md'
    const estPdf = mimeType === 'application/pdf' || extension === 'pdf'

    if (estDoc) {
      return NextResponse.json(
        {
          error:
            "Le format .doc (ancien Word) n'est pas lisible automatiquement. Enregistre le fichier en .docx, .pdf ou .txt puis reessaie.",
        },
        { status: 400 }
      )
    }

    let texte = ''

    if (estDocx) {
      try {
        const buffer = Buffer.from(fichierBase64, 'base64')
        const resultat = await mammoth.extractRawText({ buffer })
        texte = resultat.value.trim()
      } catch (err) {
        console.error('Erreur extraction .docx manuel chatbot:', err)
        return NextResponse.json(
          { error: "Impossible de lire ce fichier Word. Verifie qu'il n'est pas corrompu." },
          { status: 400 }
        )
      }
    } else if (estTexte) {
      texte = Buffer.from(fichierBase64, 'base64').toString('utf-8').trim()
    } else if (estPdf) {
      const geminiKey = process.env.GEMINI_API_KEY
      const anthropicKey = process.env.ANTHROPIC_API_KEY
      let texteBrut: string | null = null

      if (geminiKey) {
        try {
          texteBrut = await transcrireAvecGemini(fichierBase64, geminiKey)
        } catch (err) {
          console.error('Gemini indisponible pour transcription manuel PDF, on essaie la suite:', err)
        }
      }
      if (!texteBrut && anthropicKey) {
        try {
          texteBrut = await transcrireAvecAnthropic(fichierBase64, anthropicKey)
        } catch (err) {
          console.error('Anthropic indisponible pour transcription manuel PDF:', err)
        }
      }
      if (!texteBrut) {
        return NextResponse.json(
          {
            error:
              geminiKey || anthropicKey
                ? 'Le service IA est momentanément indisponible pour lire ce PDF, réessaie dans quelques instants.'
                : "Aucune clé IA configurée (GEMINI_API_KEY ou ANTHROPIC_API_KEY), impossible de lire un PDF. Utilise un fichier .docx ou .txt en attendant.",
          },
          { status: 500 }
        )
      }
      texte = texteBrut
    } else {
      return NextResponse.json(
        { error: 'Format non reconnu. Formats acceptés : Word (.docx), PDF (.pdf) ou texte (.txt).' },
        { status: 400 }
      )
    }

    if (!texte) {
      return NextResponse.json(
        { error: 'Le document semble vide ou ne contient pas de texte lisible.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ succes: true, texte })
  } catch (err) {
    console.error('Erreur /api/admin/chatbot/importer:', err)
    return NextResponse.json({ error: "Erreur lors de l'import du fichier" }, { status: 500 })
  }
}
