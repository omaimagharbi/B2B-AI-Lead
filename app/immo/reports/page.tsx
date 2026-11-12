'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Download, Sparkles, Wallet, Percent, Target, Handshake, CreditCard } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Btn, Card, CardTitle, Kpi, PageHead, Dots } from '@/lib/immo-os/ui'
import { contextSummary, downloadCsv, lastMonths, monthKey, qar } from '@/lib/immo-os/helpers'
import { LEAD_COLUMNS, SOURCES } from '@/lib/immo-os/types'
import { fallbackReport } from '@/lib/immo-os/fallbacks'
import { summarize } from '@/lib/immo-os/payments'

const tip = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }
const ax = { fontSize: 11, fill: 'var(--muted)' }

function PaymentsSummary() {
  const { data, t, tf } = useImmo()
  const sum = summarize(data.payments ?? [])
  const total = sum.paidCount + sum.pendingCount
  return (
    <Card className="mb-4">
      <CardTitle icon={<CreditCard size={16} style={{ color: 'var(--gold)' }} />} title={t('pay.kpi.title')} />
      {total === 0 ? <div className="text-[13px] t-muted">{t('pay.kpi.none')}</div> : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div><div className="t-muted text-[12px]">{t('pay.kpi.paid')}</div><div className="text-[20px] font-bold" style={{ color: '#16A34A' }}>{qar(sum.paid)}</div><div className="t-muted text-[12px]">{tf('pay.kpi.count', { n: sum.paidCount })}</div></div>
          <div><div className="t-muted text-[12px]">{t('pay.kpi.pending')}</div><div className="text-[20px] font-bold" style={{ color: '#B45309' }}>{qar(sum.pending)}</div><div className="t-muted text-[12px]">{tf('pay.kpi.count', { n: sum.pendingCount })}</div></div>
          <div className="text-[12.5px]">{Object.entries(sum.byKind).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="t-muted">{t('pay.kind.' + k)}</span><b>{qar(v)}</b></div>)}</div>
        </div>
      )}
    </Card>
  )
}

