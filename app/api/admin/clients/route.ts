import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifie que la requete vient bien d'un utilisateur admin autorise
// (on compare son email au(x) email(s) admin defini(s) dans ADMIN_EMAILS)
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

  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select(
      'id, nom_entreprise, email, zone_geographique, statut_abonnement, plan_tarifaire, created_at, leads(count)'
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erreur de chargement' }, { status: 500 })
  }

  return NextResponse.json({ clients })
}

export async function POST(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { client_id, statut_abonnement, plan_tarifaire } = await req.json()

  if (!client_id) {
    return NextResponse.json({ error: 'client_id manquant' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ statut_abonnement, plan_tarifaire })
    .eq('id', client_id)

  if (error) {
    return NextResponse.json({ error: 'Erreur de mise a jour' }, { status: 500 })
  }

  return NextResponse.json({ succes: true })
}
