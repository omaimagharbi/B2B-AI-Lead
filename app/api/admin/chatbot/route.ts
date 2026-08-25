import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Meme verification admin que le reste de /api/admin
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
  return NextResponse.json({ manuel_utilisation: data?.manuel_utilisation ?? '' })
}

export async function POST(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const { manuel_utilisation } = await req.json()

  // Garde une trace de l'ancienne version avant de l'ecraser, pour permettre
  // de revenir en arriere (retour terrain : "je dois avoir des versions").
  const { data: ancien } = await supabaseAdmin
    .from('chatbot_config')
    .select('manuel_utilisation')
    .eq('id', 1)
    .single()
  if (ancien?.manuel_utilisation?.trim()) {
    await supabaseAdmin
      .from('chatbot_manuel_historique')
      .insert({ manuel_utilisation: ancien.manuel_utilisation })
    // On ne garde que les 20 dernieres versions pour ne pas accumuler indefiniment.
    const { data: historique } = await supabaseAdmin
      .from('chatbot_manuel_historique')
      .select('id')
      .order('created_at', { ascending: false })
    const aSupprimer = (historique ?? []).slice(20).map((h) => h.id)
    if (aSupprimer.length > 0) {
      await supabaseAdmin.from('chatbot_manuel_historique').delete().in('id', aSupprimer)
    }
  }

  const { error } = await supabaseAdmin
    .from('chatbot_config')
    .update({ manuel_utilisation: manuel_utilisation ?? '', updated_at: new Date().toISOString() })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: 'Erreur de sauvegarde' }, { status: 500 })
  return NextResponse.json({ succes: true })
}
