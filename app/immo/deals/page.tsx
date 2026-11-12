'use client'

import { useMemo, useState } from 'react'
import { Handshake, Plus, Pencil, Trash2, Download } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, Empty, Field, Kpi, Modal, PageHead } from '@/lib/immo-os/ui'
import { DEAL_STATUSES, type Deal } from '@/lib/immo-os/types'
import { downloadCsv, qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'
import { Wallet, TrendingUp, Clock, Layers, CreditCard } from 'lucide-react'
import DealSteps from '../deal-steps'
import PaymentsModal, { PaidBadge } from '../payments'

const blank = (): Partial<Deal> => ({ title: '', property_id: null, party_name: '', kind: 'sale', value: 0, commission_pct: 2, status: 'negotiation', agent: '' })
const comm = (d: Deal) => (d.value * d.commission_pct) / 100

export default function DealsPage() {
  const { data, agents, create, update, remove, notify, canDelete, t, tf } = useImmo()
  const [st, setSt] = useState('')
  const [edit, setEdit] = useState<Partial<Deal> | null>(null)
  const [stepsId, setStepsId] = useState<string | null>(null)
  const [payId, setPayId] = useState<string | null>(null)
  const list = useMemo(() => data.deals.filter((d) => !st || d.status === st), [data.deals, st])
  const meta = (s: string) => DEAL_STATUSES.find((x) => x.v === s)!
  const set = (k: keyof Deal, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const closed = data.deals.filter((d) => d.status === 'closed')
  const pipeline = data.deals.filter((d) => ['negotiation', 'offer', 'contract'].includes(d.status))

  const save = async () => {
    if (!edit?.title?.trim()) return notify(t('x38.title_is_required'), 'err')
    const patch = { ...edit, closed_at: edit.status === 'closed' ? edit.closed_at ?? new Date().toISOString() : null }
    // Le statut du bien lie (reserve / vendu / loue), les taches et l'historique d'etapes sont geres par le serveur (ou le mode demo) a chaque changement d'etape
    if (edit.id) await update('deals', edit.id, patch)
    else await create('deals', patch)
    setEdit(null)
  }
  const onProp = (id: string) => {
    const p = data.properties.find((x) => x.id === id)
    setEdit((e) => ({ ...e, property_id: id || null, ...(p ? { title: e?.title || `${p.title} - ${p.area}`, value: p.price, kind: p.listing, commission_pct: p.commission_pct || (p.listing === 'rent' ? 8 : 2) } : {}) }))
  }

  return (
    <div>
      <PageHead icon={<Handshake size={28} />} title={t('nav.deals')} sub={t('xm.deals_sub')}
        right={<><Btn onClick={() => downloadCsv('deals.csv', list.map((d) => ({ title: d.title, party: d.party_name, type: d.kind, value: d.value, commission_pct: d.commission_pct, commission: comm(d), status: d.status, agent: d.agent })))}><Download size={14} /> {t('x38.export_csv')}</Btn><Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> {t('x38.add_deal')}</Btn></>} />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Kpi icon={<Handshake size={22} />} color="#16A34A" label={t('x38.closed_deals')} value={closed.length} />
        <Kpi icon={<Wallet size={22} />} color="#C9A24B" label={t('x38.commission_earned')} value={qar(closed.reduce((s, d) => s + comm(d), 0))} />
        <Kpi icon={<Clock size={22} />} color="#2563EB" label={t('x38.pipeline_value')} value={qar(pipeline.reduce((s, d) => s + d.value, 0))} />
      </div>
      <Card className="mb-4"><div className="flex gap-2 flex-wrap">
        <Btn onClick={() => setSt('')} style={!st ? { borderColor: 'var(--gold)' } : undefined}>{tf('xl.all_n', { n: data.deals.length })}</Btn>
        {DEAL_STATUSES.map((s) => <Btn key={s.v} onClick={() => setSt(s.v)} style={st === s.v ? { borderColor: s.color } : undefined}><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.l} ({data.deals.filter((d) => d.status === s.v).length})</Btn>)}
      </div></Card>
      <Card pad={false}>
        {list.length === 0 ? <Empty title={t('x38.no_deals')} action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> {t('x38.add_deal')}</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>{t('pf.what.deal')}</th><th>{t('x38.client')}</th><th>{t('x38.type')}</th><th>{t('x38.value')}</th><th>{t('team.commission')}</th><th>{t('h.agent')}</th><th>{t('h.status')}</th><th /></tr></thead>
            <tbody>{list.map((d) => (
              <tr key={d.id}><td className="font-medium"><button className="text-start underline decoration-dotted" onClick={() => setStepsId(d.id)} style={{ color: 'inherit' }}>{d.title}</button><PaidBadge dealId={d.id} /></td><td>{d.party_name ?? '-'}</td><td>{d.kind}</td><td>{qar(d.value)}</td><td>{qar(comm(d))} <span className="t-muted text-[11px]">({d.commission_pct}%)</span></td><td>{d.agent ?? '-'}</td>
                <td><select className="imo-select" style={{ width: 140, padding: '4px 8px', color: meta(d.status).color, fontWeight: 600 }} value={d.status} onChange={(e) => update('deals', d.id, { status: e.target.value, closed_at: e.target.value === 'closed' ? new Date().toISOString() : null })}>{DEAL_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></td>
                <td className="text-right whitespace-nowrap"><Btn style={{ padding: '4px 8px' }} onClick={() => setPayId(d.id)} title={t('pay.btn')} aria-label={t('pay.btn')}><CreditCard size={13} /></Btn> <Btn style={{ padding: '4px 8px' }} onClick={() => setStepsId(d.id)} title={t('ds.title')} aria-label={t('ds.title')}><Layers size={13} /></Btn> <Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(d)}><Pencil size={13} /></Btn> {canDelete && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(tf('cf.deal', { name: d.title })) && remove('deals', d.id)}><Trash2 size={13} /></Btn>}</td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {stepsId && <DealSteps dealId={stepsId} onClose={() => setStepsId(null)} />}
      {payId && data.deals.find((x) => x.id === payId) && <PaymentsModal deal={data.deals.find((x) => x.id === payId)!} onClose={() => setPayId(null)} />}
      {edit && (
        <Modal title={edit.id ? t('xm.edit_deal') : t('x38.add_deal')} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label={t('x38.property_fills_value_and_commission')}><select className="imo-select" value={edit.property_id ?? ''} onChange={(e) => onProp(e.target.value)}><option value="">{t('loc.none')}</option>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area} · {qar(p.price)}</option>)}</select></Field></div>
            <div className="sm:col-span-2"><Field label={t('x38.deal_title')}><input className="imo-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field></div>
            <Field label={t('x38.client')}><input className="imo-input" list="deal-parties" value={edit.party_name ?? ''} onChange={(e) => set('party_name', e.target.value)} /></Field>
            <datalist id="deal-parties">{[...data.clients, ...data.leads].map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <Field label={t('h.agent')}><select className="imo-select" value={edit.agent ?? ''} onChange={(e) => set('agent', e.target.value)}><option value="">{t('x38.unassigned')}</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label={t('x38.type')}><select className="imo-select" value={edit.kind} onChange={(e) => set('kind', e.target.value)}><option value="sale">{t('mk.sale')}</option><option value="rent">{t('x38.rent')}</option></select></Field>
            <Field label={t('h.status')}><select className="imo-select" value={edit.status} onChange={(e) => set('status', e.target.value)}>{DEAL_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></Field>
            <Field label={t('x38.deal_value_qar')}><input type="number" min={0} className="imo-input" value={edit.value ?? 0} onChange={(e) => set('value', Number(e.target.value))} /></Field>
            <Field label={t('prop.commission')}><input type="number" min={0} max={100} step={0.1} className="imo-input" value={edit.commission_pct ?? 2} onChange={(e) => set('commission_pct', Number(e.target.value))} /></Field>
          </div>
          <div className="mt-3 text-[13px]">{t('x38.estimated_commission')} <b>{qar(((edit.value ?? 0) * (edit.commission_pct ?? 0)) / 100)}</b></div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>{t('f.cancel')}</Btn><Btn kind="primary" onClick={save}>{t('x38.save_deal')}</Btn></div>
        </Modal>
      )}
    </div>
  )
}
