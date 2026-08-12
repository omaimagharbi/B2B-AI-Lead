import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Meme verification admin que le reste de /api/admin/clients
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

function genererMotDePasseTemporaire(): string {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let mdp = ''
  for (let i = 0; i < 10; i++) {
    mdp += caracteres[Math.floor(Math.random() * caracteres.length)]
  }
  return mdp
}

// Cree un nouveau cabinet directement depuis le panel admin (toi), sans que
// le client passe par le formulaire d'inscription public. Reutilise le meme
// trigger SQL (handle_new_client_signup, cas 2) que l'inscription normale :
// pas de client_id dans les metadonnees => un nouveau cabinet est cree.
export async function POST(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  try {
    const { nom_entreprise, email, nom_complet, vertical_slug } = await req.json()

    if (!nom_entreprise?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Nom du cabinet et email requis' }, { status: 400 })
    }

    const motDePasseTemporaire = genererMotDePasseTemporaire()

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: motDePasseTemporaire,
      email_confirm: true,
      user_metadata: {
        nom_entreprise: nom_entreprise.trim(),
        nom_complet: nom_complet?.trim() ?? '',
        vertical_slug: vertical_slug?.trim() || 'cabinet-formation',
        cree_par_admin: true,
      },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ succes: true, email: email.trim(), motDePasseTemporaire })
  } catch (err) {
    console.error('Erreur /api/admin/clients/creer:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