export default function ReportsPage() {
  const { data, agents, ai, t } = useImmo()
  const [summary, setSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const closed = data.deals.filter((d) => d.status === 'closed')
  const comm = (d: { value: number; commission_pct: number }) => (d.value * d.commission_pct) / 100
  const months = lastMonths(6)

  const byMonth = months.map((m) => ({
    month: m.label,
    Leads: data.leads.filter((l) => monthKey(l.created_at) === m.key).length,
    'Closed deals': closed.filter((d) => monthKey(d.closed_at ?? d.created_at) === m.key).length,
    Commission: Math.round(closed.filter((d) => monthKey(d.closed_at ?? d.created_at) === m.key).reduce((s, d) => s + comm(d), 0)),
  }))
  const bySource = SOURCES.map((s) => ({ source: s.l, Leads: data.leads.filter((l) => l.source === s.v).length, Won: data.leads.filter((l) => l.source === s.v && l.status === 'won').length }))
  const funnel = LEAD_COLUMNS.map((c) => ({ stage: c.l, Leads: data.leads.filter((l) => l.status === c.v).length }))
  const conv = data.leads.length ? Math.round((data.leads.filter((l) => l.status === 'won').length / data.leads.length) * 1000) / 10 : 0
  const agentRows = useMemo(() => agents.map((a) => {
    const ls = data.leads.filter((l) => l.agent === a)
    const ds = closed.filter((d) => d.agent === a)
    return { agent: a, leads: ls.length, won: ls.filter((l) => l.status === 'won').length, deals: ds.length, commission: ds.reduce((s, d) => s + comm(d), 0) }
  }).filter((r) => r.leads || r.deals).sort((a, b) => b.commission - a.commission), [agents, data.leads, closed])

  const genSummary = async () => {
    setBusy(true)
    const r = await ai('report', '', { context: contextSummary(data) })
    setSummary(r ?? fallbackReport(data))
    setBusy(false)
  }

  return (
    <div>
      <PageHead icon={<BarChart3 size={28} />} title={t('nav.reports')} sub={t('xm.reports_sub')}
        right={<><Btn onClick={() => downloadCsv('leads.csv', data.leads.map((l) => ({ name: l.name, status: l.status, source: l.source, budget: l.budget, agent: l.agent, score: l.score, created: l.created_at })))}><Download size={14} /> {t('x38.leads_csv')}</Btn><Btn onClick={() => downloadCsv('agents.csv', agentRows)}><Download size={14} /> {t('x38.agents_csv')}</Btn><Btn kind="gold" onClick={genSummary} disabled={busy}><Sparkles size={14} /> {t('x38.ai_summary')}</Btn></>} />

      <PaymentsSummary />

      {(busy || summary) && (
        <Card className="mb-4" style={{ borderColor: 'var(--gold)' }}>
          <CardTitle icon={<Sparkles size={16} style={{ color: 'var(--gold)' }} />} title={t('x38.ai_executive_summary')} />
          {busy ? <Dots /> : <div className="text-[13.5px] whitespace-pre-wrap">{summary}</div>}
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4 mb-4">
        <Kpi icon={<Wallet size={22} />} color="#C9A24B" label={t('x38.commission_earned')} value={qar(closed.reduce((s, d) => s + comm(d), 0))} />
        <Kpi icon={<Handshake size={22} />} color="#16A34A" label={t('x38.closed_deal_value')} value={qar(closed.reduce((s, d) => s + d.value, 0))} />
        <Kpi icon={<Percent size={22} />} color="#2563EB" label={t('x38.lead_conversion')} value={`${conv}%`} />
        <Kpi icon={<Target size={22} />} color="#7C3AED" label={t('team.leads_active')} value={data.leads.filter((l) => !['won', 'lost'].includes(l.status)).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card><CardTitle title={t('x38.leads_vs_closed_deals')} /><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={byMonth} margin={{ left: -18 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" tick={ax} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={ax} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="Leads" name={t('h.leads')} fill="#2563EB" radius={[5, 5, 0, 0]} /><Bar dataKey="Closed deals" name={t('x38.closed_deals')} fill="#C9A24B" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><CardTitle title={t('x38.commission_by_month_qar')} /><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={byMonth} margin={{ left: -4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" tick={ax} axisLine={false} tickLine={false} /><YAxis tick={ax} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} formatter={(v) => qar(Number(v))} /><Line type="monotone" dataKey="Commission" name={t('team.commission')} stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></Card>
        <Card><CardTitle title={t('x38.pipeline_by_stage')} /><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={funnel} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={ax} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="stage" tick={ax} axisLine={false} tickLine={false} width={80} /><Tooltip contentStyle={tip} /><Bar dataKey="Leads" name={t('h.leads')} fill="#8B5CF6" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card><CardTitle title={t('x38.leads_by_source')} /><div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={bySource} margin={{ left: -18 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="source" tick={ax} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={ax} axisLine={false} tickLine={false} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="Leads" name={t('h.leads')} fill="#0891B2" radius={[5, 5, 0, 0]} /><Bar dataKey="Won" name={t('x38.won_leads')} fill="#16A34A" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      </div>

      <Card pad={false}>
        <div className="p-4 pb-1"><CardTitle title={t('x38.agent_leaderboard')} /></div>
        <div className="overflow-x-auto imo-scroll"><table className="imo-table">
          <thead><tr><th>{t('h.agent')}</th><th>{t('nav.leads')}</th><th>{t('x38.won_leads')}</th><th>{t('x38.closed_deals')}</th><th>{t('team.commission')}</th></tr></thead>
          <tbody>{agentRows.map((r) => <tr key={r.agent}><td><div className="flex items-center gap-2"><Avatar name={r.agent} size={26} />{r.agent}</div></td><td>{r.leads}</td><td>{r.won}</td><td>{r.deals}</td><td className="font-semibold">{qar(r.commission)}</td></tr>)}
            {agentRows.length === 0 && <tr><td colSpan={5} className="t-muted text-center py-6">{t('none.agents')}</td></tr>}</tbody></table></div>
      </Card>
    </div>
  )
}
