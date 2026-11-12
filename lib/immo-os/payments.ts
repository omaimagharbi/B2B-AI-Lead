// Lot 9 : paiement en ligne - logique PURE (sans reseau, testable) : validation, corps de requete MyFatoorah, lecture du statut.
// Aucune donnee de carte ne passe par nous : le client paie sur la page hebergee par MyFatoorah (lien de facture).
import { PAYMENT_KINDS, type PaymentKind, type PaymentStatus } from './types'

export const MAX_AMOUNT = 10_000_000 // QAR, plafond de securite (identique a la contrainte SQL)
export const CURRENCY = 'QAR' as const

export type CreateInput = { deal_id?: string | null; kind?: unknown; amount?: unknown; description?: unknown; contact_name?: unknown; contact_phone?: unknown }
export type Clean = { deal_id: string | null; kind: PaymentKind; amount: number; description: string | null; contact_name: string | null; contact_phone: string | null }

// Montant en QAR : nombre fini, > 0, au plus 2 decimales, plafonne.
export function parseAmount(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/[\s,]/g, '')) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null
  return Math.round(n * 100) / 100
}

export function validateCreate(b: CreateInput): { ok: true; v: Clean } | { ok: false; error: string } {
  const amount = parseAmount(b.amount)
  if (amount === null) return { ok: false, error: 'Invalid amount' }
  const kind = (PAYMENT_KINDS as string[]).includes(String(b.kind)) ? (b.kind as PaymentKind) : null
  if (!kind) return { ok: false, error: 'Invalid payment type' }
  const clean = (x: unknown, n: number) => { const s = typeof x === 'string' ? x.trim().slice(0, n) : ''; return s || null }
  return { ok: true, v: { deal_id: clean(b.deal_id, 64), kind, amount, description: clean(b.description, 300), contact_name: clean(b.contact_name, 200), contact_phone: clean(b.contact_phone, 40) } }
}

// Jeton aleatoire (CustomerReference) : 24 caracteres [a-z0-9], non devinable.
export function newRef(rand: (n: number) => Uint8Array): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(rand(24)).map((b) => abc[b % abc.length]).join('')
}

export const isValidRef = (r: unknown): r is string => typeof r === 'string' && /^[a-z0-9]{24}$/.test(r)

export type MfConfig = { apiKey: string; baseUrl: string; env: 'test' | 'live'; webhookSecret: string | null }
// Environnement MyFatoorah : test (apitest) par defaut ; live = serveur Qatar. MYFATOORAH_BASE_URL permet de forcer une URL.
export function readConfig(env: Record<string, string | undefined>): MfConfig | null {
  const apiKey = (env.MYFATOORAH_API_KEY ?? '').trim()
  if (!apiKey) return null
  const live = (env.MYFATOORAH_ENV ?? 'test').toLowerCase() === 'live'
  const forced = (env.MYFATOORAH_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const baseUrl = forced || (live ? 'https://api-qa.myfatoorah.com' : 'https://apitest.myfatoorah.com')
  if (!/^https:\/\//.test(baseUrl)) return null
  return { apiKey, baseUrl, env: live ? 'live' : 'test', webhookSecret: (env.MYFATOORAH_WEBHOOK_SECRET ?? '').trim() || null }
}

// Corps de POST /v2/SendPayment (lien de facture, QAR). Le lien est envoye par nous (WhatsApp), pas par MyFatoorah.
export function buildInvoiceBody(p: { name: string; amount: number; ref: string; siteUrl: string; lang: 'en' | 'ar' | 'fr'; description?: string | null }) {
  const site = p.siteUrl.replace(/\/+$/, '')
  const cb = `${site}/api/immo?r=payments&cb=1&ref=${p.ref}`
  return {
    CustomerName: p.name.slice(0, 100) || 'Customer', NotificationOption: 'LNK', InvoiceValue: p.amount, DisplayCurrencyIso: CURRENCY,
    CallBackUrl: cb, ErrorUrl: `${cb}&err=1`, CustomerReference: p.ref, Language: p.lang === 'ar' ? 'ar' : 'en',
    ...(p.description ? { CustomerComments: p.description.slice(0, 500) } : {}),
  }
}
export const siteUrlOk = (u: string | undefined): u is string => !!u && /^https:\/\/[^/]+/.test(u) && !/localhost|127\.0\.0\.1/.test(u)

// Lecture de GetPaymentStatus : n'accepte « paid » que si TOUT concorde (statut, reference, montant). Sinon on ne bouge rien.
export type MfStatus = { InvoiceId?: number | string; InvoiceStatus?: string; InvoiceValue?: number | string; CustomerReference?: string | null; InvoiceTransactions?: { PaymentId?: string; TransactionStatus?: string }[] }
export function interpretStatus(d: MfStatus | null | undefined, row: { ref: string; amount: number; invoice_id?: string | null }): { status: PaymentStatus | null; paymentId: string | null; reason?: string } {
  if (!d) return { status: null, paymentId: null, reason: 'no_data' }
  if (d.CustomerReference && d.CustomerReference !== row.ref) return { status: null, paymentId: null, reason: 'ref_mismatch' }
  if (row.invoice_id && d.InvoiceId !== undefined && String(d.InvoiceId) !== String(row.invoice_id)) return { status: null, paymentId: null, reason: 'invoice_mismatch' }
  const st = String(d.InvoiceStatus ?? '').toLowerCase()
  const tx = (d.InvoiceTransactions ?? []).find((t) => /^succ/i.test(String(t.TransactionStatus ?? '')))
  if (st === 'paid') {
    const v = Number(d.InvoiceValue)
    if (!Number.isFinite(v) || Math.abs(v - row.amount) > 0.01) return { status: null, paymentId: null, reason: 'amount_mismatch' }
    return { status: 'paid', paymentId: tx?.PaymentId ? String(tx.PaymentId) : null }
  }
  if (st === 'pending') {
    // Une transaction echouee sur une facture encore ouverte ne ferme pas la facture : le client peut reessayer.
    return { status: 'pending', paymentId: null }
  }
  if (st === 'canceled' || st === 'cancelled') return { status: 'cancelled', paymentId: null }
  if (st === 'expired') return { status: 'expired', paymentId: null }
  if (st === 'failed') return { status: 'failed', paymentId: null }
  return { status: null, paymentId: null, reason: 'unknown_status' }
}

export const isFinal = (s: PaymentStatus) => s === 'paid' || s === 'cancelled' || s === 'expired'

// Totaux pour les rapports : encaisse / en attente (QAR), par type.
export function summarize(rows: { amount: number; status: PaymentStatus; kind: PaymentKind }[]) {
  const out = { paid: 0, pending: 0, paidCount: 0, pendingCount: 0, byKind: {} as Record<string, number> }
  for (const r of rows) {
    const a = Number(r.amount) || 0
    if (r.status === 'paid') { out.paid += a; out.paidCount++; out.byKind[r.kind] = (out.byKind[r.kind] ?? 0) + a }
    else if (r.status === 'pending') { out.pending += a; out.pendingCount++ }
  }
  return out
}
// Total encaisse pour un deal
export const paidForDeal = (rows: { deal_id?: string | null; amount: number; status: PaymentStatus }[], dealId: string) =>
  rows.filter((r) => r.deal_id === dealId && r.status === 'paid').reduce((s, r) => s + (Number(r.amount) || 0), 0)
