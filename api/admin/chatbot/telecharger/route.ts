import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Retour terrain (doc changement_plateforme) : le manuel doit pouvoir etre
// telecharge comme document Word (pour l'editer hors-ligne dans les mêmes
// conditions que les autres supports de formation PiloBrain), pas seulement
// visible dans une zone de texte du dashboard.

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

export async function GET(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { data } = await supabaseAdmin.from('chatbot_config').select('manuel_utilisation').eq('id', 1).single()
  const manuel = data?.manuel_utilisation ?? ''

  const paragraphes = (manuel.length ? manuel.split('\n') : ['']).map(
    (ligne: string) => new Paragraph({ children: [new TextRun(ligne)] })
  )

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: "Manuel d'utilisation — Chatbot support", bold: true, size: 28 })] }),
          new Paragraph({ children: [] }),
          ...paragraphes,
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="manuel-chatbot-support.docx"',
    },
  })
}
