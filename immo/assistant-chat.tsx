'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Home, LineChart, Megaphone, MessageSquareReply, FileText, Send, Bot } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { contextSummary, matchProperties, parseSearch, qar } from '@/lib/immo-os/helpers'
import { fallbackAd, fallbackMarket, fallbackReply, fallbackReport } from '@/lib/immo-os/fallbacks'
import type { Property } from '@/lib/immo-os/types'
import { Dots, PropImage } from '@/lib/immo-os/ui'

type Msg = { role: 'user' | 'bot'; text: string; props?: Property[] }

const NO_AI = '\n\n(Tip: add GEMINI_API_KEY or ANTHROPIC_API_KEY on the server to get full AI answers.)'

export default function AssistantChat({ compact = false }: { compact?: boolean }) {
  const { data, ai, t } = useImmo()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [msgs, busy])

  const push = (m: Msg) => setMsgs((x) => [...x, m])
  const ctx = () => contextSummary(data)

  const run = async (label: string, job: () => Promise<Msg>) => {
    push({ role: 'user', text: label })
    setBusy(true)
    try {
      push(await job())
    } finally {
      setBusy(false)
    }
  }

  const find = (text: string): Msg => {
    const q = parseSearch(text)
    const found = matchProperties(data.properties, q)
    const crit = [q.type, q.area, q.listing, q.maxPrice ? `under ${qar(q.maxPrice)}` : null, q.minBeds ? `${q.minBeds}+ beds` : null].filter(Boolean).join(', ')
    return found.length
      ? { role: 'bot', text: `I found ${found.length} matching ${found.length > 1 ? 'properties' : 'property'}${crit ? ` (${crit})` : ''}:`, props: found.slice(0, 4) }
      : { role: 'bot', text: `No available property matches${crit ? ` (${crit})` : ''}. Try a higher budget or another area.` }
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    const q = parseSearch(t)
    const isSearch = !!(q.type || q.area || q.maxPrice || q.minBeds || q.listing) && /(find|show|search|looking|need|want|any|have)/i.test(t)
    await run(t, async () => {
      if (isSearch) return find(t)
      const r = await ai('chat', t, { context: ctx() })
      return { role: 'bot', text: r ?? `I can search your listings (try "villa in Lusail under 3M") or use AI once it is configured.${NO_AI}` }
    })
  }

  const actions = [
    { icon: Home, label: t('ai.find'), go: () => setInput('Find a villa in The Pearl under 4M') },
    {
      icon: LineChart, label: t('ai.market'),
      go: () => run(t('ai.market'), async () => {
        const r = await ai('market', '', { context: ctx() })
        return { role: 'bot', text: r ?? fallbackMarket(data) }
      }),
    },
    {
      icon: Megaphone, label: t('ai.ad'),
      go: () => run(t('ai.ad'), async () => {
        const p = data.properties.find((x) => x.featured && x.status === 'available') ?? data.properties.find((x) => x.status === 'available')
        if (!p) return { role: 'bot', text: 'Add a property first, then I can write its ad.' }
        const r = await ai('ad', `Instagram ad for ${p.title}`, { context: ctx(), extra: JSON.stringify(p), language: 'en' })
        return { role: 'bot', text: r ?? fallbackAd(p, 'instagram', 'en'), props: [p] }
      }),
    },
    {
      icon: MessageSquareReply, label: t('ai.reply'),
      go: () => run(t('ai.reply'), async () => {
        const last = data.messages.filter((m) => m.direction === 'in').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        if (!last) return { role: 'bot', text: 'No client message to answer yet.' }
        const r = await ai('reply', `Reply to ${last.contact_name}`, { context: ctx(), extra: `Client message: "${last.body}"` })
        return { role: 'bot', text: `Draft reply to ${last.contact_name}:\n\n${r ?? fallbackReply(last.contact_name)}` }
      }),
    },
    {
      icon: FileText, label: t('ai.report'),
      go: () => run(t('ai.report'), async () => {
        const r = await ai('report', '', { context: ctx() })
        return { role: 'bot', text: r ?? fallbackReport(data) }
      }),
    },
  ]

  return (
    <div className={compact ? 'imo-ai p-4 flex flex-col h-full' : 'imo-card flex flex-col'} style={compact ? undefined : { height: 'calc(100vh - 190px)', minHeight: 440 }}>
      {compact && (
        <div className="flex items-center gap-2 mb-3 font-semibold">
          <Bot size={18} style={{ color: '#E3C275' }} /> {t('ai.title')} <span className="ml-1 w-2 h-2 rounded-full" style={{ background: '#22C55E' }} />
        </div>
      )}
      <div className={`flex-1 overflow-y-auto imo-scroll flex flex-col gap-3 ${compact ? 'max-h-[210px]' : 'p-4'}`}>
        <div className="flex justify-start"><div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px]" style={compact ? { background: 'rgba(255,255,255,.12)', color: '#fff' } : { background: 'var(--soft)', border: '1px solid var(--border)' }}>{t('ai.hello')}</div></div>
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[88%]">
              <div className="rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-wrap" style={m.role === 'user' ? { background: '#2563EB', color: '#fff' } : compact ? { background: 'rgba(255,255,255,.12)', color: '#fff' } : { background: 'var(--soft)', border: '1px solid var(--border)' }}>
                {m.text}
              </div>
              {m.props && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {m.props.map((p) => (
                    <Link key={p.id} href="/immo/properties" className="imo-card overflow-hidden block" style={{ color: 'var(--text)' }}>
                      <PropImage p={p} h={64} rounded={0} />
                      <div className="p-2 text-[12px]"><div className="font-semibold truncate">{p.title}</div><div className="t-muted">{p.area}</div><div className="font-bold">{qar(p.price)}</div></div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="text-[13px]" style={{ color: compact ? '#fff' : 'var(--muted)' }}><Dots /></div>}
        <div ref={end} />
      </div>
      <div className={`flex flex-wrap gap-2 ${compact ? 'mt-3' : 'px-4 pb-2'}`}>
        {actions.map((a) => (
          <button key={a.label} onClick={a.go} disabled={busy} className="imo-btn text-[12px]" style={compact ? { background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.25)', color: '#fff', padding: '5px 10px' } : { padding: '6px 11px' }}>
            <a.icon size={13} /> {a.label}
          </button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input) }} className={`flex gap-2 ${compact ? 'mt-3' : 'p-4 pt-2'}`}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('ai.ph')} className="imo-input" />
        <button type="submit" disabled={busy} className="imo-btn imo-btn-primary" aria-label="Send"><Send size={15} /></button>
      </form>
    </div>
  )
}
