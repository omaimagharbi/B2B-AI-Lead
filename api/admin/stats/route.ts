import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

// Vue d'ensemble de la sante du business (pas du client) : combien de
// cabinets actifs, combien de diagnostics l'IA a genere, combien de cibles
// ont ete sourcees au total, et le MRR par devise (jamais additionne entre
// devises differentes - TND/USD/EUR restent separes).
export async function GET(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  const [
    { count: totalEntreprises },
    { count: entreprisesActives },
    { count: enAttenteActivation },
    { count: totalDiagnostics },
    { count: totalCibles },
    { data: abonnementsPayes },
  ] = await Promise.all([
    supabaseAdmin.from('clients').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('acces_active', true),
    supabaseAdmin
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('acces_active', false),
    supabaseAdmin.from('diagnostics').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('targets').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('clients')
      .select('montant_abonnement, devise_abonnement')
      .eq('statut_paiement', 'paye')
      .not('montant_abonnement', 'is', null),
  ])

  const mrrParDevise = new Map<string, number>()
  for (const abo of abonnementsPayes ?? []) {
    const devise = abo.devise_abonnement ?? 'TND'
    mrrParDevise.set(devise, (mrrParDevise.get(devise) ?? 0) + (abo.montant_abonnement ?? 0))
  }

  return NextResponse.json({
    total_entreprises: totalEntreprises ?? 0,
    entreprises_actives: entreprisesActives ?? 0,
    en_attente_activation: enAttenteActivation ?? 0,
    total_diagnostics: totalDiagnostics ?? 0,
    total_cibles: totalCibles ?? 0,
    mrr_par_devise: Object.fromEntries(mrrParDevise),
  })
}
