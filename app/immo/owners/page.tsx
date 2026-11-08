'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { UserSquare2, Plus, Search, Pencil, Trash2, MessageCircle, Clock } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import type { Owner } from '@/lib/immo-os/types'
import { qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'

const blank = (): Partial<Owner> => ({ name: '', phone: '', email: '', notes: '', responsible: null, last_contact: null })
const STALE_DAYS = 30
const toInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '')

export default function OwnersPage() {
  const { data, create, update, remove, notify, canDelete, t, tf, agents } = useImmo()
  const [q, setQ] = useState('')
  const [fResp, setFResp] = useState('')
  const [fStale, setFStale] = useState(false)
  // Texte relatif traduit (EN / FR / AR)
  const agoT = (iso?: string | null): string => {
    if (!iso) return t('o.never')
    const s = (Date.now() - new Date(iso).getTime()) / 1000
    if (s < 60) return t('ago.now')
    if (s < 3600) return tf('ago.min', { n: Math.floor(s / 60) })
    if (s < 86400) return tf('ago.h', { n: Math.floor(s / 3600) })
    if (s < 172800) return t('ago.y')
    return tf('ago.d', { n: Math.floor(s / 86400) })
  }
  // Dernier contact = date saisie / mise a jour automatiquement, ou dernier message WhatsApp echange avec ce proprietaire si plus recent
  const lastOf = (o: Owner): string | null => {
    const m = data.messages.filter((x) => x.contact_name === o.name).map((x) => x.created_at).sort().pop() ?? null
    return [o.last_contact ?? null, m].filter(Boolean).sort().pop() ?? null
  }
  const staleDays = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity)
  const respOptions = useMemo(() => Array.from(new Set([...agents, ...data.owners.map((o) => o.responsible).filter(Boolean) as string[]])), [agents, data.owners])
  const [edit, setEdit] = useState<Partial<Owner> | null>(null)
  const [sel, setSel] = useState<Owner | null>(null)

  const list = useMemo(() => data.owners
    .filter((o) => !q || `${o.name} ${o.email} ${o.phone} ${o.responsible ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((o) => !fResp || (fResp === '__none' ? !o.responsible : o.responsible === fResp))
    .filter((o) => !fStale || staleDays(lastOf(o)) >= STALE_DAYS)
    .sort((a, b) => (lastOf(a) ?? '').localeCompare(lastOf(b) ?? '')), // les moins recemment contactes d'abord
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data.owners, data.messages, q, fResp, fStale])
  const propsOf = (id: string) => data.properties.filter((p) => p.owner_id === id)
  const set = (k: keyof Owner, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const save = async () => {
    if (!edit?.name?.trim()) return notify('Name is required', 'err')
    const payload = { ...edit, last_contact: edit.last_contact ? new Date(edit.last_contact).toISOString() : null }
    if (edit.id) await update('owners', edit.id, payload)
    else await create('owners', payload)
    setEdit(null)
  }

  const markNow = async (o: Owner) => { await update('owners', o.id, { last_contact: new Date().toISOString() }); setSel((x) => (x && x.id === o.id ? { ...x, last_contact: new Date().toISOString() } : x)) }

  return (
    <div>
      <PageHead icon={<UserSquare2 size={28} />} title="Owners" sub="Property owners, their listings and communication history" right={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add owner</Btn>} />
      <Card className="mb-4"><div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[420px]"><Search size={15} className="absolute top-1/2 -translate-y-1/2 t-muted" style={{ insetInlineStart: 12 }} /><input className="imo-input" style={{ paddingInlineStart: 32 }} placeholder="Search owners…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="imo-select" style={{ width: 200 }} value={fResp} onChange={(e) => setFResp(e.target.value)} aria-label={t('o.responsible')}><option value="">{t('o.f.all')}</option><option value="__none">{t('o.f.none')}</option>{respOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <select className="imo-select" style={{ width: 220 }} value={fStale ? 'stale' : ''} onChange={(e) => setFStale(e.target.value === 'stale')} aria-label={t('o.last')}><option value="">{t('o.f.any')}</option><option value="stale">{t('o.f.stale')}</option></select>
      </div></Card>

      <Card pad={false}>
        {list.length === 0 ? <Empty title="No owners yet" sub="Add owners so you can link them to their properties." action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add owner</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>{t('o.owner')}</th><th>Phone</th><th>Email</th><th>{t('o.responsible')}</th><th>{t('o.last')}</th><th>{t('o.props')}</th><th>{t('o.port')}</th><th /></tr></thead>
            <tbody>{list.map((o) => {
              const ps = propsOf(o.id)
              return (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSel(o)}>
                  <td><div className="flex items-center gap-2"><Avatar name={o.name} size={28} /><span className="font-medium">{o.name}</span></div></td>
                  <td>{o.phone ?? '-'}</td><td className="t-muted">{o.email ?? '-'}</td>
                  <td>{o.responsible ? <span className="flex items-center gap-1.5"><Avatar name={o.responsible} size={22} />{o.responsible}</span> : <span className="t-muted">-</span>}</td>
                  <td>{(() => { const l = lastOf(o); const d = staleDays(l); return <span className="flex items-center gap-1.5 whitespace-nowrap"><span>{agoT(l)}</span>{d >= STALE_DAYS && <span title={tf('o.stale', { n: STALE_DAYS })}><Badge color="#DC2626"><Clock size={11} /> {STALE_DAYS}+</Badge></span>}</span> })()}</td>
                  <td><Badge color="#2563EB">{ps.length}</Badge> <span className="text-[11.5px] t-muted whitespace-nowrap" title={t('o.split')}>{t('o.sale')} {ps.filter((x) => x.listing === 'sale').length} · {t('o.rent')} {ps.filter((x) => x.listing === 'rent').length}</span></td>
                  <td>{qar(ps.filter((p) => p.listing === 'sale').reduce((s, p) => s + p.price, 0))}</td>
                  <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>{o.phone && <Link href={`/immo/whatsapp?c=${encodeURIComponent(o.name)}`} className="imo-btn" style={{ padding: '4px 8px' }} aria-label={t('own.chat')} title={t('own.chat')}><MessageCircle size={13} /> {data.messages.filter((m) => m.contact_name === o.name).length || ''}</Link>} 
                    <Link href="/immo/whatsapp"><Btn style={{ padding: '4px 8px' }}><MessageCircle size={13} /></Btn></Link>{' '}
                    <Btn style={{ padding: '4px 8px' }} onClick={() => markNow(o)} title={t('o.setnow')} aria-label={t('o.setnow')}><Clock size={13} /></Btn>{' '}
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
            <div className="text-[13px] t-muted mb-2">{sel.phone ?? 'No phone'} {sel.email ? `· ${sel.email}` : ''}</div>
            <div className="text-[13px] mb-3 flex flex-wrap gap-x-5 gap-y-1"><span><b>{t('o.responsible')}:</b> {sel.responsible ?? '-'}</span><span><b>{t('o.last')}:</b> {agoT(lastOf(sel))}</span><Btn style={{ padding: '3px 8px' }} onClick={() => markNow(sel)}><Clock size={12} /> {t('o.setnow')}</Btn></div>
            {sel.notes && <div className="text-[13px] mb-3">{sel.notes}</div>}
            <div className="font-semibold text-[13px] mb-1.5">Properties ({ps.length})</div>
            <div className="flex flex-col gap-1.5 mb-4">{ps.map((p) => <div key={p.id} className="flex justify-between text-[13px] imo-card p-2.5"><span>{p.title} · {p.area}</span><b>{qar(p.price)}</b></div>)}{ps.length === 0 && <div className="text-[13px] t-muted">No property linked yet.</div>}</div>
            <div className="font-semibold text-[13px] mb-1.5">Communication history</div>
            <div className="flex flex-col gap-1.5">{ms.map((m) => <div key={m.id} className="text-[12.5px] t-muted">{agoT(m.created_at)} · {m.direction === 'in' ? 'Received' : 'Sent'}: {m.body}</div>)}{ms.length === 0 && <div className="text-[13px] t-muted">No messages recorded.</div>}</div>
          </Modal>
        )
      })()}

      {edit && (
        <Modal title={edit.id ? 'Edit owner' : 'Add owner'} onClose={() => setEdit(null)}>
          <div className="grid gap-3">
            <Field label="Name *"><input className="imo-input" value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Phone"><input className="imo-input" value={edit.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+974…" /></Field>
            <Field label="Email"><input className="imo-input" value={edit.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label={t('o.responsible')}><select className="imo-select" value={edit.responsible ?? ''} onChange={(e) => set('responsible', e.target.value || null)}><option value="">{t('o.none')}</option>{respOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
            <Field label={t('o.last')}><input type="date" className="imo-input" value={toInput(edit.last_contact)} onChange={(e) => set('last_contact', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : null)} dir="ltr" /><div className="text-[12px] t-muted mt-1">{t('o.auto')}</div></Field>
            <Field label="Notes"><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save owner</Btn></div>
        </Modal>
      )}
    </div>
  )
}
