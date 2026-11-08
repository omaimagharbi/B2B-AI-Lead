'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MessageCircle, Phone, Mail, Ban, ShieldCheck, Clock, Send, Handshake, CalendarDays, Layers, Users as UsersIcon, MessageSquare } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, CardTitle, Empty, PageHead } from '@/lib/immo-os/ui'
import { OUTCOMES, type Assignment } from '@/lib/immo-os/types'
import { qar } from '@/lib/immo-os/helpers'
import { agoLocal } from '@/lib/immo-os/ago'
import { buildTimeline, handledBy, sameContact, type TimelineKind } from '@/lib/immo-os/profile'
import { DEAL_FLOW, stepIndex } from '@/lib/immo-os/deal-flow'

// n°98 : fiche client complete (historique, conversation, qui l'a traite, etapes passees). Page /immo/client?id=<id du client ou du lead>.
// Les donnees viennent de /api/immo?r=all deja filtre cote serveur : un agent ne voit que SES clients ; les proprietaires ne sont jamais affiches ici.
const ICON: Record<TimelineKind, any> = { message: MessageSquare, visit: CalendarDays, deal: Handshake, stage: Layers, outcome: ShieldCheck, send: Send, assign: UsersIcon }
const COLOR: Record<TimelineKind, string> = { message: '#22C55E', visit: '#2563EB', deal: '#C9A24B', stage: '#8B5CF6', outcome: '#0891B2', send: '#F97316', assign: '#64748B' }
const FILTERS: ('all' | TimelineKind)[] = ['all', 'message', 'visit', 'deal', 'stage', 'outcome', 'send', 'assign']

