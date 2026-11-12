import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { tableAbsente } from '@/lib/immo-os/server'
import { logActivity, type Actor } from '@/lib/immo-os/activity'
import { buildInvoiceBody, interpretStatus, isFinal, isValidRef, newRef, readConfig, siteUrlOk, validateCreate, type MfConfig, type MfStatus } from '@/lib/immo-os/payments'
import type { Lang } from '@/lib/immo-os/i18n'

// Lot 9 : paiement en ligne (MyFatoorah, QAR). Une seule route (?r=payments), pas de nouveau cron.
//   POST  {action:'create'|'refresh'}  : authentifie (gestionnaire, ou agent pour SES deals)
//   GET   ?cb=1&ref=..                 : retour public du client apres paiement (statut RE-VERIFIE aupres de MyFatoorah, jamais cru sur parole)
//   POST  ?hook=1&secret=..            : webhook MyFatoorah (public ; meme re-verification via l'API)
//   GET   ?info=1                      : etat de la configuration (gestionnaires)
// Aucune donnee de carte n'est recue ni stockee : le client paie sur la page hebergee par MyFatoorah.
const SELECT = 'id, client_id, deal_id, contact_name, contact_phone, agent, kind, amount, currency, description, status, ref, invoice_id, payment_id, pay_url, created_by, created_at, paid_at'
const PUBLIC_COLS = 'id, deal_id, contact_name, contact_phone, agent, kind, amount, currency, description, status, pay_url, paid_at, created_at, created_by'
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
const site = () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')

async function mf(cfg: MfConfig, path: string, body: unknown): Promise<{ ok: boolean; json: any }> {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000)
  try {
    const r = await fetch(`${cfg.baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` }, body: JSON.stringify(body), signal: ctl.signal, cache: 'no-store' })
    const json = await r.json().catch(() => null)
    return { ok: r.ok && json?.IsSuccess !== false, json }
  } catch { return { ok: false, json: null } } finally { clearTimeout(to) }
}
const mfMessage = (j: any) => String(j?.ValidationErrors?.[0]?.Error ?? j?.Message ?? 'Payment provider error').slice(0, 200)
const agencyLang = async (clientId: string): Promise<Lang> => {
  const { data } = await supabaseAdmin.from('clients').select('langue_preferee').eq('id', clientId).maybeSingle()
  return data?.langue_preferee === 'fr' || data?.langue_preferee === 'ar' ? data.langue_preferee : 'en'
}

// Relit le statut chez MyFatoorah et met a jour la ligne. Ne retrograde jamais un paiement deja « paid ».
async function syncRow(cfg: MfConfig, row: any, hint?: { paymentId?: string | null }): Promise<{ row: any; changed: boolean; reason?: string }> {
  if (row.status === 'paid') return { row, changed: false }
  const byPayment = hint?.paymentId && /^\d{6,30}$/.test(hint.paymentId)
  const key = byPayment ? hint!.paymentId! : row.invoice_id
  if (!key) return { row, changed: false, reason: 'no_invoice' }
  const r = await mf(cfg, '/v2/GetPaymentStatus', { Key: String(key), KeyType: byPayment ? 'PaymentId' : 'InvoiceId' })
  if (!r.ok) return { row, changed: false, reason: 'provider_unreachable' }
  const res = interpretStatus(r.json?.Data as MfStatus, { ref: row.ref, amount: Number(row.amount), invoice_id: row.invoice_id })
  if (!res.status || res.status === row.status || (res.status === 'pending' && row.status !== 'pending' && isFinal(row.status))) return { row, changed: false, reason: res.reason }
  const patch: Record<string, unknown> = { status: res.status, updated_at: new Date().toISOString() }
  if (res.status === 'paid') { patch.paid_at = new Date().toISOString(); if (res.paymentId) patch.payment_id = res.paymentId }
  const { data, error } = await supabaseAdmin.from('re_payments').update(patch).eq('id', row.id).eq('client_id', row.client_id).neq('status', 'paid').select(SELECT).maybeSingle()
  if (error || !data) return { row, changed: false, reason: 'update_failed' }
  const actor: Actor = { clientId: row.client_id, name: 'MyFatoorah', role: 'system' }
  await logActivity(actor, { action: res.status === 'paid' ? 'payment_paid' : 'update', entity: 'payments', recordId: row.id, label: `${row.contact_name} · QAR ${Number(row.amount).toLocaleString('en-US')}`, details: { status: res.status } })
  return { row: data, changed: true }
}

