'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, CalendarDays, Target, Plus, Search, Flame, Phone, Pencil, Trash2, UserCheck, Handshake, MessageCircle } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { LEAD_COLUMNS, SOURCES, type Lead, type LeadStatus } from '@/lib/immo-os/types'
import { ago, isHot, qar, scoreLead } from '@/lib/immo-os/helpers'
import { confirmDelete, useQueryParam } from '@/lib/immo-os/hooks'

const blank = (agent = ''): Partial<Lead> => ({ name: '', phone: '', email: '', interest: '', property_id: null, budget: 0, status: 'new', source: 'whatsapp', agent, notes: '' })

export default function LeadsPage() {
  const { data, agents, create, update, remove, notify, me, callApi, reload, mode } = useImmo()
  const manager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)
  const [imp, setImp] = useState<{ items: any[]; sel: Set<string>; busy: boolean } | null>(null)
  const openImport = async () => {
    if (mode === 'demo') return notify('Prospect import needs the live database (run migrations 70 and 72).', 'err')
    const r = await callApi('/api/immo?r=targets')
    if (!r.ok) return notify(r.json?.error ?? 'Could not load prospects', 'err')
    setImp({ items: r.json.items, sel: new Set(), busy: false })
  }
  const doImport = async () => {
    if (!imp || imp.sel.size === 0) return
    setImp({ ...imp, busy: true })
    const r = await callApi('/api/immo?r=targets', { method: 'POST', body: JSON.stringify({ ids: Array.from(imp.sel) }) })
    if (!r.ok) { setImp({ ...imp, busy: false }); return notify(r.json?.error ?? 'Import failed', 'err') }
    notify(`${r.json.imported} prospect(s) imported${r.json.skipped ? `, ${r.json.skipped} skipped (already leads)` : ''}`)
    setImp(null)
    await reload()
  }
  const [q, setQ] = useState('')
  const [agent, setAgent] = useState('')
  const [edit, setEdit] = useState<Partial<Lead> | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<LeadStatus | null>(null)
  const wantNew = useQueryParam('new')
  useEffect(() => { if (wantNew) setEdit(blank()) }, [wantNew])

  const list = useMemo(() => data.leads.filter((l) => (!q || `${l.name} ${l.interest}`.toLowerCase().includes(q.toLowerCase())) && (!agent || l.agent === agent)), [data.leads, q, agent])

  const move = async (id: string, status: LeadStatus) => {
    const l = data.leads.find((x) => x.id === id)
    if (!l || l.status === status) return
    await update('leads', id, { status, score: scoreLead({ ...l, status }, data.properties) })
  }

  const save = async () => {
    if (!edit?.name?.trim()) return notify('Name is required', 'err')
    const base = { ...edit, last_contact: edit.last_contact ?? new Date().toISOString() } as Lead
    const score = scoreLead({ budget: Number(base.budget) || 0, status: (base.status ?? 'new') as LeadStatus, last_contact: base.last_contact, source: base.source ?? 'whatsapp' }, data.properties)
    if (edit.id) await update('leads', edit.id, { ...edit, score })
    else await create('leads', { ...edit, score, last_contact: new Date().toISOString() })
    setEdit(null)
  }

  const toClient = async (l: Lead) => {
    if (data.clients.some((c) => c.name === l.name)) return notify('Already a client')
    await create('clients', { name: l.name, phone: l.phone, email: l.email, kind: 'buyer', budget: l.budget, agent: l.agent, notes: l.interest })
    notify(`${l.name} added to clients`)
  }
  const toDeal = async (l: Lead) => {
    const p = data.properties.find((x) => x.id === l.property_id)
    await create('deals', { title: p ? `${p.title} - ${p.area}` : l.interest || 'New deal', property_id: l.property_id, party_name: l.name, kind: p?.listing ?? 'sale', value: p?.price ?? l.budget, commission_pct: p?.listing === 'rent' ? 8 : 2, status: 'negotiation', agent: l.agent })
    await move(l.id, 'negotiation')
    notify('Deal created in Deals')
  }
  const touch = (l: Lead) => update('leads', l.id, { last_contact: new Date().toISOString(), score: scoreLead({ ...l, last_contact: new Date().toISOString() }, data.properties) })
  const set = (k: keyof Lead, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  return (
    <div>
      <PageHead icon={<Target size={28} />} title="Leads" sub="Drag a card to move it through your pipeline" right={<>{manager && <Btn onClick={openImport}><Download size={15} /> Import prospects</Btn>}<Link href="/immo/visits"><Btn><CalendarDays size={15} /> Visits</Btn></Link><Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add lead</Btn></>} />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 32 }} placeholder="Search lead or interest…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="imo-select" style={{ width: 190 }} value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">All agents</option>{agents.map((a) => <option key={a}>{a}</option>)}</select>
        </div>
      </Card>

      <div className="flex gap-3 overflow-x-auto imo-scroll pb-3">
        {LEAD_COLUMNS.map((col) => {
          const items = list.filter((l) => l.status === col.v)
          return (
            <div key={col.v} className={`imo-kanban-col shrink-0 w-[270px] rounded-2xl p-2.5 ${over === col.v ? 'drag-over' : ''}`} style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}
              onDragOver={(e) => { e.preventDefault(); setOver(col.v) }} onDragLeave={() => setOver(null)}
              onDrop={() => { setOver(null); if (drag) move(drag, col.v); setDrag(null) }}>
              <div className="flex items-center justify-between px-1.5 py-1 mb-2"><div className="flex items-center gap-2 font-semibold text-[13px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />{col.l}</div><span className="text-[12px] t-muted">{items.length}</span></div>
              <div className="flex flex-col gap-2.5 min-h-[60px]">
                {items.map((l) => {
                  const p = data.properties.find((x) => x.id === l.property_id)
                  return (
                    <div key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => { setDrag(null); setOver(null) }} className="imo-card p-3 cursor-grab text-[12.5px]">
                      <div className="flex items-center gap-2"><Avatar name={l.name} size={28} /><div className="min-w-0 flex-1"><div className="font-semibold text-[13px] truncate">{l.name}</div><div className="t-muted truncate">{p ? `${p.title} · ${p.area}` : l.interest || '-'}</div></div>
                        {isHot(l) && <Badge color="#EF4444"><Flame size={11} className="mr-0.5" />Hot</Badge>}</div>
                      <div className="flex items-center justify-between mt-2"><b>{qar(l.budget)}</b><span className="t-muted">{ago(l.last_contact)}</span></div>
                      <div className="flex items-center gap-2 mt-1.5"><div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full" style={{ width: `${l.score}%`, background: l.score >= 75 ? '#16A34A' : l.score >= 50 ? '#2563EB' : '#94A3B8' }} /></div><span className="t-muted text-[11px]">AI score {l.score}</span></div>
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {l.phone && <a href={`tel:${l.phone}`} onClick={() => touch(l)} className="imo-btn" style={{ padding: '3px 7px' }} aria-label="Call"><Phone size={12} /></a>}
                        <Link href="/immo/whatsapp" className="imo-btn" style={{ padding: '3px 7px' }} aria-label="WhatsApp"><MessageCircle size={12} /></Link>
                        <Btn style={{ padding: '3px 7px' }} onClick={() => toClient(l)} title="Convert to client" aria-label="Convert to client"><UserCheck size={12} /></Btn>
                        <Btn style={{ padding: '3px 7px' }} onClick={() => toDeal(l)} title="Create deal" aria-label="Create deal"><Handshake size={12} /></Btn>
                        <Btn style={{ padding: '3px 7px' }} onClick={() => setEdit(l)} aria-label="Edit"><Pencil size={12} /></Btn>
                        <Btn kind="danger" style={{ padding: '3px 7px' }} onClick={() => confirmDelete(`lead "${l.name}"`) && remove('leads', l.id)} aria-label="Delete"><Trash2 size={12} /></Btn>
                      </div>
                      {l.agent && <div className="t-muted text-[11px] mt-1.5">Agent: {l.agent}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit lead' : 'Add lead'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *"><input className="imo-input" value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Phone (with country code)"><input className="imo-input" value={edit.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+974…" /></Field>
            <Field label="Email"><input className="imo-input" value={edit.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Budget (QAR)"><input type="number" min={0} className="imo-input" value={edit.budget ?? 0} onChange={(e) => set('budget', Number(e.target.value))} /></Field>
            <Field label="Interest"><input className="imo-input" value={edit.interest ?? ''} onChange={(e) => set('interest', e.target.value)} placeholder="Villa - Lusail" /></Field>
            <Field label="Linked property"><select className="imo-select" value={edit.property_id ?? ''} onChange={(e) => set('property_id', e.target.value || null)}><option value="">- none -</option>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area}</option>)}</select></Field>
            <Field label="Status"><select className="imo-select" value={edit.status} onChange={(e) => set('status', e.target.value)}>{LEAD_COLUMNS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></Field>
            <Field label="Source"><select className="imo-select" value={edit.source} onChange={(e) => set('source', e.target.value)}>{SOURCES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></Field>
            <Field label="Assigned agent"><select className="imo-select" value={edit.agent ?? ''} onChange={(e) => set('agent', e.target.value)}><option value="">- unassigned -</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Notes"><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save lead</Btn></div>
        </Modal>
      )}

      {imp && (
        <Modal title="Import prospects from B2B prospecting" onClose={() => setImp(null)} wide>
          <div className="text-[13px] t-muted mb-3">Prospects with a phone number from your prospecting engine. Already-imported contacts are greyed out so no duplicate lead is created.</div>
          <div className="imo-scroll" style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            {imp.items.length === 0 && <div className="p-4 text-[13px] t-muted">No prospect with a phone number yet.</div>}
            {imp.items.map((t) => (
              <label key={t.id} className="flex items-center gap-3 px-3 py-2 text-[13px]" style={{ borderBottom: '1px solid var(--border)', opacity: t.imported ? 0.45 : 1 }}>
                <input type="checkbox" disabled={t.imported} checked={imp.sel.has(t.id)} onChange={(e) => { const n = new Set(imp.sel); e.target.checked ? n.add(t.id) : n.delete(t.id); setImp({ ...imp, sel: n }) }} />
                <span className="flex-1 min-w-0"><b>{t.nom}</b> <span className="t-muted">· {[t.poste_ou_budget, t.entreprise_ou_objectif].filter(Boolean).join(' - ') || '-'}</span></span>
                <span className="t-muted">{t.telephone}</span>{t.imported && <Badge color="#64748B">Already a lead</Badge>}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4"><span className="text-[13px] t-muted">{imp.sel.size} selected (max 50)</span><div className="flex gap-2"><Btn onClick={() => setImp(null)}>Cancel</Btn><Btn kind="primary" disabled={imp.sel.size === 0 || imp.busy} onClick={doImport}>{imp.busy ? 'Importing…' : 'Import as leads'}</Btn></div></div>
        </Modal>
      )}
    </div>
  )
}
