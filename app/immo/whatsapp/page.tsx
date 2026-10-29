'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send, Sparkles, Plus, Search } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { ago, contextSummary } from '@/lib/immo-os/helpers'
import { fallbackReply } from '@/lib/immo-os/fallbacks'

export default function WhatsAppPage() {
  const { data, sendWhatsapp, update, ai, notify, mode } = useImmo()
  const [active, setActive] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [target, setTarget] = useState('')
  const end = useRef<HTMLDivElement>(null)

  const threads = useMemo(() => {
    const by: Record<string, typeof data.messages> = {}
    data.messages.forEach((m) => (by[m.contact_name] = [...(by[m.contact_name] ?? []), m]))
    return Object.entries(by)
      .map(([name, ms]) => {
        const s = [...ms].sort((a, b) => a.created_at.localeCompare(b.created_at))
        return { name, ms: s, last: s[s.length - 1], unread: s.filter((x) => x.unread).length, phone: s.find((x) => x.contact_phone)?.contact_phone ?? null }
      })
      .filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
  }, [data.messages, q])

  useEffect(() => { if (!active && threads[0]) setActive(threads[0].name) }, [threads, active])
  const cur = threads.find((t) => t.name === active) ?? null

  // Marque la conversation comme lue a l'ouverture
  useEffect(() => {
    if (!cur) return
    cur.ms.filter((m) => m.unread).forEach((m) => update('messages', m.id, { unread: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [cur?.ms.length, active])

  const send = async () => {
    if (!cur || !text.trim() || sending) return
    setSending(true)
    await sendWhatsapp(cur.name, cur.phone, text.trim())
    setText('')
    setSending(false)
  }

  const suggest = async () => {
    if (!cur) return
    setBusy(true)
    const lastIn = [...cur.ms].reverse().find((m) => m.direction === 'in')
    const r = await ai('reply', `Reply to ${cur.name}`, { context: contextSummary(data), extra: `Conversation (latest last):\n${cur.ms.slice(-6).map((m) => `${m.direction === 'in' ? 'Client' : 'Agent'}: ${m.body}`).join('\n')}\nLatest client message: ${lastIn?.body ?? ''}` })
    setText(r ?? fallbackReply(cur.name))
    if (!r) notify('AI is not configured - inserted a standard reply instead', 'err')
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
    if (!threads.some((t) => t.name === c.name)) {
      await sendWhatsapp(c.name, c.phone, `Hello ${c.name.split(' ')[0]}, this is a message from your real estate agent. How can I help you today?`)
    }
    setActive(c.name)
  }

  return (
    <div>
      <PageHead icon={<MessageCircle size={28} style={{ color: '#22C55E' }} />} title="WhatsApp" sub={mode === 'demo' ? 'Demo mode - messages are not actually sent' : 'Messages are sent through your connected WhatsApp number'} right={<Btn kind="primary" onClick={() => setNewOpen(true)}><Plus size={15} /> New chat</Btn>} />
      <Card pad={false}>
        <div className="grid" style={{ gridTemplateColumns: 'minmax(220px,300px) 1fr', minHeight: 520, height: 'calc(100vh - 220px)' }}>
          <div className="flex flex-col min-h-0" style={{ borderRight: '1px solid var(--border)' }}>
            <div className="p-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 30 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
            <div className="flex-1 overflow-y-auto imo-scroll">
              {threads.map((t) => (
                <button key={t.name} onClick={() => setActive(t.name)} className="w-full text-left flex items-center gap-2.5 px-3 py-2.5" style={{ borderBottom: '1px solid var(--border)', background: t.name === active ? 'var(--soft)' : 'transparent', color: 'var(--text)' }}>
                  <Avatar name={t.name} size={36} />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{t.name}</div><div className="text-[12px] t-muted truncate">{t.last.direction === 'out' ? 'You: ' : ''}{t.last.body}</div></div>
                  <div className="text-right shrink-0"><div className="text-[10.5px] t-muted">{ago(t.last.created_at)}</div>{t.unread > 0 && <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full w-4 h-4" style={{ background: '#22C55E', color: '#fff' }}>{t.unread}</span>}</div>
                </button>
              ))}
              {threads.length === 0 && <Empty title="No conversations" sub="Start a new chat with a lead or client." />}
            </div>
          </div>

          <div className="flex flex-col min-h-0 min-w-0">
            {cur ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}><Avatar name={cur.name} size={36} /><div><div className="font-semibold text-[14px]">{cur.name}</div><div className="text-[12px] t-muted">{cur.phone ?? 'No phone number'}</div></div></div>
                <div className="flex-1 overflow-y-auto imo-scroll p-4 flex flex-col gap-2" style={{ background: 'var(--soft)' }}>
                  {cur.ms.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`${m.direction === 'out' ? 'imo-bubble-out' : 'imo-bubble-in'} px-3.5 py-2 text-[13px] max-w-[75%] whitespace-pre-wrap`}>{m.body}<div className="text-[10px] opacity-60 text-right mt-0.5">{ago(m.created_at)}</div></div>
                    </div>
                  ))}
                  <div ref={end} />
                </div>
                <div className="p-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex"><Btn onClick={suggest} disabled={busy} style={{ padding: '5px 10px', fontSize: 12 }}><Sparkles size={13} style={{ color: 'var(--gold)' }} /> {busy ? 'Thinking…' : 'Suggest reply with AI'}</Btn></div>
                  <div className="flex gap-2 items-end">
                    <textarea className="imo-textarea" style={{ minHeight: 44, height: 44 }} placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                    <Btn kind="primary" onClick={send} disabled={sending || !text.trim()} aria-label="Send"><Send size={15} /></Btn>
                  </div>
                </div>
              </>
            ) : <Empty title="Select a conversation" />}
          </div>
        </div>
      </Card>

      {newOpen && (
        <Modal title="New WhatsApp chat" onClose={() => setNewOpen(false)}>
          <Field label="Contact (leads, clients and owners with a phone number)">
            <select className="imo-select" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Choose…</option>{contacts.map((c) => <option key={c.id} value={c.name}>{c.name} · {c.phone}</option>)}</select>
          </Field>
          <div className="text-[12px] t-muted mt-2">A short greeting is sent to open the conversation.</div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setNewOpen(false)}>Cancel</Btn><Btn kind="primary" disabled={!target} onClick={startNew}>Start chat</Btn></div>
        </Modal>
      )}
    </div>
  )
}
