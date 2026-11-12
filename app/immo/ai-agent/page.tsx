'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Sparkles, ShieldCheck, Gauge, Route, Handshake, History } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, PageHead } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { CONFIG_BOOLS, DEFAULT_AGENT_CONFIG, readConfig, type AgentConfig } from '@/lib/immo-os/ai-agent'
import { dispatchSuggestions, scoreConversation } from '@/lib/immo-os/ai-tools'
import { agoLocal } from '@/lib/immo-os/ago'
import type { Activity } from '@/lib/immo-os/types'

// n°57 / n°39 / n°85 / n°29 / n°84 / n°87 : menu "AI Real Estate Agent". Reglages de l'agence, garde-fous, activite de l'IA, qualite des echanges, dispatch.
export default function AiAgentPage() {
  const { data, t, tf, mode, me, activeAgents, callApi, notify, update, loadActivity, ai } = useImmo()
  const manager = isManager(me?.role)
  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [log, setLog] = useState<Activity[] | null>(null)
  const [review, setReview] = useState<{ name: string; text: string | null } | null>(null)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    if (mode === 'demo') { try { setCfg(readConfig(JSON.parse(localStorage.getItem('imo_ai_agent') ?? '{}'))) } catch {} ; return }
    if (mode !== 'live') return
    callApi('/api/immo?r=settings').then((r) => { if (r.ok) setCfg(readConfig(r.json.ai_agent)) })
    if (manager) loadActivity().then((l) => setLog((l ?? []).filter((a) => a.action.startsWith('ai_')).slice(0, 12)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, manager])

  const save = async (patch: Partial<AgentConfig>) => {
    if (!manager) return notify(t('aia.managers'), 'err')
    const next = readConfig({ ...cfg, ...patch })
    if (mode === 'demo') { setCfg(next); try { localStorage.setItem('imo_ai_agent', JSON.stringify(next)) } catch {}; return notify(t('aia.saved')) }
    const r = await callApi('/api/immo?r=settings', { method: 'PATCH', body: JSON.stringify({ ai_agent: patch }) })
    if (!r.ok) return notify(r.json?.error ?? t('xm.update_failed'), 'err')
    setCfg(next); notify(t('aia.saved'))
  }

  // Qualite des conversations (calcul sans IA)
  const rated = useMemo(() => {
    const by = new Map<string, typeof data.messages>()
    data.messages.forEach((m) => by.set(m.contact_name, [...(by.get(m.contact_name) ?? []), m]))
    return Array.from(by, ([name, ms]) => ({ name, ms, q: scoreConversation(ms) })).filter((x) => x.ms.some((m) => m.direction === 'in')).sort((a, b) => a.q.score - b.q.score)
  }, [data.messages])
  const avg = rated.length ? Math.round(rated.reduce((n, x) => n + x.q.score, 0) / rated.length) : null
  const askReview = async (name: string, ms: typeof data.messages) => {
    setBusy(name); setReview({ name, text: null })
    const transcript = [...ms].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-20).map((m) => `${m.direction === 'in' ? 'Client' : 'Agent'}: ${m.body}`).join('\n')
    const r = await ai('quality', 'Review this conversation', { context: transcript })
    setReview({ name, text: r ?? t('aia.quality.nai') }); setBusy('')
  }

  // Dispatch : leads sans agent (ou dont l'agent a ete retire)
  const waiting = useMemo(() => data.leads.filter((l) => ['new', 'qualified', 'viewing', 'negotiation'].includes(l.status) && (!l.agent || !activeAgents.some((a) => a.toLowerCase() === l.agent!.toLowerCase()))).slice(0, 6), [data.leads, activeAgents])
  const zones = data.zones.filter((z) => z.level === 'zone').map((z) => z.name)
  const color = (s: number) => (s >= 75 ? '#16A34A' : s >= 50 ? '#F59E0B' : '#EF4444')

  return (
    <div>
      <PageHead icon={<Sparkles size={28} style={{ color: 'var(--gold)' }} />} title={t('nav.ai_agent')} sub={t('aia.sub')} />
      {mode === 'demo' && <div className="mb-4 text-[12.5px]" style={{ color: '#92400E' }}>{t('aia.demo')}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Sparkles size={17} />} title={t('aia.switches')} />
          <div className="grid gap-3 text-[13px]">
            {CONFIG_BOOLS.map((k) => (
              <label key={k} className="flex items-start gap-2.5" style={{ opacity: manager ? 1 : 0.7 }}>
                <input type="checkbox" className="mt-1" checked={cfg[k]} disabled={!manager} onChange={(e) => save({ [k]: e.target.checked })} />
                <span><b>{t('aia.' + k)}</b>{k === 'auto_reply' && <span className="block t-muted text-[12px]">{t('aia.auto_reply.help')}</span>}</span>
              </label>
            ))}
            <label className="flex items-center gap-2.5"><span>{t('aia.max')}</span>
              <select className="imo-select" style={{ width: 70 }} value={cfg.max_replies} disabled={!manager} onChange={(e) => save({ max_replies: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            {!manager && <div className="t-muted">{t('aia.managers')}</div>}
          </div>
        </Card>
        <Card>
          <CardTitle icon={<ShieldCheck size={17} />} title={t('aia.guard.title')} />
          <ul className="grid gap-2 text-[13px] list-disc ps-5">{[1, 2, 3, 4, 5].map((n) => <li key={n}>{t('aia.guard.' + n)}</li>)}</ul>
        </Card>

        {cfg.quality_hints && (
          <Card className="lg:col-span-2">
            <CardTitle icon={<Gauge size={17} />} title={t('aia.quality')} right={avg !== null ? <Badge color={color(avg)}>{avg}/100</Badge> : undefined} />
            <div className="text-[12px] t-muted mb-3">{t('aia.quality.help')}</div>
            {rated.length === 0 ? <div className="text-[13px] t-muted">{t('aia.quality.none')}</div> : (
              <div className="grid gap-2">
                {rated.slice(0, 8).map((x) => (
                  <div key={x.name} className="flex items-center gap-3 flex-wrap text-[13px]" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <Badge color={color(x.q.score)}>{x.q.score}</Badge>
                    <Link href={`/immo/whatsapp?c=${encodeURIComponent(x.name)}`} className="font-medium underline decoration-dotted">{x.name}</Link>
                    <span className="flex gap-1.5 flex-wrap flex-1">{x.q.flags.map((f) => <span key={f} className="text-[11.5px] rounded-full px-2 py-0.5" style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}>{t('qf.' + f)}</span>)}</span>
                    <Btn style={{ padding: '3px 9px', fontSize: 12 }} disabled={busy === x.name} onClick={() => askReview(x.name, x.ms)}><Sparkles size={12} style={{ color: 'var(--gold)' }} /> {busy === x.name ? '…' : t('aia.quality.review')}</Btn>
                  </div>
                ))}
                {review && <div className="rounded-lg p-3 text-[13px] whitespace-pre-wrap" style={{ background: 'var(--soft)' }} dir="auto"><b>{review.name}</b><div className="mt-1">{review.text ?? '…'}</div></div>}
              </div>
            )}
          </Card>
        )}

        {manager && cfg.dispatch_help && (
          <Card>
            <CardTitle icon={<Route size={17} />} title={t('aia.dispatch')} />
            <div className="text-[12px] t-muted mb-3">{t('aia.dispatch.help')}</div>
            {waiting.length === 0 ? <div className="text-[13px] t-muted">{t('aia.dispatch.none')}</div> : (
              <div className="grid gap-3">{waiting.map((l) => { const s = dispatchSuggestions(l, data, activeAgents, zones).slice(0, 3); return (
                <div key={l.id} className="text-[13px]"><b>{l.name}</b> <span className="t-muted">{l.interest ?? ''}</span>
                  <div className="grid gap-1 mt-1">{s.map((x, i) => <div key={x.agent} className="flex items-center gap-2"><Badge color={i === 0 ? '#16A34A' : '#64748B'}>{x.score}</Badge><span className="flex-1 min-w-0"><b>{x.agent}</b> <span className="t-muted text-[11.5px]">{tf('aia.dispatch.why', { load: x.load, area: x.areaFit, closed: x.closed })}</span></span><Btn style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => update('leads', l.id, { agent: x.agent })}>{t('aia.dispatch.assign')}</Btn></div>)}</div></div>) })}</div>
            )}
          </Card>
        )}
        {cfg.negotiation_help && (
          <Card>
            <CardTitle icon={<Handshake size={17} />} title={t('neg.title')} />
            <div className="text-[13px] grid gap-2"><div>{t('neg.disclaimer')}</div><Link href="/immo/deals" className="underline">{t('nav.deals')}</Link></div>
          </Card>
        )}
        {manager && (
          <Card className="lg:col-span-2">
            <CardTitle icon={<History size={17} />} title={t('aia.activity')} />
            {!log || log.length === 0 ? <div className="text-[13px] t-muted">{t('aia.activity.none')}</div> : (
              <div className="grid gap-1.5 text-[13px]">{log.map((a) => <div key={a.id} className="flex items-center gap-2 flex-wrap"><Badge color="#C9A24B">{t('log.a.' + a.action)}</Badge><b>{a.label}</b>{(a.details as any)?.reason && <span className="t-muted text-[12px]">{String((a.details as any).reason)}</span>}<span className="t-muted text-[11.5px] ms-auto">{agoLocal(a.created_at, t, tf)}</span></div>)}</div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
