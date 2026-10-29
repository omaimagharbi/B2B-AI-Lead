'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { UserSquare2, Plus, Search, Pencil, Trash2, MessageCircle } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import type { Owner } from '@/lib/immo-os/types'
import { ago, qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'

const blank = (): Partial<Owner> => ({ name: '', phone: '', email: '', notes: '' })

export default function OwnersPage() {
  const { data, create, update, remove, notify, canDelete } = useImmo()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Owner> | null>(null)
  const [sel, setSel] = useState<Owner | null>(null)

  const list = useMemo(() => data.owners.filter((o) => !q || `${o.name} ${o.email} ${o.phone}`.toLowerCase().includes(q.toLowerCase())), [data.owners, q])
  const propsOf = (id: string) => data.properties.filter((p) => p.owner_id === id)
  const set = (k: keyof Owner, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const save = async () => {
    if (!edit?.name?.trim()) return notify('Name is required', 'err')
    if (edit.id) await update('owners', edit.id, edit)
    else await create('owners', edit)
    setEdit(null)
  }

  return (
    <div>
      <PageHead icon={<UserSquare2 size={28} />} title="Owners" sub="Property owners, their listings and communication history" right={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add owner</Btn>} />
      <Card className="mb-4"><div className="relative max-w-[420px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 32 }} placeholder="Search owners…" value={q} onChange={(e) => setQ(e.target.value)} /></div></Card>

      <Card pad={false}>
        {list.length === 0 ? <Empty title="No owners yet" sub="Add owners so you can link them to their properties." action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add owner</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>Owner</th><th>Phone</th><th>Email</th><th>Properties</th><th>Portfolio value</th><th /></tr></thead>
            <tbody>{list.map((o) => {
              const ps = propsOf(o.id)
              return (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSel(o)}>
                  <td><div className="flex items-center gap-2"><Avatar name={o.name} size={28} /><span className="font-medium">{o.name}</span></div></td>
                  <td>{o.phone ?? '-'}</td><td className="t-muted">{o.email ?? '-'}</td><td><Badge color="#2563EB">{ps.length}</Badge></td>
                  <td>{qar(ps.filter((p) => p.listing === 'sale').reduce((s, p) => s + p.price, 0))}</td>
                  <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Link href="/immo/whatsapp"><Btn style={{ padding: '4px 8px' }}><MessageCircle size={13} /></Btn></Link>{' '}
                    <Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(o)}><Pencil size={13} /></Btn>{' '}
                    {canDelete && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(`owner "${o.name}"`) && remove('owners', o.id)}><Trash2 size={13} /></Btn>}
                  </td>
                </tr>
              )
            })}</tbody></table></div>
        )}
      </Card>

      {sel && (() => {
        const ps = propsOf(sel.id)
        const ms = data.messages.filter((m) => m.contact_name === sel.name).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
        return (
          <Modal title={sel.name} onClose={() => setSel(null)}>
            <div className="text-[13px] t-muted mb-3">{sel.phone ?? 'No phone'} {sel.email ? `· ${sel.email}` : ''}</div>
            {sel.notes && <div className="text-[13px] mb-3">{sel.notes}</div>}
            <div className="font-semibold text-[13px] mb-1.5">Properties ({ps.length})</div>
            <div className="flex flex-col gap-1.5 mb-4">{ps.map((p) => <div key={p.id} className="flex justify-between text-[13px] imo-card p-2.5"><span>{p.title} · {p.area}</span><b>{qar(p.price)}</b></div>)}{ps.length === 0 && <div className="text-[13px] t-muted">No property linked yet.</div>}</div>
            <div className="font-semibold text-[13px] mb-1.5">Communication history</div>
            <div className="flex flex-col gap-1.5">{ms.map((m) => <div key={m.id} className="text-[12.5px] t-muted">{ago(m.created_at)} · {m.direction === 'in' ? 'Received' : 'Sent'}: {m.body}</div>)}{ms.length === 0 && <div className="text-[13px] t-muted">No messages recorded.</div>}</div>
          </Modal>
        )
      })()}

      {edit && (
        <Modal title={edit.id ? 'Edit owner' : 'Add owner'} onClose={() => setEdit(null)}>
          <div className="grid gap-3">
            <Field label="Name *"><input className="imo-input" value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Phone"><input className="imo-input" value={edit.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+974…" /></Field>
            <Field label="Email"><input className="imo-input" value={edit.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Notes"><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save owner</Btn></div>
        </Modal>
      )}
    </div>
  )
}
