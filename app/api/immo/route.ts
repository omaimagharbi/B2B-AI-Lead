import { NextRequest, NextResponse } from 'next/server'
import { ENTITIES } from '@/lib/immo-os/types'
import * as all from '@/lib/immo-os/api/all'
import * as me from '@/lib/immo-os/api/me'
import * as seed from '@/lib/immo-os/api/seed'
import * as assistant from '@/lib/immo-os/api/assistant'
import * as whatsapp from '@/lib/immo-os/api/whatsapp'
import * as capture from '@/lib/immo-os/api/capture'
import * as targets from '@/lib/immo-os/api/targets'
import * as upload from '@/lib/immo-os/api/upload'
import * as visitsCalendar from '@/lib/immo-os/api/visits-calendar'
import * as cronRappels from '@/lib/immo-os/api/cron-rappels'
import * as reassign from '@/lib/immo-os/api/reassign'
import * as journal from '@/lib/immo-os/api/journal'
import * as historique from '@/lib/immo-os/api/historique'
import * as entity from '@/lib/immo-os/api/entity'
import * as charter from '@/lib/immo-os/api/charter'
import * as settings from '@/lib/immo-os/api/settings'
import * as meta from '@/lib/immo-os/api/meta'
import * as wa from '@/lib/immo-os/api/wa'
import * as publish from '@/lib/immo-os/api/publish'
import * as marketImport from '@/lib/immo-os/api/market-import'
import * as payments from '@/lib/immo-os/api/payments'

// UNE SEULE fonction serverless pour tout le Real Estate OS (plan Vercel Hobby : nombre de fonctions limite).
// Appel : /api/immo?r=<nom>  (ex. /api/immo?r=all, /api/immo?r=leads, /api/immo?r=visits/calendar).
// Pas de dossier a crochets : GitHub refuse de les uploader depuis le navigateur.
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // l'assistant IA peut prendre jusqu'a ~20 s

type Handler = (req: NextRequest, ctx?: any) => Promise<Response> | Response
type Mod = Partial<Record<'GET' | 'POST' | 'PATCH' | 'DELETE', Handler>>

const ROUTES: Record<string, Mod> = {
  all, me, seed, assistant, whatsapp, capture, targets, upload,
  'visits/calendar': visitsCalendar,
  'leads/reassign': reassign, // reassignation en masse (lot 2)
  activity: journal, // journal d'activite (gestionnaires)
  assignments: historique, // historique des affectations de leads
  charter, // lot 5 : acceptation de la charte d'utilisation
  settings, // lot 5 : reglage WhatsApp de l'agence (numeros inconnus)
  meta, // lot 6a : webhook WhatsApp Business (Meta), public, verifie par signature
  publish, // lot 8 : publication Instagram / Facebook + performance des annonces
  'market-import': marketImport, // lot 8 : import de donnees de marche par fichier (source obligatoire)
  payments, // lot 9 : paiement en ligne (lien MyFatoorah QAR), retour client et webhook publics, statut re-verifie via l'API
  wa, // lot 6a : numeros Meta de l'agence et modeles de messages
  'cron-rappels': cronRappels, // appele par le cron Vercel (vercel.json)
}

async function dispatch(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', req: NextRequest) {
  const key = (req.nextUrl.searchParams.get('r') ?? '').replace(/^\/+|\/+$/g, '')
  const parts = key ? key.split('/') : []
  const direct = ROUTES[key]
  if (direct) {
    const h = direct[method]
    return h ? h(req) : NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }
  // ?r=<entite> : owners, properties, clients, leads, deals, messages, ads, visits
  if (parts.length === 1 && parts[0] in ENTITIES) {
    const h = (entity as Mod)[method]
    return h ? h(req, { params: { entity: parts[0] } }) : NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export const GET = (req: NextRequest) => dispatch('GET', req)
export const POST = (req: NextRequest) => dispatch('POST', req)
export const PATCH = (req: NextRequest) => dispatch('PATCH', req)
export const DELETE = (req: NextRequest) => dispatch('DELETE', req)
