'use client'

import { useMemo, useState } from 'react'
import { Handshake, Plus, Pencil, Trash2, Download } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, Empty, Field, Kpi, Modal, PageHead } from '@/lib/immo-os/ui'
import { DEAL_STATUSES, type Deal } from '@/lib/immo-os/types'
import { downloadCsv, qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'
import { Wallet, TrendingUp, Clock } from 'lucide-react'

const blank = (): Partial<Deal> => ({ title: '', property_id: null, party_name: '', kind: 'sale', value: 0, commission_pct: 2, status: 'negotiation', agent: '' })
const comm = (d: Deal) => (d.value * d.commission_pct) / 100

export default function DealsPage() {
  const { data, agents, create, update, remove, notify } = useImmo()
  const [st, setSt] = useState('')
  const [edit, setEdit] = useState<Partial<Deal> | null>(null)
  const list = useMemo(() => data.deals.filter((d) => !st || d.status === st), [data.deals, st])
  const meta = (s: string) => DEAL_STATUSES.find((x) => x.v === s)!
  const set = (k: keyof Deal, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const closed = data.deals.filter((d) => d.status === 'closed')
  const pipeline = data.deals.filter((d) => ['negotiation', 'offer', 'contract'].includes(d.status))

  const save = async () => {
    if (!edit?.title?.trim()) return notify('Title is required', 'err')
    const patch = { ...edit, closed_at: edit.status === 'closed' ? edit.closed_at ?? new Date().toISOString() : null }
    if (edit.id) {
      await update('deals', edit.id, patch)
      // Bien lie : vendu / loue quand le deal est cloture
      if (edit.status === 'closed' && edit.property_id) await update('properties', edit.property_id, { status: edit.kind === 'rent' ? 'rented' : 'sold' })
    } else await create('deals', patch)
    setEdit(null)
  }
  const onProp = (id: string) => {
    const p = data.properties.find((x) => x.id === id)
    setEdit((e) => ({ ...e, property_id: id || null, ...(p ? { title: e?.title || `${p.title} - ${p.area}`, value: p.price, kind: p.listing, commission_pct: p.listing === 'rent' ? 8 : 2 } : {}) }))
  }

  return (
    <div>
      <PageHead icon={<Handshake size={28} />} title="Deals" sub="Track every transaction from negotiation to closing"
        right={<><Btn onClick={() => downloadCsv('deals.csv', list.map((d) => ({ title: d.title, party: d.party_name, type: d.kind, value: d.value, commission_pct: d.commission_pct, commission: comm(d), status: d.status, agent: d.agent })))}><Download size={14} /> Export CSV</Btn><Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add deal</Btn></>} />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <Kpi icon={<Handshake size={22} />} color="#16A34A" label="Closed deals" value={closed.length} />
        <Kpi icon={<Wallet size={22} />} color="#C9A24B" label="Commission earned" value={qar(closed.reduce((s, d) => s + comm(d), 0))} />
        <Kpi icon={<Clock size={22} />} color="#2563EB" label="Pipeline value" value={qar(pipeline.reduce((s, d) => s + d.value, 0))} />
      </div>
      <Card className="mb-4"><div className="flex gap-2 flex-wrap">
        <Btn onClick={() => setSt('')} style={!st ? { borderColor: 'var(--gold)' } : undefined}>All ({data.deals.length})</Btn>
        {DEAL_STATUSES.map((s) => <Btn key={s.v} onClick={() => setSt(s.v)} style={st === s.v ? { borderColor: s.color } : undefined}><span className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.l} ({data.deals.filter((d) => d.status === s.v).length})</Btn>)}
      </div></Card>
      <Card pad={false}>
        {list.length === 0 ? <Empty title="No deals" action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add deal</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>Deal</th><th>Client</th><th>Type</th><th>Value</th><th>Commission</th><th>Agent</th><th>Status</th><th /></tr></thead>
            <tbody>{list.map((d) => (
              <tr key={d.id}><td className="font-medium">{d.title}</td><td>{d.party_name ?? '-'}</td><td>{d.kind}</td><td>{qar(d.value)}</td><td>{qar(comm(d))} <span className="t-muted text-[11px]">({d.commission_pct}%)</span></td><td>{d.agent ?? '-'}</td>
                <td><select className="imo-select" style={{ width: 140, padding: '4px 8px', color: meta(d.status).color, fontWeight: 600 }} value={d.status} onChange={(e) => update('deals', d.id, { status: e.target.value, closed_at: e.target.value === 'closed' ? new Date().toISOString() : null })}>{DEAL_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></td>
                <td className="text-right whitespace-nowrap"><Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(d)}><Pencil size={13} /></Btn> <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(`deal "${d.title}"`) && remove('deals', d.id)}><Trash2 size={13} /></Btn></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>
      {edit && (
        <Modal title={edit.id ? 'Edit deal' : 'Add deal'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Property (fills value and commission)"><select className="imo-select" value={edit.property_id ?? ''} onChange={(e) => onProp(e.target.value)}><option value="">- none -</option>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area} · {qar(p.price)}</option>)}</select></Field></div>
            <div className="sm:col-span-2"><Field label="Deal title *"><input className="imo-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field></div>
            <Field label="Client"><input className="imo-input" list="deal-parties" value={edit.party_name ?? ''} onChange={(e) => set('party_name', e.target.value)} /></Field>
            <datalist id="deal-parties">{[...data.clients, ...data.leads].map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <Field label="Agent"><select className="imo-select" value={edit.agent ?? ''} onChange={(e) => set('agent', e.target.value)}><option value="">- unassigned -</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Type"><select className="imo-select" value={edit.kind} onChange={(e) => set('kind', e.target.value)}><option value="sale">Sale</option><option value="rent">Rent</option></select></Field>
            <Field label="Status"><select className="imo-select" value={edit.status} onChange={(e) => set('status', e.target.value)}>{DEAL_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></Field>
            <Field label="Deal value (QAR)"><input type="number" min={0} className="imo-input" value={edit.value ?? 0} onChange={(e) => set('value', Number(e.target.value))} /></Field>
            <Field label="Commission (%)"><input type="number" min={0} max={100} step={0.1} className="imo-input" value={edit.commission_pct ?? 2} onChange={(e) => set('commission_pct', Number(e.target.value))} /></Field>
          </div>
          <div className="mt-3 text-[13px]">Estimated commission: <b>{qar(((edit.value ?? 0) * (edit.commission_pct ?? 0)) / 100)}</b></div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save deal</Btn></div>
        </Modal>
      )}
    </div>
  )
}
