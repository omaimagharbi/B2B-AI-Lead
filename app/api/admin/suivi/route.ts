import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function estAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user?.email) return false

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim())
  return adminEmails.includes(data.user.email)
}

// GET /api/admin/suivi?email=testeur@exemple.com
// Historique des connexions d'un utilisateur : date d'entree, temps actif,
// pages visitees. On ne donne que l'adresse email.
export async function GET(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
  }

  const { data: sessions, error } = await supabaseAdmin
    .from('suivi_sessions')
    .select('id, debut, derniere_activite, duree_secondes, pages, appareil')
    .eq('email', email)
    .order('debut', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json(
      { error: "Erreur de chargement (la migration 70_suivi_connexions.sql est-elle executee ?)" },
      { status: 500 }
    )
  }

  const liste = sessions ?? []
  const dureeTotale = liste.reduce((s, x) => s + (x.duree_secondes ?? 0), 0)

  // Infos de compte cote Supabase Auth : utile pour les connexions
  // anterieures a l'activation du suivi (derniere connexion connue).
  let compte: { existe: boolean; cree_le: string | null; derniere_connexion: string | null } = {
    existe: false,
    cree_le: null,
    derniere_connexion: null,
  }
  try {
    for (let page = 1; page <= 10; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
      const users = data?.users ?? []
      const trouve = users.find((u) => u.email?.toLowerCase() === email)
      if (trouve) {
        compte = {
          existe: true,
          cree_le: trouve.created_at ?? null,
          derniere_connexion: trouve.last_sign_in_at ?? null,
        }
        break
      }
      if (users.length < 1000) break
    }
  } catch {
    // non bloquant
  }

  return NextResponse.json({
    email,
    compte,
    resume: {
      nb_connexions: liste.length,
      duree_totale_secondes: dureeTotale,
      duree_moyenne_secondes: liste.length ? Math.round(dureeTotale / liste.length) : 0,
      premiere_connexion: liste.length ? liste[liste.length - 1].debut : null,
      derniere_activite: liste.length ? liste[0].derniere_activite : null,
    },
    sessions: liste,
  })
}
