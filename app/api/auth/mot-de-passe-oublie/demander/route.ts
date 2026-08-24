import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { envoyerEmail } from '@/lib/notifications'

function genererCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)) // 6 chiffres
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }
    const emailNormalise = String(email).trim().toLowerCase()

    // On verifie que le compte existe, mais la reponse est la meme dans les
    // deux cas (existe ou pas) pour ne pas laisser deviner quels emails ont
    // un compte (enumeration).
    let page = 1
    let existe = false
    while (!existe) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) break
      if (data.users.some((u) => (u.email ?? '').toLowerCase() === emailNormalise)) existe = true
      if (data.users.length < 1000) break
      page += 1
    }

    if (existe) {
      const code = genererCode()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

      await supabaseAdmin.from('reinitialisations_mdp').insert({
        email: emailNormalise,
        code,
        expires_at: expiresAt,
      })

      try {
        await envoyerEmail(
          emailNormalise,
          `Bonjour,\n\nVoici votre code de vérification pour réinitialiser votre mot de passe : ${code}\n\n` +
            `Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
          null,
          'Code de vérification — réinitialisation de mot de passe'
        )
      } catch (err) {
        console.error('Envoi du code de reset impossible:', err)
        return NextResponse.json(
          { error: "L'envoi de l'email a échoué. Réessaie dans un instant ou contacte le support." },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      succes: true,
      message: 'Si ce compte existe, un code a été envoyé par email.',
    })
  } catch (err) {
    console.error('Erreur /api/auth/mot-de-passe-oublie/demander:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
