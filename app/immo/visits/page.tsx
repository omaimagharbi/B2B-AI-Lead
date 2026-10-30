'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CalendarPlus, MessageCircle, Check, X } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { VISIT_CATEGORIES, VISIT_STATUSES, type Visit, type VisitCategory } from '@/lib/immo-os/types'
import { confirmationText, findConflict, fromLocalInput, toLocalInput } from '@/lib/immo-os/visits'
import { dayKey, groupByDay, isWeekend, monthGrid, shiftMonth, weekDays } from '@/lib/immo-os/calendar'
import { confirmDelete } from '@/lib/immo-os/hooks'

type Draft = Partial<Visit> & { local?: string }
type View = 'month' | 'week' | 'list'
const cat = (v: Visit) => VISIT_CATEGORIES.find((c) => c.v === (v.category ?? 'viewing')) ?? VISIT_CATEGORIES[0]
const stat = (s: string) => VISIT_STATUSES.find((x) => x.v === s)!
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function VisitsPage() {
  const { data, agents, me, create, update, remove, sendWhatsapp, notify, mode, callApi, canDelete } = useImmo()
  const today = new Date()
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth(), ref: today })
  const [hidden, setHidden] = useState<Set<VisitCategory>>(new Set())
  const [agentFilter, setAgentFilter] = useState('')
  const [edit, setEdit] = useState<Draft | null>(null)
  const [dayOpen, setDayOpen] = useState<Date | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const isManager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)

  const visible = useMemo(() => data.visits.filter((v) => !hidden.has((v.category ?? 'viewing') as VisitCategory) && (!agentFilter || v.agent === agentFilter)), [data.visits, hidden, agentFilter])
  const byDay = useMemo(() => groupByDay(visible), [visible])
  const list = useMemo(() => Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)), [byDay])
  const propOf = (id?: string | null) => data.properties.find((p) => p.id === id)

  const blank = (d?: Date): Draft => {
    const start = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0) : (() => { const x = new Date(Date.now() + 86400000); x.setHours(16, 0, 0, 0); return x })()
    return { contact_name: '', contact_phone: '', property_id: null, lead_id: null, agent: me?.name ?? '', duration_min: 45, category: 'viewing', status: 'scheduled', notes: '', local: toLocalInput(start.toISOString()) }
  }
  const conflict = edit?.local && edit.agent && (edit.category ?? 'viewing') !== 'call' ? findConflict(data.visits, edit.agent, fromLocalInput(edit.local), Number(edit.duration_min) || 45, edit.id) : null

  const pickLead = (id: string) => {
    const l = data.leads.find((x) => x.id === id)
    setEdit((e) => ({ ...e, lead_id: id || null, ...(l ? { contact_name: l.name, contact_phone: l.phone ?? '', property_id: l.property_id ?? e?.property_id ?? null, agent: e?.agent || l.agent || '' } : {}) }))
  }
  const save = async () => {
    if (!edit?.contact_name?.trim()) return notify('Name is required', 'err')
    if (!edit.local) return notify('Choose a date and time', 'err')
    const { local, ...rest } = edit
    const row = { ...rest, starts_at: fromLocalInput(local), duration_min: Number(rest.duration_min) || 45 }
    if (edit.id) await update('visits', edit.id, row)
    else await create('visits', row)
    if (edit.lead_id && !edit.id && (edit.category ?? 'viewing') === 'viewing') {
      const l = data.leads.find((x) => x.id === edit.lead_id)
      if (l && ['new', 'qualified'].includes(l.status)) await update('leads', l.id, { status: 'viewing' })
    }
    setEdit(null)
  }
  const toCalendar = async (v: Visit) => {
    if (mode === 'demo') return notify('Google Calendar needs the live database (run migrations 70 and 72).', 'err')
    setBusy(v.id)
    const r = await callApi('/api/immo?r=visits/calendar', { method: 'POST', body: JSON.stringify({ visitId: v.id }) })
    setBusy(null)
    if (!r.ok) return notify(r.json?.error ?? 'Could not add to Google Calendar', 'err')
    await update('visits', v.id, { calendar_event_id: 'synced' })
    notify('Added to Google Calendar')
  }
  const confirmWa = async (v: Visit) => {
    const p = propOf(v.property_id)
    await sendWhatsapp(v.contact_name, v.contact_phone, confirmationText(v, p?.title ?? null, p?.area ?? null, v.agent ?? null))
  }
  const toggleCat = (c: VisitCategory) => setHidden((h) => { const n = new Set(h); n.has(c) ? n.delete(c) : n.add(c); return n })

  const go = (delta: number) => {
    if (view === 'week') { const r = new Date(cursor.ref.getFullYear(), cursor.ref.getMonth(), cursor.ref.getDate() + delta * 7); setCursor({ year: r.getFullYear(), month: r.getMonth(), ref: r }) }
    else { const m = shiftMonth(cursor.year, cursor.month, delta); setCursor({ ...m, ref: new Date(m.year, m.month, 1) }) }
  }
  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth(), ref: today })
  const title = view === 'week'
    ? (() => { const w = weekDays(cursor.ref); return `${w[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${w[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` })()
    : new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const chip = (v: Visit, full = false) => {
    const c = cat(v)
    const off = v.status === 'cancelled' || v.status === 'no_show'
    return (
      <button key={v.id} onClick={(e) => { e.stopPropagation(); setEdit({ ...v, local: toLocalInput(v.starts_at) }) }} title={`${c.l} · ${v.contact_name}`}
        className="w-full text-left rounded-md px-1.5 py-1 text-[11.5px] leading-tight block truncate"
        style={{ background: c.bg, color: c.color, borderLeft: `3px solid ${c.color}`, opacity: off ? 0.55 : 1, textDecoration: off ? 'line-through' : 'none', fontWeight: 600 }}>
        {v.status === 'done' ? '✓ ' : ''}{hhmm(v.starts_at)} {v.contact_name}
        {full && <span style={{ fontWeight: 400, display: 'block' }}>{propOf(v.property_id)?.title ?? c.l}{v.agent ? ` · ${v.agent}` : ''}</span>}
      </button>
    )
  }

  const row = (v: Visit) => {
    const p = propOf(v.property_id)
    const c = cat(v)
    return (
      <Card key={v.id} style={{ borderLeft: `4px solid ${c.color}` }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-[18px] font-bold w-[64px]">{hhmm(v.starts_at)}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{v.contact_name} <Badge color={c.color}>{c.l}</Badge> <Badge color={stat(v.status).color}>{stat(v.status).l}</Badge>{v.calendar_event_id && <span className="ml-1"><Badge color="#16A34A">In Google Calendar</Badge></span>}</div>
            <div className="text-[12.5px] t-muted">{p ? `${p.title} · ${p.area}` : 'No property selected'} · {v.duration_min} min{v.agent ? ` · ${v.agent}` : ''}{v.notes ? ` · ${v.notes}` : ''}</div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {v.status === 'scheduled' && <>
              {v.contact_phone && <Btn style={{ padding: '5px 9px' }} onClick={() => confirmWa(v)} title="Send WhatsApp confirmation"><MessageCircle size={13} /> Confirm</Btn>}
              {!v.calendar_event_id && <Btn style={{ padding: '5px 9px' }} disabled={busy === v.id} onClick={() => toCalendar(v)}><CalendarPlus size={13} /> {busy === v.id ? 'Adding…' : 'Google Calendar'}</Btn>}
              <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'done' })} title="Mark as done"><Check size={13} /></Btn>
              <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'no_show' })} title="No-show"><X size={13} /></Btn>
            </>}
            <Btn style={{ padding: '5px 9px' }} onClick={() => { setDayOpen(null); setEdit({ ...v, local: toLocalInput(v.starts_at) }) }} aria-label="Edit"><Pencil size={13} /></Btn>
            {v.status === 'scheduled' && <Btn style={{ padding: '5px 9px' }} onClick={() => update('visits', v.id, { status: 'cancelled' })}>Cancel</Btn>}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div>
      <PageHead icon={<CalendarDays size={28} />} title="Calendar" sub="Viewings, meetings, signings and calls - colour-coded by category"
        right={<>
          <div className="flex gap-1">{(['month', 'week', 'list'] as View[]).map((v) => <Btn key={v} onClick={() => setView(v)} style={view === v ? { borderColor: 'var(--gold)', fontWeight: 700 } : undefined}>{v[0].toUpperCase() + v.slice(1)}</Btn>)}</div>
          <Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> New event</Btn>
        </>} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {view !== 'list' && (
            <div className="flex items-center gap-1.5">
              <Btn onClick={() => go(-1)} aria-label="Previous" style={{ padding: '6px 9px' }}><ChevronLeft size={16} /></Btn>
              <Btn onClick={goToday}>Today</Btn>
              <Btn onClick={() => go(1)} aria-label="Next" style={{ padding: '6px 9px' }}><ChevronRight size={16} /></Btn>
              <div className="font-bold text-[16px] ml-2 min-w-[150px]">{title}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {VISIT_CATEGORIES.map((c) => {
              const on = !hidden.has(c.v)
              return (
                <button key={c.v} onClick={() => toggleCat(c.v)} aria-pressed={on} className="rounded-full px-3 py-1 text-[12px] font-semibold flex items-center gap-1.5"
                  style={{ background: on ? c.bg : 'transparent', color: on ? c.color : 'var(--muted)', border: `1px solid ${on ? c.color : 'var(--border)'}` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color, opacity: on ? 1 : 0.35 }} />{c.l}
                </button>
              )
            })}
          </div>
          {isManager && <select aria-label="Filter by agent" className="imo-select" style={{ width: 180 }} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}><option value="">All agents</option>{agents.map((a) => <option key={a}>{a}</option>)}</select>}
        </div>
      </Card>

      {view === 'month' && (
        <Card pad={false} style={{ overflow: 'hidden' }}>
          <div className="overflow-x-auto imo-scroll"><div style={{ minWidth: 760 }}>
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
              {DOW.map((d, i) => <div key={d} className="text-center text-[12px] font-semibold py-2 t-muted" style={{ background: i === 5 || i === 6 ? 'var(--soft)' : undefined }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid(cursor.year, cursor.month).map((d) => {
                const k = dayKey(d)
                const evs = byDay[k] ?? []
                const inMonth = d.getMonth() === cursor.month
                const isToday = k === dayKey(today)
                return (
                  <div key={k} role="button" tabIndex={0} aria-label={`${d.toDateString()}, ${evs.length} events`} onClick={() => setEdit(blank(d))} onKeyDown={(e) => e.key === 'Enter' && setEdit(blank(d))}
                    className="p-1.5 cursor-pointer" style={{ minHeight: 104, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: isWeekend(d) ? 'var(--soft)' : undefined, opacity: inMonth ? 1 : 0.5 }}>
                    <div className="flex justify-end mb-1"><span className="text-[12px] font-semibold rounded-full w-6 h-6 flex items-center justify-center" style={isToday ? { background: 'var(--gold)', color: '#0B2447' } : undefined}>{d.getDate()}</span></div>
                    <div className="flex flex-col gap-1">
                      {evs.slice(0, 3).map((v) => chip(v))}
                      {evs.length > 3 && <button onClick={(e) => { e.stopPropagation(); setDayOpen(d) }} className="text-[11.5px] font-semibold text-left" style={{ color: 'var(--blue)' }}>+{evs.length - 3} more</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div></div>
        </Card>
      )}

      {view === 'week' && (
        <div className="overflow-x-auto imo-scroll"><div className="grid grid-cols-7 gap-2" style={{ minWidth: 900 }}>
          {weekDays(cursor.ref).map((d) => {
            const k = dayKey(d)
            const isToday = k === dayKey(today)
            return (
              <Card key={k} pad={false} style={{ background: isWeekend(d) ? 'var(--soft)' : undefined, borderColor: isToday ? 'var(--gold)' : undefined }}>
                <button onClick={() => setEdit(blank(d))} className="w-full text-left px-2.5 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-[12.5px] font-bold">{DOW[d.getDay()]} {d.getDate()}</span><Plus size={13} className="t-muted" />
                </button>
                <div className="p-2 flex flex-col gap-1.5 min-h-[180px]">
                  {(byDay[k] ?? []).map((v) => chip(v, true))}
                  {!(byDay[k] ?? []).length && <div className="text-[12px] t-muted text-center pt-4">-</div>}
                </div>
              </Card>
            )
          })}
        </div></div>
      )}

      {view === 'list' && (
        <div className="flex flex-col gap-4">
          {list.length === 0 && <Card><Empty title="No events" action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> New event</Btn>} /></Card>}
          {list.map(([k, vs]) => (
            <div key={k}>
              <div className="text-[13px] font-semibold mb-2 t-muted">{new Date(vs[0].starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
              <div className="flex flex-col gap-2.5">{vs.map((v) => row(v))}</div>
            </div>
          ))}
        </div>
      )}

      {dayOpen && (
        <Modal title={dayOpen.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setDayOpen(null)} wide>
          <div className="flex flex-col gap-2">{(byDay[dayKey(dayOpen)] ?? []).map((v) => row(v))}</div>
          <div className="mt-4"><Btn kind="primary" onClick={() => { const d = dayOpen; setDayOpen(null); setEdit(blank(d)) }}><Plus size={14} /> Add event this day</Btn></div>
        </Modal>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit event' : 'New event'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="imo-label">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {VISIT_CATEGORIES.map((c) => { const on = (edit.category ?? 'viewing') === c.v; return (
                  <button key={c.v} type="button" aria-pressed={on} onClick={() => setEdit({ ...edit, category: c.v })} className="rounded-full px-3 py-1 text-[12.5px] font-semibold"
                    style={{ background: on ? c.bg : 'transparent', color: on ? c.color : 'var(--muted)', border: `1.5px solid ${on ? c.color : 'var(--border)'}` }}>{c.l}</button>) })}
              </div>
            </div>
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
          {conflict && <div className="mt-3 rounded-lg px-3 py-2 text-[13px]" style={{ background: '#FEF3C7', color: '#92400E' }}>Heads up: {conflict.agent} already has an event at {hhmm(conflict.starts_at)} with {conflict.contact_name} that overlaps this slot. You can still save.</div>}
          <div className="flex justify-between gap-2 mt-5">
            <div>{edit.id && canDelete && <Btn kind="danger" onClick={() => { if (confirmDelete('this event')) { remove('visits', edit.id!); setEdit(null) } }}><Trash2 size={14} /> Delete</Btn>}</div>
            <div className="flex gap-2"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={save}>Save</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  )
}
