import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Lit un PDF (syllabus/brochure) uploade par le cabinet et en extrait les
// champs du catalogue (nom, description, prix, duree, public cible), pour
// pre-remplir le formulaire au lieu de tout retaper a la main.
async function extraireAvecAnthropic(pdfBase64: string, apiKey: string) {
  const anthropic = new Anthropic({ apiKey })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          {
            type: 'text',
            text: `Ce document est une brochure/syllabus de formation ou de service. Reponds UNIQUEMENT en JSON valide, rien d'autre, avec ce format exact :
{"nom": "...", "description": "... (2-3 phrases max)", "prix": nombre ou null, "duree": "..." ou null, "public_cible": "..." ou null, "thematique": "..." ou null, "format": "inter_entreprise" ou "intra_entreprise" ou null, "mode_delivrance": "presentiel" ou "en_ligne" ou "blended" ou null, "usp": "... (element de differenciation, 1 phrase)" ou null}`,
          },
        ] as any,
      },
    ],
  })
  const bloc = message.content.find((b) => b.type === 'text')
  return bloc && 'text' in bloc ? bloc.text : '{}'
}

async function extraireAvecGemini(pdfBase64: string, apiKey: string) {
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
              { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
              {
                text: `Ce document est une brochure/syllabus de formation ou de service. Reponds UNIQUEMENT en JSON valide, rien d'autre, avec ce format exact :
{"nom": "...", "description": "... (2-3 phrases max)", "prix": nombre ou null, "duree": "..." ou null, "public_cible": "..." ou null, "thematique": "..." ou null, "format": "inter_entreprise" ou "intra_entreprise" ou null, "mode_delivrance": "presentiel" ou "en_ligne" ou "blended" ou null, "usp": "... (element de differenciation, 1 phrase)" ou null}`,
              },
            ],
          },
        ],
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini a repondu ${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
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

    const { pdf_base64 } = await req.json()
    if (!pdf_base64) {
      return NextResponse.json({ error: 'PDF manquant' }, { status: 400 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    let texteBrut: string | null = null

    if (geminiKey) {
      try {
        texteBrut = await extraireAvecGemini(pdf_base64, geminiKey)
      } catch (err) {
        console.error('Gemini indisponible pour extraction PDF, on essaie la suite:', err)
      }
    }

    if (texteBrut === null && anthropicKey) {
      try {
        texteBrut = await extraireAvecAnthropic(pdf_base64, anthropicKey)
      } catch (err) {
        console.error('Anthropic indisponible pour extraction PDF:', err)
      }
    }

    if (texteBrut === null) {
      return NextResponse.json(
        {
          error: geminiKey || anthropicKey
            ? "Le service IA est momentanément indisponible, reessaie dans quelques instants"
            : "Aucune cle IA configuree (GEMINI_API_KEY ou ANTHROPIC_API_KEY), impossible d'extraire",
        },
        { status: 500 }
      )
    }

    const nettoye = texteBrut.replace(/```json|```/g, '').trim()
    const champs = JSON.parse(nettoye)

    return NextResponse.json({ succes: true, champs })
  } catch (err) {
    console.error('Erreur /api/catalogue/extraire-pdf:', err)
    return NextResponse.json({ error: "Erreur lors de l'extraction du PDF" }, { status: 500 })
  }
}
