import { NextRequest, NextResponse } from 'next/server'
import { traiterCapture } from '@/lib/immo-os/capture'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isUuid } from '@/lib/immo-os/server'
import { envoyerWhatsapp } from '@/lib/notifications'

// Endpoint PUBLIC (formulaire /lead/<agence>) : pas d'authentification, donc validation stricte,
// honeypot et rate limit dans traiterCapture. Meme origine que le formulaire : pas de CORS ouvert.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnu'
  const r = await traiterCapture(body, ip, { notifier: (tel, txt) => envoyerWhatsapp(tel, txt) })
  return NextResponse.json(r.body, { status: r.status })
}

// Infos publiques pour afficher le formulaire : nom de l'agence + bien (seulement s'il appartient a l'agence et reste disponible).
export async function GET(req: NextRequest) {
  const agency = req.nextUrl.searchParams.get('agency')
  const property = req.nextUrl.searchParams.get('property')
  if (!isUuid(agency)) return NextResponse.json({ error: 'Unknown agency' }, { status: 404 })
  const { data: cab } = await supabaseAdmin.from('clients').select('nom_entreprise').eq('id', agency).maybeSingle()
  if (!cab) return NextResponse.json({ error: 'Unknown agency' }, { status: 404 })
  let prop = null
  if (isUuid(property)) {
    const { data } = await supabaseAdmin.from('re_properties').select('id, title, type, listing, area, price, beds, baths, size_m2, image_url, status').eq('id', property).eq('client_id', agency).maybeSingle()
    if (data && data.status === 'available') prop = data
  }
  return NextResponse.json({ name: cab.nom_entreprise, property: prop })
}
