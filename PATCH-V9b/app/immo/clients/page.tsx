'use client'

import { useMemo, useState } from 'react'
import { Users, Plus, Search, Pencil, Trash2, Download } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { CLIENT_KINDS, type RClient } from '@/lib/immo-os/types'
import { ago, downloadCsv, qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'

const KIND_COLOR: Record<string, string> = { buyer: '#2563EB', seller: '#F97316', tenant: '#0891B2', investor: '#7C3AED' }
const blank = (): Partial<RClient> => ({ name: '', phone: '', email: '', nationality: '', kind: 'buyer', budget: 0, preferred_areas: '', notes: '', agent: '' })

export default function ClientsPage() {
  const { data, agents, create, update, remove, notify } = useImmo()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [edit, setEdit] = useState<Partial<RClient> | null>(null)
  const [sel, setSel] = useState<RClient | null>(null)

  const list = useMemo(() => data.clients.filter((c) => (!q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (!kind || c.kind === kind)), [data.clients, q, kind])
  const set = (k: keyof RClient, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const save = async () => {
    if (!edit?.name?.trim()) return notify('Name is required', 'err')
    if (edit.id) await update('clients', edit.id, edit)
    else await create('clients', edit)
    setEdit(null)
  }

  return (
    <div>
      <PageHead icon={<Users size={28} />} title="Clients" sub={`${data.clients.length} clients`}
        right={<><Btn onClick={() => downloadCsv('clients.csv', list.map((c) => ({ name: c.name, type: c.kind, phone: c.phone, email: c.email, nationality: c.nationality, budget: c.budget, areas: c.preferred_areas, agent: c.agent })))}><Download size={14} /> Export CSV</Btn><Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add client</Btn></>} />
      <Card className="mb-4"><div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 32 }} placeholder="Search name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="imo-select" style={{ width: 160 }} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option>{CLIENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
      </div></Card>

      <Card pad={false}>
        {list.length === 0 ? <Empty title="No clients found" action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add client</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>Client</th><th>Type</th><th>Phone</th><th>Budget</th><th>Preferred areas</th><th>Agent</th><th>Since</th><th /></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSel(c)}>
                <td><div className="flex items-center gap-2"><Avatar name={c.name} size={28} /><div><div className="font-medium">{c.name}</div><div className="text-[11.5px] t-muted">{c.email ?? c.nationality ?? ''}</div></div></div></td>
                <td><Badge color={KIND_COLOR[c.kind]}>{c.kind}</Badge></td><td>{c.phone ?? '-'}</td><td>{c.budget ? qar(c.budget) : '-'}</td><td className="t-muted">{c.preferred_areas ?? '-'}</td><td>{c.agent ?? '-'}</td><td className="t-muted">{ago(c.created_at)}</td>
                <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}><Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(c)}><Pencil size={13} /></Btn> <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(`client "${c.name}"`) && remove('clients', c.id)}><Trash2 size={13} /></Btn></td>
              </tr>))}</tbody></table></div>
        )}
      </Card>

      {sel && (() => {
        const ls = data.leads.filter((l) => l.name === sel.name)
        const ds = data.deals.filter((d) => d.party_name === sel.name)
        const ms = data.messages.filter((m) => m.contact_name === sel.name)
        return (
          <Modal title={sel.name} onClose={() => setSel(null)}>
            <div className="flex items-center gap-3 mb-4"><Avatar name={sel.name} size={48} /><div><Badge color={KIND_COLOR[sel.kind]}>{sel.kind}</Badge><div className="text-[13px] t-muted mt-1">{sel.phone} {sel.email ? `· ${sel.email}` : ''}</div></div></div>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div className="imo-card p-3"><div className="text-[20px] font-bold">{ls.length}</div><div className="text-[11.5px] t-muted">Leads</div></div>
              <div className="imo-card p-3"><div className="text-[20px] font-bold">{ds.length}</div><div className="text-[11.5px] t-muted">Deals</div></div>
              <div className="imo-card p-3"><div className="text-[20px] font-bold">{ms.length}</div><div className="text-[11.5px] t-muted">Messages</div></div>
            </div>
            <div className="text-[13px] flex flex-col gap-1.5">
              <div><b>Budget:</b> {sel.budget ? qar(sel.budget) : '-'}</div><div><b>Preferred areas:</b> {sel.preferred_areas ?? '-'}</div><div><b>Nationality:</b> {sel.nationality ?? '-'}</div><div><b>Agent:</b> {sel.agent ?? '-'}</div><div><b>Notes:</b> {sel.notes ?? '-'}</div>
              {ds.map((d) => <div key={d.id} className="t-muted">Deal: {d.title} · {qar(d.value)} · {d.status}</div>)}
            </div>
          </Modal>
        )
      })()}

      {edit && (
        <Modal title={edit.id ? 'Edit client' : 'Add client'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className="imo-input" value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Type"><select className="imo-select" value={edit.kind} onChange={(e) => set('kind', e.target.value)}>{CLIENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select></Field>
            <Field label="Phone"><input className="imo-input" value={edit.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+974…" /></Field>
            <Field label="Email"><input className="imo-input" value={edit.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Nationality"><input className="imo-input" value={edit.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} /></Field>
            <Field label="Budget (QAR)"><input type="number" min={0} className="imo-input" value={edit.budget ?? 0} onChange={(e) => set('budget', Number(e.target.value))} /></Field>
            <Field label="Preferred areas"><input className="imo-input" value={edit.preferred_areas ?? ''} onChange={(e) => set('preferred_areas', e.target.value)} placeholder="Lusail, The Pearl" /></Field>
            <Field label="Agent"><select className="imo-select" value={edit.agent ?? ''} onChange={(e) => set('agent', e.target.value)}><option value="">- unassigned -</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Notes"><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save client</Btn></div>
        </Modal>
      )}
    </div>
  )
}
