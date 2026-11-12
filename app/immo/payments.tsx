'use client'

import { useMemo, useState } from 'react'
import { CreditCard, Copy, MessageCircle, RefreshCw, ShieldCheck, FlaskConical } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Modal, Btn, Badge, Field } from '@/lib/immo-os/ui'
import { qar } from '@/lib/immo-os/helpers'
import { PAYMENT_KINDS, type Deal, type Payment, type PaymentKind, type PaymentStatus } from '@/lib/immo-os/types'
import { parseAmount, paidForDeal } from '@/lib/immo-os/payments'

const COLOR: Record<PaymentStatus, string> = { pending: '#B45309', paid: '#16A34A', failed: '#DC2626', cancelled: '#64748B', expired: '#64748B' }
const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

// Montant propose selon le type : acompte 5 % de la valeur, commission = valeur x taux, loyer = valeur du deal
export const suggestAmount = (kind: PaymentKind, d: Pick<Deal, 'value' | 'commission_pct'>): string => {
  const v = Number(d.value) || 0
  const n = kind === 'deposit' ? v * 0.05 : kind === 'commission' ? (v * (Number(d.commission_pct) || 0)) / 100 : kind === 'rent' ? v : 0
  return n > 0 ? String(Math.round(n)) : ''
}

// Pastille « Paye QAR x » pour la liste des deals
export function PaidBadge({ dealId }: { dealId: string }) {
  const { data, t, tf } = useImmo()
  const paid = paidForDeal(data.payments ?? [], dealId)
  return paid > 0 ? <span className="ms-2"><Badge color="#16A34A">{tf('pay.badge_paid', { amount: qar(paid) })}</Badge></span> : null
}

export default function PaymentsModal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const { t, tf, data, mode, lang, notify, createPayment, refreshPayment, simulatePaid, sendWhatsapp } = useImmo()
  const [kind, setKind] = useState<PaymentKind>('deposit')
  const [amount, setAmount] = useState(() => suggestAmount('deposit', deal))
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => (data.payments ?? []).filter((p) => p.deal_id === deal.id).sort((a, b) => b.created_at.localeCompare(a.created_at)), [data.payments, deal.id])
  const phone = useMemo(() => {
    const n = norm(deal.party_name)
    return data.leads.find((l) => norm(l.name) === n && l.phone)?.phone ?? data.clients.find((c) => norm(c.name) === n && c.phone)?.phone ?? null
  }, [data.leads, data.clients, deal.party_name])
  const collected = paidForDeal(data.payments ?? [], deal.id)
  const locale = lang === 'ar' ? 'ar-QA' : lang === 'fr' ? 'fr-FR' : 'en-GB'

  const create = async () => {
    const a = parseAmount(amount)
    if (a === null) return notify(t('pay.amount_invalid'), 'err')
    setBusy(true)
    const r = await createPayment({ deal_id: deal.id, kind, amount: a, description: desc.trim() || undefined, contact_name: deal.party_name ?? undefined, contact_phone: phone })
    setBusy(false)
    if (r) { notify(t('pay.created')); setDesc('') }
  }
  const copy = async (p: Payment) => { try { await navigator.clipboard.writeText(p.pay_url ?? ''); notify(t('pay.copied')) } catch { notify(t('x38.copy_failed'), 'err') } }
  const sendWa = (p: Payment) => sendWhatsapp(p.contact_name, phone ?? p.contact_phone, tf('pay.wa_text', { name: p.contact_name, amount: Number(p.amount).toLocaleString('en-US'), what: t('pay.kind.' + p.kind), url: p.pay_url ?? '' }), { lang })

  return (
    <Modal title={t('pay.modal.title')} onClose={onClose} wide>
      <div className="text-[13px] t-muted mb-1">{tf('pay.for', { title: deal.title })}{collected > 0 ? ` · ${tf('pay.collected', { amount: qar(collected) })}` : ''}</div>
      <div className="flex items-start gap-2 text-[12.5px] mb-3" style={{ color: mode === 'demo' ? '#92400E' : 'var(--muted)' }}>
        {mode === 'demo' ? <FlaskConical size={14} className="mt-0.5 shrink-0" /> : <ShieldCheck size={14} className="mt-0.5 shrink-0" />}
        <span>{mode === 'demo' ? t('pay.demo_note') : t('pay.secure')}</span>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {rows.length === 0 && <div className="text-[13px] t-muted">{t('pay.none')}</div>}
        {rows.map((p) => (
          <div key={p.id} className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--soft)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13.5px]">{t('pay.kind.' + p.kind)}</b><span className="text-[13.5px]">{qar(p.amount)}</span>
              <Badge color={COLOR[p.status]}>{t('pay.status.' + p.status)}</Badge>
              <span className="t-muted text-[12px] ms-auto">{new Date(p.created_at).toLocaleDateString(locale)}</span>
            </div>
            {p.description && <div className="t-muted text-[12px] mt-1">{p.description}</div>}
            {p.status === 'pending' && (
              <div className="flex gap-2 flex-wrap mt-2">
                <Btn style={{ padding: '4px 9px' }} onClick={() => copy(p)}><Copy size={13} /> {t('pay.copy')}</Btn>
                <Btn style={{ padding: '4px 9px' }} onClick={() => sendWa(p)}><MessageCircle size={13} /> {t('pay.send_wa')}</Btn>
                {mode === 'live' && <Btn style={{ padding: '4px 9px' }} onClick={() => refreshPayment(p.id)}><RefreshCw size={13} /> {t('pay.refresh')}</Btn>}
                {mode === 'demo' && <Btn kind="gold" style={{ padding: '4px 9px' }} onClick={() => simulatePaid(p.id)}>{t('pay.simulate')}</Btn>}
              </div>
            )}
            {p.status === 'paid' && p.paid_at && <div className="t-muted text-[12px] mt-1">{t('pay.status.paid')} · {new Date(p.paid_at).toLocaleString(locale)}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <Field label={t('pay.kind')}><select className="imo-select" value={kind} onChange={(e) => { const k = e.target.value as PaymentKind; setKind(k); setAmount(suggestAmount(k, deal)) }}>{PAYMENT_KINDS.map((k) => <option key={k} value={k}>{t('pay.kind.' + k)}</option>)}</select></Field>
        <Field label={t('pay.amount')}><input className="imo-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label={t('pay.desc')}><input className="imo-input" maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={onClose}>{t('f.close')}</Btn>
        <Btn kind="primary" disabled={busy} onClick={create}><CreditCard size={14} /> {busy ? t('pay.creating') : t('pay.create')}</Btn>
      </div>
    </Modal>
  )
}
