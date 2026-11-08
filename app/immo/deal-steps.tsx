'use client'

import { Ban, CheckCircle2, Circle, ChevronRight, RotateCcw, Zap } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Modal } from '@/lib/immo-os/ui'
import { DEAL_STATUSES, type Deal, type DealStatus } from '@/lib/immo-os/types'
import { DEAL_FLOW, nextStep, stepIndex } from '@/lib/immo-os/deal-flow'
import { agoLocal } from '@/lib/immo-os/ago'
import { qar } from '@/lib/immo-os/helpers'
import { sameNumber } from '@/lib/immo-os/inbound-pure'

// n°48 / n°86 : parcours guide d'un deal (etapes visibles, passage a l'etape suivante, historique, actions automatiques).
// Le changement d'etape passe par update('deals') : le serveur (ou le mode demo) ecrit l'historique et declenche les actions.
export default function DealSteps({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const { data, t, tf, update, canDelete, me } = useImmo()
  const d = data.deals.find((x) => x.id === dealId) as Deal | undefined
  if (!d) return null
  const events = (data.stages ?? []).filter((s) => s.kind === 'deal' && s.record_id === d.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const cancelled = d.status === 'cancelled'
  const next = cancelled ? null : nextStep(d.status)
  const cur = stepIndex(d.status)
  const party = [...data.clients, ...data.leads].filter((c) => c.name.trim().toLowerCase() === String(d.party_name ?? '').trim().toLowerCase())
  const blocked = party.some((c) => c.do_not_contact || [...data.clients, ...data.leads, ...data.owners].some((o) => o.do_not_contact && sameNumber(o.phone, c.phone)))
  const st = (s: string) => t('st.' + s)
  const go = (status: DealStatus) => update('deals', d.id, { status, closed_at: status === 'closed' ? new Date().toISOString() : null })
  const manager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)
  const color = DEAL_STATUSES.find((s) => s.v === d.status)?.color

  return (
    <Modal title={`${t('ds.title')} · ${d.title}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2 text-[13px] mb-4"><Badge color={color}>{t('ds.s.' + d.status)}</Badge><span className="t-muted">{d.party_name ?? '-'} · {qar(d.value)} · {d.agent ?? '-'}</span></div>
      {blocked && <div className="mb-3 rounded-md px-3 py-2 text-[12.5px]" style={{ background: '#FEE2E2', color: '#991B1B' }}>{t('ds.dnc')}</div>}

      <ol className="flex items-start gap-1 mb-2" aria-label={t('ds.title')}>
        {DEAL_FLOW.map((s, i) => {
          const done = !cancelled && cur >= i
          const here = !cancelled && cur === i
          return (
            <li key={s} className="flex-1 min-w-0 text-center">
              <div className="flex items-center"><div className="flex-1 h-[3px]" style={{ background: i === 0 ? 'transparent' : done ? '#16A34A' : 'var(--border)' }} />{done ? <CheckCircle2 size={22} style={{ color: '#16A34A' }} /> : <Circle size={22} style={{ color: 'var(--border)' }} />}<div className="flex-1 h-[3px]" style={{ background: i === DEAL_FLOW.length - 1 ? 'transparent' : cur > i && !cancelled ? '#16A34A' : 'var(--border)' }} /></div>
              <div className="text-[12px] mt-1 truncate" style={{ fontWeight: here ? 700 : 500, color: here ? 'var(--gold)' : undefined }}>{t('ds.s.' + s)}</div>
            </li>
          )
        })}
      </ol>
      {cancelled && <div className="flex items-center gap-2 text-[13px] mb-2" style={{ color: '#B91C1C' }}><Ban size={15} /> {t('ds.s.cancelled')}</div>}
      <div className="text-[12.5px] t-muted mb-4">{t('ds.hint.' + d.status)}</div>

      <div className="flex flex-wrap gap-2 mb-5">
        {next && <Btn kind="primary" onClick={() => go(next)}><ChevronRight size={15} className="rtl:rotate-180" /> {tf('ds.next', { step: t('ds.s.' + next) })}</Btn>}
        {!cancelled && d.status !== 'closed' && (manager || canDelete || true) && <Btn kind="danger" onClick={() => window.confirm(t('ds.cancel.confirm')) && go('cancelled')}><Ban size={14} /> {t('ds.cancel')}</Btn>}
        {cancelled && <Btn onClick={() => go('negotiation')}><RotateCcw size={14} /> {t('ds.reopen')}</Btn>}
      </div>

      <div className="imo-label">{t('ds.history')}</div>
      {events.length === 0 ? <div className="text-[13px] t-muted">{t('ds.history.empty')}</div> : (
        <ol className="grid gap-2">
          {events.map((e, i) => (
            <li key={e.id} className="text-[13px]" style={{ borderInlineStart: `3px solid ${i === 0 ? 'var(--gold)' : 'var(--border)'}`, paddingInlineStart: 10 }}>
              <div className="font-medium">{e.from_status ? tf('ds.moved', { from: st(e.from_status), to: st(e.to_status) }) : tf('ds.created', { to: st(e.to_status) })}</div>
              <div className="t-muted text-[11.5px]">{agoLocal(e.created_at, t, tf)}{e.by_name ? ` · ${tf('pf.by', { name: e.by_name })}` : ''}</div>
              {Array.isArray(e.auto) && e.auto.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1.5">{e.auto.map((a) => <span key={a} className="inline-flex items-center gap-1 text-[11.5px] rounded-full px-2 py-0.5" style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}><Zap size={11} style={{ color: 'var(--gold)' }} />{t('ds.a.' + a)}</span>)}</div>}
            </li>
          ))}
        </ol>
      )}
      <div className="flex justify-end mt-5"><Btn onClick={onClose}>OK</Btn></div>
    </Modal>
  )
}