const pub = (r: any) => { if (!r) return r; const { client_id, ref, invoice_id, payment_id, ...rest } = r; return rest }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  // --- retour du client (public) : redirige vers /pay?s=paid|failed|pending, apres verification serveur ---
  if (q.get('cb')) {
    const base = site() && siteUrlOk(site()) ? site()! : req.nextUrl.origin
    const go = (s: string, lang: Lang = 'en') => NextResponse.redirect(`${base}/pay?s=${s}&lang=${lang}`, 303)
    const ref = q.get('ref')
    const cfg = readConfig(process.env)
    if (!cfg || !isValidRef(ref)) return go('unknown')
    const { data: row } = await supabaseAdmin.from('re_payments').select(SELECT).eq('ref', ref).maybeSingle()
    if (!row) return go('unknown')
    const lang = await agencyLang(row.client_id)
    const out = await syncRow(cfg, row, { paymentId: q.get('paymentId') })
    if (out.row.status === 'paid') return go('paid', lang)
    if (q.get('err') || out.row.status === 'failed' || out.row.status === 'cancelled' || out.row.status === 'expired') return go('failed', lang)
    return go('pending', lang)
  }
  // --- etat de la configuration (gestionnaires) ---
  if (q.get('info')) {
    const auth = await contexteImmo(req)
    if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
    if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
    const cfg = readConfig(process.env)
    const s = site()
    return NextResponse.json({ configured: !!cfg, env: cfg?.env ?? null, site_ok: siteUrlOk(s), has_webhook_secret: !!cfg?.webhookSecret, callback_url: s ? `${s}/api/immo?r=payments&cb=1` : null, webhook_url: s ? `${s}/api/immo?r=payments&hook=1${cfg?.webhookSecret ? '&secret=<MYFATOORAH_WEBHOOK_SECRET>' : ''}` : null })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const cfg = readConfig(process.env)
  // --- webhook MyFatoorah (public) : on ne fait confiance a rien dans le corps, on relit le statut via l'API ---
  if (q.get('hook')) {
    if (!cfg) return NextResponse.json({ ok: true, ignored: 'not_configured' })
    if (cfg.webhookSecret) {
      const a = Buffer.from(q.get('secret') ?? ''); const b = Buffer.from(cfg.webhookSecret)
      if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json().catch(() => ({}))
    const d = body?.Data ?? {}
    const invoiceId = d.InvoiceId ?? d.Invoice?.Id ?? null
    const ref = typeof d.CustomerReference === 'string' ? d.CustomerReference : null
    let row: any = null
    if (invoiceId) row = (await supabaseAdmin.from('re_payments').select(SELECT).eq('invoice_id', String(invoiceId)).maybeSingle()).data
    if (!row && isValidRef(ref)) row = (await supabaseAdmin.from('re_payments').select(SELECT).eq('ref', ref).maybeSingle()).data
    if (row) await syncRow(cfg, row)
    return NextResponse.json({ ok: true })
  }

  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const body = await req.json().catch(() => ({}))
  const manager = isManager(auth.role)
  const actor: Actor = { clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }

  if (body?.action === 'refresh') {
    if (!cfg) return NextResponse.json({ error: 'Online payment is not configured', code: 'not_configured' }, { status: 503 })
    const { data: row, error } = await supabaseAdmin.from('re_payments').select(SELECT).eq('id', String(body.id ?? '')).eq('client_id', auth.clientId).maybeSingle()
    if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 83 first' : 'Database error' }, { status: tableAbsente(error) ? 503 : 500 })
    if (!row || (!manager && !same(row.agent, auth.name))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const out = await syncRow(cfg, row)
    return NextResponse.json({ ok: true, changed: out.changed, row: pub(out.row), reason: out.reason ?? null })
  }

  if (body?.action !== 'create') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (!cfg) return NextResponse.json({ error: 'Online payment is not configured', code: 'not_configured' }, { status: 503 })
  const s = site()
  if (!siteUrlOk(s)) return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL must be your public https address', code: 'site_url' }, { status: 503 })
  const v = validateCreate(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  let dealAgent: string | null = null; let party = v.v.contact_name
  if (v.v.deal_id) {
    const { data: deal } = await supabaseAdmin.from('re_deals').select('id, title, party_name, agent').eq('id', v.v.deal_id).eq('client_id', auth.clientId).maybeSingle()
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    if (!manager && !same(deal.agent, auth.name)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
    dealAgent = deal.agent ?? null; party = party || deal.party_name || deal.title
  }
  if (!party) return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
  const agent = dealAgent ?? auth.name ?? null

  // Anti double-clic : meme deal, meme type, meme montant, encore en attente depuis moins de 2 minutes = on renvoie le lien existant
  if (v.v.deal_id) {
    const since = new Date(Date.now() - 120000).toISOString()
    const { data: dup } = await supabaseAdmin.from('re_payments').select(SELECT).eq('client_id', auth.clientId).eq('deal_id', v.v.deal_id).eq('kind', v.v.kind).eq('amount', v.v.amount).eq('status', 'pending').gte('created_at', since).limit(1)
    if (dup?.[0]) return NextResponse.json({ ok: true, row: pub(dup[0]), duplicate: true })
  }

  const ref = newRef((n) => randomBytes(n))
  const lang = await agencyLang(auth.clientId)
  const inv = await mf(cfg, '/v2/SendPayment', buildInvoiceBody({ name: party, amount: v.v.amount, ref, siteUrl: s!, lang, description: v.v.description }))
  const url = inv.json?.Data?.InvoiceURL
  if (!inv.ok || typeof url !== 'string' || !/^https:\/\//.test(url)) return NextResponse.json({ error: mfMessage(inv.json), code: 'provider' }, { status: 502 })

  const { data: row, error } = await supabaseAdmin.from('re_payments').insert({
    client_id: auth.clientId, deal_id: v.v.deal_id, contact_name: party.slice(0, 200), contact_phone: v.v.contact_phone, agent, kind: v.v.kind, amount: v.v.amount, currency: 'QAR',
    description: v.v.description, status: 'pending', provider: 'myfatoorah', ref, invoice_id: inv.json?.Data?.InvoiceId != null ? String(inv.json.Data.InvoiceId) : null, pay_url: url, created_by: auth.name || null,
  }).select(SELECT).single()
  if (error) return NextResponse.json({ error: tableAbsente(error) ? 'Run migration 83 first' : 'Database error' }, { status: tableAbsente(error) ? 503 : 500 })
  await logActivity(actor, { action: 'create', entity: 'payments', recordId: row.id, label: `${party} · QAR ${v.v.amount.toLocaleString('en-US')}`, details: { kind: v.v.kind } })
  return NextResponse.json({ ok: true, row: pub(row) })
}