export default function ClientProfilePage() {
  const { data, t, tf, lang, me, update, loadAssignments, notify } = useImmo()
  const [id, setId] = useState<string | null | undefined>(undefined)
  const [filter, setFilter] = useState<'all' | TimelineKind>('all')
  const [assign, setAssign] = useState<Assignment[]>([])
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id')) }, [])

  const client = data.clients.find((c) => c.id === id) ?? null
  const leadSel = !client ? data.leads.find((l) => l.id === id) ?? null : null
  const base = client ?? leadSel
  const contact = useMemo(() => (base ? { name: base.name, phone: base.phone ?? null } : null), [base])
  const leads = useMemo(() => (contact ? data.leads.filter((l) => sameContact(contact, l.name, l.phone)) : []), [data.leads, contact])
  const clientRec = useMemo(() => client ?? (contact ? data.clients.find((c) => sameContact(contact, c.name, c.phone)) ?? null : null), [client, data.clients, contact])
  const leadIds = leads.map((l) => l.id).join(',')
  useEffect(() => {
    let off = false
    Promise.all(leads.map((l) => loadAssignments(l.id))).then((r) => { if (!off) setAssign(r.flat()) })
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIds, data.assignments])

  const propName = (pid?: string | null) => data.properties.find((p) => p.id === pid)?.title ?? '-'
  const items = useMemo(() => (contact ? buildTimeline({ contact, messages: data.messages, visits: data.visits, deals: data.deals, stages: data.stages ?? [], outcomes: data.outcomes ?? [], sends: data.sends ?? [], assignments: assign, propertyName: propName }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contact, data, assign])

  if (id === undefined) return <div className="t-muted text-sm">{t('loading')}</div>
  if (!base || !contact) return <div><PageHead icon={<UsersIcon size={28} />} title={t('pf.title')} right={<Link href="/immo/clients"><Btn><ArrowLeft size={14} /> {t('pf.back')}</Btn></Link>} /><Card><Empty title={t('pf.notfound')} /></Card></div>

  const msgs = data.messages.filter((m) => sameContact(contact, m.contact_name, m.contact_phone)).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const visits = data.visits.filter((v) => sameContact(contact, v.contact_name, v.contact_phone))
  const deals = data.deals.filter((d) => sameContact(contact, d.party_name, null))
  const sends = (data.sends ?? []).filter((s) => sameContact(contact, s.contact_name, s.contact_phone))
  const outcomes = (data.outcomes ?? []).filter((o) => sameContact(contact, o.contact_name, o.contact_phone)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const agents = [clientRec?.agent, ...leads.map((l) => l.agent)]
  const handled = handledBy(items, agents)
  const all = [...(clientRec ? [clientRec] : []), ...leads]
  const dnc = all.find((r) => r.do_not_contact)
  const consent = all.find((r) => r.consent_at)
  const manager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)
  const phone = base.phone ?? null
  const sentGroups = Array.from(sends.reduce((m, s) => m.set(s.property_title || propName(s.property_id), (m.get(s.property_title || propName(s.property_id)) ?? 0) + 1), new Map<string, number>()))

  const setDnc = async (on: boolean) => {
    if (!on && !manager) return notify(t('dnc.manager'), 'err')
    for (const r of all) {
      const e = clientRec && r.id === clientRec.id ? 'clients' : 'leads'
      if (!!r.do_not_contact !== on) await update(e, r.id, { do_not_contact: on })
    }
  }
  const status = (s: string) => (['new', 'qualified', 'viewing', 'negotiation', 'won', 'lost', 'offer', 'contract', 'closed', 'cancelled'].includes(s) ? t('st.' + s) : s)
  const who = (n?: string | null) => (n ? n : t('pf.unassigned'))
  const label = (it: (typeof items)[number]) => {
    const v: Record<string, string | number> = { ...it.vars }
    if (it.kind === 'outcome') v.outcome = t('oc.' + it.vars.outcome)
    if (it.kind === 'stage') { v.what = t('pf.what.' + it.vars.what); v.from = it.vars.from ? status(String(it.vars.from)) : ''; v.to = status(String(it.vars.to)) }
    if (it.kind === 'assign') { v.from = who(String(it.vars.from) || null); v.to = who(String(it.vars.to) || null) }
    return tf(it.key, v)
  }
  const shown = items.filter((i) => filter === 'all' || i.kind === filter)
  const reasonTxt = dnc?.do_not_contact_reason ? t('dnc.r.' + dnc.do_not_contact_reason) : ''

  return (
    <div>
      <PageHead icon={<UsersIcon size={28} />} title={t('pf.title')} sub={base.name} right={<Link href="/immo/clients"><Btn><ArrowLeft size={14} /> {t('pf.back')}</Btn></Link>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={base.name} size={56} />
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[19px] font-bold">{base.name}</span>{clientRec && <Badge color="#2563EB">{clientRec.kind}</Badge>}{leads.length > 0 && <Badge color="#8B5CF6">{status(leads[0].status)}</Badge>}{dnc && <Badge color="#EF4444"><Ban size={11} className="me-0.5" />{t('dnc.badge')}</Badge>}</div>
            <div className="text-[13px] t-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">{phone && <span className="inline-flex items-center gap-1" dir="ltr"><Phone size={13} />{phone}</span>}{base.email && <span className="inline-flex items-center gap-1" dir="ltr"><Mail size={13} />{base.email}</span>}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href={`/immo/whatsapp?c=${encodeURIComponent(base.name)}`}><Btn kind="primary"><MessageCircle size={14} /> {t('pf.convo.open')}</Btn></Link>
            {!dnc ? <Btn onClick={() => setDnc(true)}><Ban size={14} /> {t('dnc.label')}</Btn> : manager ? <Btn onClick={() => setDnc(false)}><ShieldCheck size={14} /> {t('dnc.lift')}</Btn> : null}
          </div>
        </div>
        {dnc && <div className="mt-3 rounded-md px-3 py-2 text-[12.5px]" style={{ background: '#FEE2E2', color: '#991B1B' }}>{tf('dnc.since', { date: dnc.do_not_contact_at ? new Date(dnc.do_not_contact_at).toLocaleDateString(lang) : '-', reason: reasonTxt })}. {t('dnc.help')}</div>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-4 mb-4">
        {[[t('pf.kpi.msgs'), msgs.length], [t('pf.kpi.visits'), visits.length], [t('pf.kpi.deals'), deals.length], [t('pf.kpi.sent'), sends.length]].map(([l, v]) => <Card key={String(l)}><div className="text-[22px] font-bold">{v}</div><div className="text-[12px] t-muted">{l}</div></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardTitle icon={<Clock size={17} />} title={t('pf.timeline')} />
            <div className="flex gap-1.5 flex-wrap mb-3">{FILTERS.map((f) => <Btn key={f} onClick={() => setFilter(f)} style={{ padding: '3px 9px', fontSize: 12, ...(filter === f ? { borderColor: 'var(--gold)' } : {}) }}>{t('pf.f.' + f)}</Btn>)}</div>
            {shown.length === 0 ? <div className="text-[13px] t-muted">{t('pf.empty')}</div> : (
              <ol className="grid gap-2">{shown.slice(0, 80).map((it) => { const I = ICON[it.kind]; return (
                <li key={it.id} className="flex gap-3 text-[13px]" style={{ borderInlineStart: `3px solid ${COLOR[it.kind]}`, paddingInlineStart: 10 }}>
                  <I size={15} style={{ color: COLOR[it.kind], marginTop: 3 }} />
                  <div className="min-w-0 flex-1"><div className="font-medium">{label(it)}</div>
                    {it.text && <div className="t-muted truncate">{it.text}</div>}
                    {it.auto && it.auto.length > 0 && <div className="t-muted text-[11.5px]">{it.auto.map((a) => t('ds.a.' + a)).join(' · ')}</div>}
                    <div className="t-muted text-[11.5px]">{agoLocal(it.at, t, tf)}{it.by ? ` · ${tf('pf.by', { name: it.by })}` : ''}</div></div>
                </li>) })}</ol>
            )}
          </Card>
          <Card>
            <CardTitle icon={<MessageCircle size={17} />} title={t('pf.convo')} />
            {msgs.length === 0 ? <div className="text-[13px] t-muted">{t('pf.convo.empty')}</div> : (
              <div className="imo-scroll flex flex-col gap-2 p-3 rounded-lg" style={{ background: 'var(--soft)', maxHeight: 340, overflowY: 'auto' }}>
                {msgs.map((m) => <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}><div className={`${m.direction === 'out' ? 'imo-bubble-out' : 'imo-bubble-in'} px-3 py-1.5 text-[13px] max-w-[80%] whitespace-pre-wrap`}>{m.body}<div className="text-[10px] opacity-60 text-end mt-0.5">{agoLocal(m.created_at, t, tf)}</div></div></div>)}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle title={t('pf.info')} />
            <div className="text-[13px] grid gap-1.5">
              <div><b>{t('pf.budget')}:</b> {(clientRec?.budget || leads[0]?.budget) ? qar(clientRec?.budget || leads[0]?.budget) : '-'}</div>
              <div><b>{t('pf.areas')}:</b> {clientRec?.preferred_areas ?? '-'}</div>
              <div><b>{t('beds.wanted')}:</b> {clientRec?.beds_wanted ?? leads[0]?.beds_wanted ?? '-'}</div>
              <div><b>{t('pf.agent')}:</b> {who(clientRec?.agent ?? leads[0]?.agent)}</div>
              <div><b>{t('pf.since')}:</b> {new Date(base.created_at).toLocaleDateString(lang)}</div>
              {(clientRec?.notes || leads[0]?.notes) && <div><b>{t('pf.notes')}:</b> {clientRec?.notes || leads[0]?.notes}</div>}
            </div>
          </Card>
          <Card>
            <CardTitle title={t('oc.title')} />
            {outcomes.length === 0 ? <div className="text-[13px] t-muted">{t('oc.none')}</div> : (
              <div className="grid gap-1.5 text-[13px]">{outcomes.slice(0, 5).map((o) => <div key={o.id}><Badge color={OUTCOMES.find((x) => x.v === o.outcome)?.color}>{t('oc.' + o.outcome)}</Badge> <span className="t-muted text-[11.5px]">{agoLocal(o.created_at, t, tf)}{o.agent ? ` · ${o.agent}` : ''}</span>{o.note && <div className="t-muted">{o.note}</div>}</div>)}</div>
            )}
          </Card>
          <Card>
            <CardTitle icon={<UsersIcon size={17} />} title={t('pf.handled')} />
            {handled.length === 0 ? <div className="text-[13px] t-muted">{t('pf.handled.none')}</div> : (
              <div className="grid gap-2 text-[13px]">{handled.map((h) => <div key={h.name} className="flex items-center gap-2"><Avatar name={h.name} size={26} /><div className="flex-1 min-w-0"><div className="font-medium truncate">{h.name} {h.current && <Badge color="#16A34A">{t('pf.handled.cur')}</Badge>}</div><div className="t-muted text-[11.5px]">{tf('pf.handled.actions', { n: h.actions })}{h.actions ? ` · ${agoLocal(h.last, t, tf)}` : ''}</div></div></div>)}</div>
            )}
          </Card>
          <Card>
            <CardTitle icon={<Send size={17} />} title={t('sd.title')} />
            {sentGroups.length === 0 ? <div className="text-[13px] t-muted">{t('sd.empty')}</div> : <div className="grid gap-1 text-[13px]">{sentGroups.map(([n, c]) => <div key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span className="t-muted shrink-0">{tf('sd.times', { n: c })}</span></div>)}</div>}
          </Card>
          <Card>
            <CardTitle icon={<Handshake size={17} />} title={t('pf.deals')} right={<Link href="/immo/deals" className="text-[12px] underline">{t('nav.deals')}</Link>} />
            {deals.length === 0 ? <div className="text-[13px] t-muted">{t('pf.empty')}</div> : <div className="grid gap-3 text-[13px]">{deals.map((d) => (
              <div key={d.id}><div className="flex justify-between gap-2"><b className="truncate">{d.title}</b><span className="shrink-0">{qar(d.value)}</span></div>
                <div className="flex gap-1 mt-1.5">{DEAL_FLOW.map((s, i) => <div key={s} className="flex-1 h-1.5 rounded-full" title={t('ds.s.' + s)} style={{ background: d.status === 'cancelled' ? '#FCA5A5' : stepIndex(d.status) >= i ? '#16A34A' : 'var(--border)' }} />)}</div>
                <div className="t-muted text-[11.5px] mt-1">{t('ds.s.' + d.status)}</div></div>))}</div>}
          </Card>
          <Card>
            <CardTitle icon={<ShieldCheck size={17} />} title={t('pf.consent')} />
            <div className="text-[13px]">{consent ? tf('pf.consent.line', { source: t('cs.' + (consent.consent_source ?? 'manual')), date: new Date(consent.consent_at!).toLocaleDateString(lang) }) : <span className="t-muted">{t('pf.consent.none')}</span>}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}
