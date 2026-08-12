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

const SERVICES = ['ia_diagnostic', 'whatsapp', 'email', 'sourcing'] as const

export async function GET(req: NextRequest) {
  if (!(await estAdmin(req))) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 403 })
  }

  // 1. Sante : dernier appel + taux de succes sur les 20 derniers appels,
  // par service surveille.
  const sante: Record<string, { statut: 'ok' | 'ko' | 'inconnu'; derniere_verif: string | null; details: string | null; taux_succes_recent: number | null }> = {}

  for (const service of SERVICES) {
    const { data: derniers } = await supabaseAdmin
      .from('sante_api')
      .select('succes, details, created_at')
      .eq('service', service)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!derniers || derniers.length === 0) {
      sante[service] = {
        statut: 'inconnu',
        derniere_verif: null,
        details: null,
        taux_succes_recent: null,
      }
      continue
    }

    const nbSucces = derniers.filter((d) => d.succes).length
    sante[service] = {
      statut: derniers[0].succes ? 'ok' : 'ko',
      derniere_verif: derniers[0].created_at,
      details: derniers[0].succes ? null : derniers[0].details,
      taux_succes_recent: Math.round((nbSucces / derniers.length) * 100),
    }
  }

  // 2. Cout IA : consommation et cout estime du mois en cours, par client.
  const debutMois = new Date()
  debutMois.setDate(1)
  debutMois.setHours(0, 0, 0, 0)

  const { data: usageMois } = await supabaseAdmin
    .from('usage_ia')
    .select('client_id, cout_estime_usd, tokens_entree, tokens_sortie, clients(nom_entreprise, montant_abonnement, devise_abonnement)')
    .gte('created_at', debutMois.toISOString())

  const coutParClient = new Map<
    string,
    { nom: string; cout_usd: number; appels: number; abonnement: number | null; devise: string | null }
  >()

  for (const u of usageMois ?? []) {
    if (!u.client_id) continue
    const existant = coutParClient.get(u.client_id)
    // @ts-ignore - jointure Supabase typee dynamiquement
    const nomClient = u.clients?.nom_entreprise as string | undefined
    // @ts-ignore - jointure Supabase typee dynamiquement
    const abonnement = u.clients?.montant_abonnement as number | null | undefined
    // @ts-ignore - jointure Supabase typee dynamiquement
    const devise = u.clients?.devise_abonnement as string | null | undefined

    coutParClient.set(u.client_id, {
      nom: nomClient ?? existant?.nom ?? 'Client inconnu',
      cout_usd: (existant?.cout_usd ?? 0) + (u.cout_estime_usd ?? 0),
      appels: (existant?.appels ?? 0) + 1,
      abonnement: abonnement ?? null,
      devise: devise ?? null,
    })
  }

  const coutParClientListe = Array.from(coutParClient.entries())
    .map(([client_id, v]) => ({ client_id, ...v }))
    .sort((a, b) => b.cout_usd - a.cout_usd)

  return NextResponse.json({ sante, cout_ia_mois_en_cours: coutParClientListe })
}
