import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { lancerSourcingPourClient } from '@/lib/sourcing'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secretUrl = req.nextUrl.searchParams.get('secret')
  const estAutorise =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secretUrl === process.env.CRON_SECRET

  if (!estAutorise) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  try {
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id')

    if (clientsError) {
      return NextResponse.json({ error: 'Erreur chargement clients' }, { status: 500 })
    }

    const resultats = []
    for (const client of clients ?? []) {
      const res = await lancerSourcingPourClient(client.id)
      resultats.push(...res)
    }

    return NextResponse.json({ succes: true, resultats })
  } catch (err) {
    console.error('Erreur cron sourcing:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
