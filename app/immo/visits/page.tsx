'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Pencil, Trash2, CalendarPlus, MessageCircle, Check, X } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { supabase } from '@/lib/supabase'
import { Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { VISIT_STATUSES, type Visit } from '@/lib/immo-os/types'
import { confirmationText, findConflict, fromLocalInput, toLocalInput } from '@/lib/immo-os/visits'
import { confirmDelete } from '@/lib/immo-os/hooks'

type Draft = Partial<Visit> & { local?: string }
const meta = (s: string) => VISIT_STATUSES.find((x) => x.v === s)!

export default function VisitsPage() {
  const { data, agents, me, create, update, remove, sendWhatsapp, notify, mode } = useImmo()
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming')
  const [edit, setEdit] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const isManager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)

  const now = Date.now()
  const list = useMemo(() => {
    const sorted = [...data.visits].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    if (tab === 'upcoming') return sorted.filter((v) => new Date(v.starts_at).getTime() + v.duration_min * 60000 >= now && v.status === 'scheduled')
    if (tab === 'past') return sorted.filter((v) => !(new Date(v.starts_at).getTime() + v.duration_min * 60000 >= now && v.status === 'scheduled')).reverse()
    return sorted
  }, [data.visits, tab, now])

  const groups = useMemo(() => {
    const g: Record<string, Visit[]> = {}
    list.forEach((v) => { const k = new Date(v.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); (g[k] = g[k] ?? []).push(v) })
    return Object.entries(g)
  }, [list])

  const propOf = (id?: string | null) => data.properties.find((p) => p.id === id)
  const blank = (): Draft => {
    const d = new Date(Date.now() + 86400000)
    d.setHours(16, 0, 0, 0)
    return { contact_name: '', contact_phone: '', property_id: null, lead_id: null, agent: me?.name ?? '', duration_min: 45, status: 'scheduled', notes: '', local: toLocalInput(d.toISOString()) }
  }
  const conflict = edit?.local && edit.agent ? findConflict(data.visits, edit.agent, fromLocalInput(edit.local), Number(edit.duration_min) || 45, edit.id) : null

  const pickLead = (id: string) => {
    const l = data.leads.find((x) => x.id === id)
    setEdit((e) => ({ ...e, lead_id: id || null, ...(l ? { contact_name: l.name, contact_phone: l.phone ?? '', property_id: l.property_id ?? e?.property_id ?? null, agent: e?.agent || l.agent || '' } : {}) }))
  }

  const save = async () => {
    if (!edit?.contact_name?.trim()) return notify('Client name is required', 'err')
    if (!edit.local) return notify('Choose a date and time', 'err')
    const { local, ...rest } = edit
    const row = { ...rest, starts_at: fromLocalInput(local), duration_min: Number(rest.duration_min) || 45 }
    if (edit.id) await update('visits', edit.id, row)
    else await create('visits', row)
    if (edit.lead_id && !edit.id) {
      const l = data.leads.find((x) => x.id === edit.lead_id)
      if (l && ['new', 'qualified'].includes(l.status)) await update('leads', l.id, { status: 'viewing' })
    }
    setEdit(null)
  }

  const toCalendar = async (v: Visit) => {
    if (mode === 'demo') return notify('Google Calendar needs the live database (run migrations 70 and 72).', 'err')
    setBusy(v.id)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/immo?r=visits/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` }, body: JSON.stringify({ visitId: v.id }) })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return notify(json.error ?? 'Could not add to Google Calendar', 'err')
    await update('visits', v.id, { calendar_event_id: 'synced' })
    notify('Added to Google Calendar')
  }

  const confirmWa = async (v: Visit) => {
    const p = propOf(v.property_id)
    await sendWhatsapp(v.contact_name, v.contact_phone, confirmationText(v, p?.title ?? null, p?.area ?? null, v.agent ?? null))
  }

  return (
    <div>
      <PageHead icon={<CalendarDays size={28} />} title="Visits" sub="Schedule viewings, avoid double-booking and confirm by WhatsApp" right={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Schedule visit</Btn>} />
      <Card className="mb-4"><div className="flex gap-2">{(['upcoming', 'past', 'all'] as const).map((t) => <Btn key={t} onClick={() => setTab(t)} style={tab === t ? { borderColor: 'var(--gold)' } : undefined}>{t[0].toUpperCase() + t.slice(1)}</Btn>)}</div></Card>

      {groups.length === 0 && <Card><Empty title={tab === 'upcoming' ? 'No upcoming visits' : 'No visits'} action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Schedule visit</Btn>} /></Card>}
      <div className="flex flex-col gap-4">
        {groups.map(([day, vs]) => (
          <div key={day}>
            <div className="text-[13px] font-semibold mb-2 t-muted">{day}</div>
            <div className="flex flex-col gap-2.5">
              {vs.map((v) => {
                const p = propOf(v.property_id)
                const time = new Date(v.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <Card key={v.id}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-[18px] font-bold w-[64px]">{time}</div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{v.contact_name} <Badge color={meta(v.status).color}>{meta(v.status).l}</Badge>{v.calendar_event_id && <span className="ml-2"><Badge color="#16A34A">In Google Calendar</Badge></span>}</div>
                        <div className="text-[12.5px] t-muted">{p ? `${p.title} · ${p.area}` : 'No property selected'} · {v.duration_min} min{v.agent ? ` · ${v.agent}` : ''}{v.notes ? ` · ${v.notes}` : ''}</div>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {v.status === 'scheduled' && <>
                          <Btn style={{ padding: '5px 9px' }} onClick={() => confirmWa(v)} title="Send WhatsApp confirmation"><MessageCircle size={13} /> Confirm</Btn>
                          {!v.calendar_event_id && <Btn style={{ padding: '5px 9px' }} disabled={busy === v.id} onClick={() => toCalendar(v)}><CalendarPlus size={13} /> {busy === v.id ? 'Adding…' : 'Calendar'}</Btn>}
                          <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'done' })} title="Mark as done"><Check size={13} /></Btn>
                          <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'no_show' })} title="No-show"><X size={13} /></Btn>
                        </>}
                        <Btn style={{ padding: '5px 9px' }} onClick={() => setEdit({ ...v, local: toLocalInput(v.starts_at) })} aria-label="Edit"><Pencil size={13} /></Btn>
                        {v.status === 'scheduled' && <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'cancelled' })}>Cancel</Btn>}
                        {isManager && <Btn kind="danger" style={{ padding: '5px 9px' }} aria-label="Delete" onClick={() => confirmDelete('this visit') && remove('visits', v.id)}><Trash2 size={13} /></Btn>}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit visit' : 'Schedule visit'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="From a lead (fills name, phone and property)"><select className="imo-select" value={edit.lead_id ?? ''} onChange={(e) => pickLead(e.target.value)}><option value="">- none -</option>{data.leads.filter((l) => !['won', 'lost'].includes(l.status)).map((l) => <option key={l.id} value={l.id}>{l.name}{l.interest ? ` · ${l.interest}` : ''}</option>)}</select></Field></div>
            <Field label="Client name *"><input className="imo-input" value={edit.contact_name ?? ''} onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })} /></Field>
            <Field label="Phone (for the WhatsApp confirmation)"><input className="imo-input" value={edit.contact_phone ?? ''} onChange={(e) => setEdit({ ...edit, contact_phone: e.target.value })} placeholder="+974…" /></Field>
            <div className="sm:col-span-2"><Field label="Property"><select className="imo-select" value={edit.property_id ?? ''} onChange={(e) => setEdit({ ...edit, property_id: e.target.value || null })}><option value="">- none -</option>{data.properties.filter((p) => p.status === 'available' || p.id === edit.property_id).map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area}</option>)}</select></Field></div>
            <Field label="Date & time *"><input type="datetime-local" className="imo-input" value={edit.local ?? ''} onChange={(e) => setEdit({ ...edit, local: e.target.value })} /></Field>
            <Field label="Duration (minutes)"><input type="number" min={10} max={480} step={5} className="imo-input" value={edit.duration_min ?? 45} onChange={(e) => setEdit({ ...edit, duration_min: Number(e.target.value) })} /></Field>
            <Field label="Agent"><select className="imo-select" value={edit.agent ?? ''} disabled={!isManager} onChange={(e) => setEdit({ ...edit, agent: e.target.value })}><option value="">- unassigned -</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Status"><select className="imo-select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Visit['status'] })}>{VISIT_STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label="Notes"><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field></div>
          </div>
          {conflict && <div className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: '#FEF3C7', color: '#92400E' }}>Heads up: {conflict.agent} already has a visit at {new Date(conflict.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} with {conflict.contact_name} that overlaps this slot. You can still save.</div>}
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save visit</Btn></div>
        </Modal>
      )}
    </div>
  )
}
