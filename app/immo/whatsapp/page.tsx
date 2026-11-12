'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Send, Sparkles, Plus, Search, Ban, Building2, ClipboardCheck, ExternalLink, Paperclip, FileText, X } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead, PropImage } from '@/lib/immo-os/ui'
import { ago, contextSummary, qar } from '@/lib/immo-os/helpers'
import { fallbackReply } from '@/lib/immo-os/fallbacks'
import { OUTCOMES, type OutcomeCode } from '@/lib/immo-os/types'
import { conversationProperty } from '@/lib/immo-os/property-detect'
import { composePropertyMessage } from '@/lib/immo-os/property-msg'
import { sameContact } from '@/lib/immo-os/profile'
import { sameNumber } from '@/lib/immo-os/inbound-pure'
import { agoLocal } from '@/lib/immo-os/ago'
import { isManager } from '@/lib/immo-os/permissions'
import { LANGS, translate, type Lang } from '@/lib/immo-os/i18n'
import { renderTemplate, templateVars, windowState } from '@/lib/immo-os/wa-window'

export default function WhatsAppPage() {
  const { data, sendWhatsapp, update, create, ai, notify, mode, t, tf, lang, me, clientId, callApi, uploadChatFile } = useImmo()
  const [active, setActive] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [target, setTarget] = useState('')
  const [oc, setOc] = useState<OutcomeCode | ''>('')
  const [ocNote, setOcNote] = useState('')
  const [spOpen, setSpOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [att, setAtt] = useState<{ url: string; type: 'image' | 'document'; name: string } | null>(null)
  const [upBusy, setUpBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [wa, setWa] = useState<{ channel: 'meta' | 'greenapi'; templates: WaTemplate[] } | null>(null)
  useEffect(() => { if (mode === 'live') callApi('/api/immo?r=wa').then((r) => { if (r.ok) setWa({ channel: r.json.channel, templates: r.json.templates ?? [] }) }) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode])
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(i) }, [])
  const end = useRef<HTMLDivElement>(null)
  const manager = isManager(me?.role)

  // /immo/whatsapp?c=<nom> : ouvre directement la conversation d'un contact (lien depuis la fiche client)
  useEffect(() => { const c = new URLSearchParams(window.location.search).get('c'); if (c) setActive(c) }, [])

  const threads = useMemo(() => {
    const by: Record<string, typeof data.messages> = {}
    data.messages.forEach((m) => (by[m.contact_name] = [...(by[m.contact_name] ?? []), m]))
    return Object.entries(by)
      .map(([name, ms]) => {
        const s = [...ms].sort((a, b) => a.created_at.localeCompare(b.created_at))
        const phone = s.find((x) => x.contact_phone)?.contact_phone ?? null
        const outcome = (data.outcomes ?? []).filter((o) => sameContact({ name, phone }, o.contact_name, o.contact_phone)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        return { name, ms: s, last: s[s.length - 1], unread: s.filter((x) => x.unread).length, phone, outcome }
      })
      .filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
  }, [data.messages, data.outcomes, q])

  useEffect(() => { if (!active && threads[0]) setActive(threads[0].name) }, [threads, active])
  const cur = threads.find((x) => x.name === active) ?? null

  // Marque la conversation comme lue a l'ouverture
  useEffect(() => {
    if (!cur) return
    cur.ms.filter((m) => m.unread).forEach((m) => update('messages', m.id, { unread: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [cur?.ms.length, active])

  // Fiches liees a la conversation (lead / client / proprietaire), bien en discussion, "ne plus contacter"
  const rel = useMemo(() => {
    if (!cur) return null
    const c = { name: cur.name, phone: cur.phone }
    const lead = data.leads.find((l) => sameContact(c, l.name, l.phone)) ?? null
    const client = data.clients.find((x) => sameContact(c, x.name, x.phone)) ?? null
    const owner = data.owners.find((o) => sameContact(c, o.name, o.phone)) ?? null
    const dnc = [lead, client, owner].some((r) => r?.do_not_contact) || (!!cur.phone && [...data.leads, ...data.clients, ...data.owners].some((r) => r.do_not_contact && sameNumber(r.phone, cur.phone)))
    const cp = conversationProperty(cur.ms, data.properties, lead?.property_id)
    const prop = cp ? data.properties.find((p) => p.id === cp.propertyId) ?? null : null
    const propOwner = prop?.owner_id ? data.owners.find((o) => o.id === prop.owner_id) ?? null : null
    const sent = (data.sends ?? []).filter((s) => sameContact(c, s.contact_name, s.contact_phone))
    return { lead, client, owner, dnc, cp, prop, propOwner, sent }
  }, [cur, data])

  // Lot 6a : fenetre de 24 h (numero Meta uniquement) = dernier message recu du client
  const win = useMemo(() => (wa?.channel === 'meta' && cur ? windowState([...cur.ms].reverse().find((m) => m.direction === 'in')?.created_at) : null), [wa, cur, data.messages])
  const closed = !!win && !win.open
  const send = async () => {
    if (!cur || (!text.trim() && !att) || sending || rel?.dnc || closed) return
    setSending(true)
    const ok = await sendWhatsapp(cur.name, cur.phone, text.trim(), att ? { media: [att] } : undefined)
    if (ok || mode === 'demo') { setText(''); setAtt(null) }
    setSending(false)
  }

  const pickFile = async (f: File | undefined) => {
    if (!f) return
    setUpBusy(true)
    const r = await uploadChatFile(f)
    setUpBusy(false)
    if (r) setAtt(r)
    if (fileRef.current) fileRef.current.value = ''
  }

  const suggest = async () => {
    if (!cur) return
    setBusy(true)
    const lastIn = [...cur.ms].reverse().find((m) => m.direction === 'in')
    const r = await ai('reply', `Reply to ${cur.name}`, { context: contextSummary(data), extra: `Conversation (latest last):\n${cur.ms.slice(-6).map((m) => `${m.direction === 'in' ? 'Client' : 'Agent'}: ${m.body}`).join('\n')}\nLatest client message: ${lastIn?.body ?? ''}` })
    setText(r ?? fallbackReply(cur.name))
    if (!r) notify(t('x38.ai_is_not_configured_inserted'), 'err')
    setBusy(false)
  }

  const contacts = useMemo(() => {
    const seen = new Set<string>()
    return [...data.leads, ...data.clients, ...data.owners].filter((c) => c.phone && !seen.has(c.name) && seen.add(c.name))
  }, [data])

  const startNew = async () => {
    const c = contacts.find((x) => x.name === target)
    if (!c) return
    setNewOpen(false)
    if (!threads.some((x) => x.name === c.name)) {
      await sendWhatsapp(c.name, c.phone, `Hello ${c.name.split(' ')[0]}, this is a message from your real estate agent. How can I help you today?`)
    }
    setActive(c.name)
  }

  // n°99 : resultat du contact de cette conversation
  const saveOutcome = async () => {
    if (!cur || !oc) return
    await create('outcomes', { contact_name: cur.name, contact_phone: cur.phone, outcome: oc, note: ocNote.trim() || null })
    setOc(''); setOcNote('')
    notify(t('oc.saved'))
  }
  // n°89 : choisir a la main le bien d'une conversation (le dernier message est rattache a ce bien)
  const setProperty = async (pid: string) => {
    const last = cur?.ms[cur.ms.length - 1]
    if (!last || !pid) return
    await update('messages', last.id, { property_id: pid, property_auto: false })
    notify(t('xv.linked'))
  }
  const propTitle = (id?: string | null) => data.properties.find((p) => p.id === id)?.title ?? ''
  const srcLabel = rel?.cp ? t(rel.cp.source === 'message' ? 'xv.src.message' : rel.cp.source === 'detected' ? 'xv.src.detected' : 'xv.src.lead') : ''

  return (
    <div>
      <PageHead icon={<MessageCircle size={28} style={{ color: '#22C55E' }} />} title={t('nav.whatsapp')} sub={mode === 'demo' ? t('xm.wa_sub_demo') : t('xm.wa_sub_live')} right={<Btn kind="primary" onClick={() => setNewOpen(true)}><Plus size={15} /> {t('x38.new_chat')}</Btn>} />
      <Card pad={false}>
        <div className="grid grid-cols-[minmax(220px,300px)_1fr] xl:grid-cols-[minmax(220px,300px)_1fr_minmax(250px,310px)]" style={{ minHeight: 520, height: 'calc(100vh - 220px)' }}>
          <div className="flex flex-col min-h-0" style={{ borderInlineEnd: '1px solid var(--border)' }}>
            <div className="p-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 30 }} placeholder={t('x38.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
            <div className="flex-1 overflow-y-auto imo-scroll">
              {threads.map((x) => (
                <button key={x.name} onClick={() => setActive(x.name)} className="w-full text-start flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: x.name === active ? 'var(--soft)' : 'transparent', color: 'var(--text)' }}>
                  <Avatar name={x.name} size={36} />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{x.name}</div><div className="text-[12px] t-muted truncate">{x.last.direction === 'out' ? t('xm.you') : ''}{x.last.body}</div>
                    {x.outcome && <div className="mt-0.5"><Badge color={OUTCOMES.find((o) => o.v === x.outcome!.outcome)?.color}>{t('oc.' + x.outcome.outcome)}</Badge></div>}</div>
                  <div className="text-end shrink-0"><div className="text-[10.5px] t-muted">{ago(x.last.created_at)}</div>{x.unread > 0 && <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full w-4 h-4" style={{ background: '#22C55E', color: '#fff' }}>{x.unread}</span>}</div>
                </button>
              ))}
              {threads.length === 0 && <Empty title={t('x38.no_conversations')} sub={t('xm.wa_new_sub')} />}
            </div>
          </div>

          <div className="flex flex-col min-h-0 min-w-0">
            {cur ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Avatar name={cur.name} size={36} />
                  <div className="min-w-0 flex-1"><div className="font-semibold text-[14px] flex items-center gap-2 flex-wrap">{cur.name}{rel?.dnc && <Badge color="#EF4444"><Ban size={11} className="me-0.5" />{t('dnc.badge')}</Badge>}{win && <Badge color={win.open ? '#16A34A' : '#B45309'}>{win.open ? tf('wa.window.open', { h: Math.max(1, Math.round(win.msLeft / 3600000)) }) : t('wa.window.closed')}</Badge>}</div><div className="text-[12px] t-muted" dir="ltr">{cur.phone ?? t('xm.no_phone_number')}</div>
                    {rel?.prop && <div className="text-[11.5px] mt-0.5"><Building2 size={11} className="inline me-1" />{tf('xv.re', { title: rel.prop.title })}</div>}</div>
                  {(rel?.client || rel?.lead) && <Link href={`/immo/client?id=${(rel.client ?? rel.lead)!.id}`} className="imo-btn" style={{ padding: '4px 9px', fontSize: 12 }}><ExternalLink size={12} /> {t('xv.profile')}</Link>}
                </div>
                {/* n°99 resultat du contact + n°4 envoi d'un bien */}
                <div className="flex items-center gap-2 flex-wrap px-4 py-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
                  <ClipboardCheck size={15} className="t-muted" />
                  {cur.outcome ? <Badge color={OUTCOMES.find((o) => o.v === cur.outcome!.outcome)?.color}>{t('oc.' + cur.outcome.outcome)}</Badge> : <span className="text-[12px] t-muted">{t('oc.none')}</span>}
                  <select className="imo-select" style={{ width: 170, padding: '4px 8px', fontSize: 12.5 }} value={oc} onChange={(e) => setOc(e.target.value as OutcomeCode | '')} aria-label={t('oc.title')}><option value="">{t('oc.title')}…</option>{OUTCOMES.map((o) => <option key={o.v} value={o.v}>{t('oc.' + o.v)}</option>)}</select>
                  {oc && <><input className="imo-input" style={{ width: 170, padding: '4px 8px', fontSize: 12.5 }} placeholder={t('oc.note')} value={ocNote} onChange={(e) => setOcNote(e.target.value)} /><Btn kind="primary" style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={saveOutcome}>{t('oc.save')}</Btn></>}
                  <div className="ms-auto"><Btn style={{ padding: '4px 10px', fontSize: 12.5 }} onClick={() => setSpOpen(true)} disabled={!!rel?.dnc || closed} title={closed ? t('wa.window.closed') : undefined}><Building2 size={13} /> {t('sp.btn')}</Btn></div>
                </div>
                <div className="flex-1 overflow-y-auto imo-scroll p-4 flex flex-col gap-2" style={{ background: 'var(--soft)' }}>
                  {cur.ms.map((m, i) => (
                    <div key={m.id} className={`flex flex-col ${m.direction === 'out' ? 'items-end' : 'items-start'}`}>
                      {m.property_id && m.property_id !== cur.ms[i - 1]?.property_id && <span className="text-[10.5px] t-muted mb-0.5"><Building2 size={10} className="inline me-1" />{tf('xv.re', { title: propTitle(m.property_id) })}{m.property_auto ? ` · ${t('xv.auto')}` : ''}</span>}
                      <div className={`${m.direction === 'out' ? 'imo-bubble-out' : 'imo-bubble-in'} px-3.5 py-2 text-[13px] max-w-[75%] whitespace-pre-wrap`}>{m.media_url && <MediaView m={m} t={t} />}{m.media_url && /^\[(image|document|audio|video)\]$/.test(m.body) ? null : m.body}<div className="text-[10px] opacity-60 text-end mt-0.5">{ago(m.created_at)}{m.direction === 'out' && m.wa_status ? ` · ${t('wa.status.' + m.wa_status)}` : ''}</div></div>
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                <div className="p-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  {closed && !rel?.dnc && <div className="rounded-md px-3 py-2 text-[12.5px] flex items-center gap-2 flex-wrap" style={{ background: '#FEF3C7', color: '#92400E' }} role="status"><span className="flex-1">{t('wa.rule24')}</span><Btn kind="gold" onClick={() => setTplOpen(true)} disabled={!wa?.templates.some((x) => x.status === 'APPROVED')}>{t('wa.tpl.send')}</Btn></div>}
                  {rel?.dnc && <div className="rounded-md px-3 py-2 text-[12.5px] flex items-center gap-2" style={{ background: '#FEE2E2', color: '#991B1B' }} role="alert"><Ban size={14} /> {t('dnc.blocked')}</div>}
                  <div className="flex"><Btn onClick={suggest} disabled={busy || !!rel?.dnc || closed} style={{ padding: '5px 10px', fontSize: 12 }}><Sparkles size={13} style={{ color: 'var(--gold)' }} /> {busy ? t('xm.thinking') : t('xm.suggest_reply_ai')}</Btn></div>
                  {att && <div className="flex items-center gap-2 text-[12.5px] rounded-md px-2.5 py-1.5" style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}>{att.type === 'image' ? <img src={att.url} alt="" style={{ height: 36, borderRadius: 4 }} /> : <FileText size={16} />}<span className="truncate flex-1">{att.name}</span><button onClick={() => setAtt(null)} aria-label={t('att.remove')}><X size={14} /></button></div>}
                  <div className="flex gap-2 items-end">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
                    <Btn onClick={() => fileRef.current?.click()} disabled={upBusy || !!rel?.dnc || closed} aria-label={t('att.add')} title={t('att.add')}><Paperclip size={15} /></Btn>
                    <textarea className="imo-textarea" style={{ minHeight: 44, height: 44 }} placeholder={t('x38.type_a_message')} value={text} disabled={!!rel?.dnc || closed} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                    <Btn kind="primary" onClick={send} disabled={sending || (!text.trim() && !att) || !!rel?.dnc || closed} aria-label={t('x38.send')}><Send size={15} /></Btn>
                  </div>
                </div>
              </>
            ) : <Empty title={t('x38.select_a_conversation')} />}
          </div>

          {/* n°89 : vue croisee bien + conversation + proprietaire */}
          <aside className="hidden xl:flex flex-col min-h-0 overflow-y-auto imo-scroll p-3 gap-3" style={{ borderInlineStart: '1px solid var(--border)' }} aria-label={t('xv.title')}>
            {cur && rel && (
              <>
                <div className="text-[12px] font-semibold uppercase tracking-wide t-muted">{t('xv.title')}</div>
                <div className="imo-card p-3">
                  <div className="imo-label">{t('xv.prop')}</div>
                  {rel.prop ? (
                    <>
                      <PropImage p={rel.prop} h={90} />
                      <div className="mt-2 text-[13px] font-semibold">{rel.prop.title}</div>
                      <div className="text-[12px] t-muted">{rel.prop.area} · {qar(rel.prop.price)}{rel.prop.listing === 'rent' ? ` ${t('sp.permonth')}` : ''}</div>
                      <div className="mt-1 flex gap-1.5 flex-wrap"><Badge color="#2563EB">{rel.prop.status}</Badge>{rel.cp && <Badge color="#64748B">{srcLabel}{rel.cp.auto ? ` · ${t('xv.auto')}` : ''}</Badge>}</div>
                    </>
                  ) : <div className="text-[12.5px] t-muted">{t('xv.none')}</div>}
                  <select className="imo-select mt-2" style={{ fontSize: 12.5 }} value="" onChange={(e) => setProperty(e.target.value)} aria-label={t('xv.change')}><option value="">{rel.prop ? t('xv.change') : t('xv.choose')}</option>{data.properties.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area}</option>)}</select>
                </div>
                <div className="imo-card p-3">
                  <div className="imo-label">{t('xv.owner')}</div>
                  {!rel.prop ? <div className="text-[12.5px] t-muted">{t('xv.none')}</div>
                    : !manager ? <div className="text-[12.5px] t-muted">{t('xv.owner.hidden')}</div>
                    : rel.propOwner ? (
                      <div className="text-[13px] grid gap-1"><b>{rel.propOwner.name}</b><span dir="ltr" className="t-muted text-[12px]">{rel.propOwner.phone ?? '-'}</span>
                        <span className="t-muted text-[12px]">{tf('xv.owner.last', { when: agoLocal(rel.propOwner.last_contact, t, tf) })}</span>
                        {threads.some((x) => x.name === rel.propOwner!.name) ? <Btn style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setActive(rel.propOwner!.name)}>{t('xv.owner.chat')}</Btn> : <span className="t-muted text-[11.5px]">{t('xv.owner.nochat')}</span>}</div>
                    ) : <div className="text-[12.5px] t-muted">{t('xv.owner.none')}</div>}
                </div>
                <div className="imo-card p-3">
                  <div className="imo-label">{t('xv.contact')}</div>
                  <div className="text-[13px] grid gap-1">
                    {rel.lead && <div><Badge color="#8B5CF6">{t('st.' + rel.lead.status)}</Badge> <span className="t-muted text-[12px]">{rel.lead.agent ?? t('pf.unassigned')}</span></div>}
                    {rel.client && <div><Badge color="#2563EB">{rel.client.kind}</Badge></div>}
                    {rel.owner && manager && <div><Badge color="#B45309">{t('xv.owner')}</Badge></div>}
                  </div>
                </div>
                <div className="imo-card p-3">
                  <div className="imo-label">{t('sd.title')}</div>
                  {rel.sent.length === 0 ? <div className="text-[12.5px] t-muted">{t('sd.empty')}</div> : <div className="grid gap-1 text-[12.5px]">{rel.sent.slice(0, 6).map((s) => <div key={s.id} className="flex justify-between gap-2"><span className="truncate">{s.property_title || propTitle(s.property_id)}</span><span className="t-muted shrink-0">{agoLocal(s.created_at, t, tf)}</span></div>)}</div>}
                </div>
              </>
            )}
          </aside>
        </div>
      </Card>

      {tplOpen && cur && wa && <TemplateSend name={cur.name} phone={cur.phone} templates={wa.templates.filter((x) => x.status === 'APPROVED')} onClose={() => setTplOpen(false)} />}
      {spOpen && cur && <SendProperty name={cur.name} phone={cur.phone} onClose={() => setSpOpen(false)} initial={rel?.prop?.id ?? ''} clientId={clientId} />}

      {newOpen && (
        <Modal title={t('x38.new_whatsapp_chat')} onClose={() => setNewOpen(false)}>
          <Field label={t('x38.contact_leads_clients_and_owners')}>
            <select className="imo-select" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">{t('x38.choose')}</option>{contacts.map((c) => <option key={c.id} value={c.name}>{c.name} · {c.phone}{c.do_not_contact ? ` · ${t('dnc.badge')}` : ''}</option>)}</select>
          </Field>
          <div className="text-[12px] t-muted mt-2">{t('x38.a_short_greeting_is_sent')}</div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setNewOpen(false)}>{t('f.cancel')}</Btn><Btn kind="primary" disabled={!target} onClick={startNew}>{t('x38.start_chat')}</Btn></div>
        </Modal>
      )}
    </div>
  )
}

// n°4 : envoyer la fiche d'un bien a un client (texte dans la langue choisie + reference + lien public), enregistre dans "biens envoyes"
function SendProperty({ name, phone, initial, clientId, onClose }: { name: string; phone: string | null; initial: string; clientId: string | null; onClose: () => void }) {
  const { data, t, tf, lang, sendWhatsapp, ai } = useImmo()
  const [pid, setPid] = useState(initial)
  const [l, setL] = useState<Lang>(lang)
  const [q, setQ] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const list = data.properties.filter((p) => p.status === 'available' && (!q || `${p.title} ${p.area}`.toLowerCase().includes(q.toLowerCase())))
  useEffect(() => {
    const p = data.properties.find((x) => x.id === pid)
    if (!p) return setBody('')
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    setBody(composePropertyMessage(l, { name, property: p, link: clientId ? `${origin}/lead?a=${clientId}&property=${p.id}&lang=${l}` : null }))
  }, [pid, l, name, clientId, data.properties])
  const prop = data.properties.find((x) => x.id === pid)
  const allPhotos = Array.from(new Set([prop?.image_url, ...(prop?.photos ?? [])].filter((x): x is string => !!x && /^https?:\/\//.test(x))))
  useEffect(() => { setPhotos(allPhotos.slice(0, 3)) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pid])
  // n°38 / n°91 : l'IA redige l'annonce du bien (langue choisie), l'agent relit puis envoie avec les photos cochees
  const writeAi = async () => {
    if (!prop) return
    setAiBusy(true)
    const r = await ai('ad', `${prop.title} - ${prop.area}, ${prop.beds} bed, ${prop.size_m2} m2, ${qar(prop.price)}${prop.listing === 'rent' ? ' / month' : ''}. ${prop.description ?? ''}`, { context: contextSummary(data), language: l, extra: 'Write a short WhatsApp message to a client (max 700 characters, no hashtags), include the reference REF-' + prop.id.replace(/-/g, '').slice(0, 8).toUpperCase() + ' and end with: ' + translate(l, 'pol.stop.footer') })
    if (r) setBody(r)
    setAiBusy(false)
  }
  const go = async () => {
    setBusy(true)
    const ok = await sendWhatsapp(name, phone, body, { propertyId: pid, lang: l, media: photos.map((u, i) => ({ url: u, type: 'image' as const, name: `photo-${i + 1}.jpg` })) })
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal title={tf('sp.title', { name })} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('sp.choose')}><div className="grid gap-2"><input className="imo-input" placeholder={t('sp.search')} value={q} onChange={(e) => setQ(e.target.value)} /><select className="imo-select" size={6} value={pid} onChange={(e) => setPid(e.target.value)}>{list.map((p) => <option key={p.id} value={p.id}>{p.title} · {p.area} · {qar(p.price)}</option>)}</select>{list.length === 0 && <div className="text-[12.5px] t-muted">{t('sp.none')}</div>}</div></Field>
        <div className="grid gap-3 content-start">
          <Field label={t('sp.lang')}><select className="imo-select" value={l} onChange={(e) => setL(e.target.value as Lang)}>{LANGS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select></Field>
          <div><Btn onClick={writeAi} disabled={!prop || aiBusy}><Sparkles size={13} style={{ color: 'var(--gold)' }} /> {aiBusy ? '…' : t('sp.ai')}</Btn></div>
          <Field label={t('sp.preview')}><textarea className="imo-textarea" style={{ minHeight: 170 }} dir={l === 'ar' ? 'rtl' : 'ltr'} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        </div>
      </div>
      {allPhotos.length > 0 && <div className="mt-3"><div className="imo-label">{tf('sp.photos', { n: photos.length })}</div><div className="flex gap-2 flex-wrap">{allPhotos.slice(0, 8).map((u) => <button key={u} type="button" onClick={() => setPhotos((x) => x.includes(u) ? x.filter((y) => y !== u) : x.length < 5 ? [...x, u] : x)} aria-pressed={photos.includes(u)} style={{ border: photos.includes(u) ? '2px solid var(--gold)' : '2px solid transparent', borderRadius: 8, padding: 0, opacity: photos.includes(u) ? 1 : 0.55 }}><img src={u} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, display: 'block' }} /></button>)}</div></div>}
      <div className="flex justify-end gap-2 mt-5"><Btn onClick={onClose}>{t('f.cancel')}</Btn><Btn kind="primary" disabled={!pid || !body.trim() || busy} onClick={go}><Send size={14} /> {t('sp.send')}</Btn></div>
    </Modal>
  )
}

type WaTemplate = { name: string; language: string; category: string | null; status: string; body: string | null }
// Lot 6a : envoi d'un modele approuve (obligatoire hors fenetre de 24 h)
function TemplateSend({ name, phone, templates, onClose }: { name: string; phone: string | null; templates: WaTemplate[]; onClose: () => void }) {
  const { t, tf, sendWhatsapp } = useImmo()
  const [k, setK] = useState('')
  const [vals, setVals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const tpl = templates.find((x) => `${x.name}|${x.language}` === k)
  const n = templateVars(tpl?.body)
  const params = Array.from({ length: n }, (_, i) => vals[i] ?? (i === 0 ? name.split(' ')[0] : ''))
  const preview = tpl ? renderTemplate(tpl.body, params) : ''
  const go = async () => {
    if (!tpl) return
    setBusy(true)
    const ok = await sendWhatsapp(name, phone, preview, { template: { name: tpl.name, language: tpl.language, params } })
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal title={t('wa.tpl.send')} onClose={onClose}>
      <div className="grid gap-3">
        <div className="text-[12.5px] t-muted">{t('wa.rule24')}</div>
        <Field label={t('wa.tpl.choose')}><select className="imo-select" value={k} onChange={(e) => { setK(e.target.value); setVals([]) }}><option value="">-</option>{templates.map((x) => <option key={`${x.name}|${x.language}`} value={`${x.name}|${x.language}`}>{x.name} ({x.language})</option>)}</select></Field>
        {Array.from({ length: n }, (_, i) => <Field key={i} label={tf('wa.tpl.var', { n: i + 1 })}><input className="imo-input" value={params[i]} onChange={(e) => setVals((v) => { const c = [...params]; c[i] = e.target.value; return c })} /></Field>)}
        {tpl && <Field label={t('wa.tpl.preview')}><div className="rounded-lg p-3 text-[13px] whitespace-pre-wrap" style={{ background: 'var(--soft)' }} dir="auto">{preview}</div></Field>}
      </div>
      <div className="flex justify-end gap-2 mt-5"><Btn onClick={onClose}>{t('f.cancel')}</Btn><Btn kind="primary" disabled={!tpl || busy || params.some((x) => !x.trim())} onClick={go}><Send size={14} /> {t('sp.send')}</Btn></div>
    </Modal>
  )
}

function MediaView({ m, t }: { m: { media_url?: string | null; media_type?: string | null; media_name?: string | null }; t: (k: string) => string }) {
  const url = m.media_url as string
  if (m.media_type === 'image') return <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={m.media_name ?? t('att.image')} style={{ maxWidth: 240, maxHeight: 240, borderRadius: 8, display: 'block', marginBottom: 4 }} /></a>
  if (m.media_type === 'audio') return <audio controls src={url} style={{ maxWidth: 240, marginBottom: 4 }} />
  if (m.media_type === 'video') return <video controls src={url} style={{ maxWidth: 240, borderRadius: 8, marginBottom: 4 }} />
  return <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 underline mb-1"><FileText size={15} />{m.media_name || t('att.document')}</a>
}
