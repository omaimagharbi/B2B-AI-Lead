import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { zonePourPays, deviseParZone } from '@/lib/pays'

function echapperXml(texte: string): string {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Badge epure, fond sombre, style coherent avec le reste de la plateforme
// (memes couleurs que tailwind.config.js : navy/teal/gold). Genere a la
// volee en SVG (pas de dependance canvas cote serveur) - integrable en
// <img src="/api/marketing/badge?token=..."> sur le site/les reseaux du
// cabinet.
function construireSvg(params: {
  nomCabinet: string
  montantTotal: number
  devise: string
  nbClients: number
}): string {
  const { nomCabinet, montantTotal, devise, nbClients } = params
  const montantFormate = montantTotal.toLocaleString('fr-FR')

  return `<svg width="360" height="140" viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F2540"/>
      <stop offset="100%" stop-color="#0A1A2E"/>
    </linearGradient>
  </defs>
  <rect width="360" height="140" rx="16" fill="url(#bg)"/>
  <circle cx="40" cy="70" r="22" fill="none" stroke="#F0CC7A" stroke-width="2"/>
  <text x="40" y="77" font-family="Arial, sans-serif" font-size="20" fill="#F0CC7A" text-anchor="middle">🏆</text>
  <text x="78" y="38" font-family="Arial, sans-serif" font-size="13" fill="#7C8794">${echapperXml(nomCabinet)}</text>
  <text x="78" y="66" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">${montantFormate} ${echapperXml(devise)}</text>
  <text x="78" y="86" font-family="Arial, sans-serif" font-size="12" fill="#7C8794">de missions accompagnees</text>
  <text x="78" y="112" font-family="Arial, sans-serif" font-size="12" fill="#1F6F78" font-weight="bold">${nbClients} client${nbClients > 1 ? 's' : ''} accompagne${nbClients > 1 ? 's' : ''} · Propulse par PiloBrain</text>
</svg>`
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token manquant' }, { status: 400 })

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('id, nom_entreprise, client_countries(country_code)')
    .eq('token_badge_public', token)
    .single()

  if (!client) return NextResponse.json({ error: 'Badge introuvable' }, { status: 404 })

  // Zone/devise deduite du premier pays cible du cabinet (meme logique que
  // le reste de la plateforme) - a defaut, Tunisie par convention.
  // @ts-ignore - jointure Supabase typee dynamiquement
  const premierPays = client.client_countries?.[0]?.country_code as string | undefined
  const zone = zonePourPays(premierPays ?? 'TN')
  const devise = deviseParZone(zone)

  const { count: nbClients } = await supabaseAdmin
    .from('leads_packs')
    .select('*, diagnostics!inner(client_id)', { count: 'exact', head: true })
    .eq('diagnostics.client_id', client.id)
    .eq('statut_vente', 'accepte')

  const { data: packsVendus } = await supabaseAdmin
    .from('leads_packs')
    .select('prix_pack, diagnostics!inner(client_id)')
    .eq('diagnostics.client_id', client.id)
    .eq('statut_vente', 'accepte')

  const montantTotal = (packsVendus ?? []).reduce((total, p) => total + (p.prix_pack ?? 0), 0)

  const svg = construireSvg({
    nomCabinet: client.nom_entreprise ?? 'Cabinet',
    montantTotal,
    devise,
    nbClients: nbClients ?? 0,
  })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
