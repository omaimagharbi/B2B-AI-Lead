'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Trophy, AlertTriangle, Gauge } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Card, CardTitle, Empty } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { bestOfWeek, computeMetrics, fmtMinutes, riskLeads, type AgentMetrics } from '@/lib/immo-os/metrics'
import { agoLocal } from '@/lib/immo-os/ago'

const pct = (v: number | null) => (v === null ? '-' : `${v}%`)

// Tableau de bord manager (n°72) : conversations, visites, rapidite de reponse, suivi, relances, offres, leads a risque.
// Le manager voit tous les agents ; l'agent ne voit que ses propres chiffres (ses donnees sont deja filtrees par le serveur).
export default function ManagerPanel() {
  const { data, me, activeAgents, lastActivity, t, tf } = useImmo()
  const manager = isManager(me?.role)
  const [days, setDays] = useState<7 | 30>(7)
  const [last, setLast] = useState<Record<string, string>>({})
  const agents = useMemo(() => (manager ? activeAgents : me?.name ? [me.name] : []), [manager, activeAgents, me?.name])

  useEffect(() => {
    if (manager) lastActivity().then(setLast)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, data.activity])

  const metrics = useMemo(() => computeMetrics(data, agents, { days }), [data, agents, days])
  const rows = Object.values(metrics).sort((a, b) => b.weekPoints - a.weekPoints || a.agent.localeCompare(b.agent))
  const sum = (f: (m: AgentMetrics) => number) => rows.reduce((s, r) => s + f(r), 0)
  const best = manager ? bestOfWeek(metrics) : null
  const mine = !manager && me?.name ? metrics[me.name] : null
  const risk = useMemo(() => riskLeads(data.leads, Date.now(), manager ? activeAgents : []).slice(0, 8), [data.leads, activeAgents, manager])
  const riskTotal = useMemo(() => riskLeads(data.leads, Date.now(), manager ? activeAgents : []).length, [data.leads, activeAgents, manager])

  if (!agents.length) return null
  const th = t('u.h'), tm = t('u.min')
  const replyAll = (() => { const v = rows.map((r) => r.replyMedianMin).filter((x): x is number => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null })()
  const active = sum((r) => r.activeLeads), followed = sum((r) => r.followed)
  const chat = sum((r) => r.chatThreads), conv = sum((r) => r.chatToVisit)
  const kpis: { label: string; value: string; sub?: string; warn?: boolean }[] = [
    { label: t('mp.conv'), value: String(sum((r) => r.conversations)), sub: tf('mp.unanswered', { n: sum((r) => r.unanswered) }), warn: sum((r) => r.unanswered) > 0 },
    { label: t('mp.visits'), value: String(sum((r) => r.visitsDone)), sub: tf('mp.planned', { n: sum((r) => r.visitsPlanned) }) },
    { label: t('mp.reply'), value: fmtMinutes(replyAll, th, tm) },
    { label: t('mp.followup'), value: active ? `${Math.round((followed / active) * 100)}%` : '-', sub: tf('mp.nofollow', { n: active - followed }), warn: active - followed > 0 },
    { label: t('mp.relances'), value: String(sum((r) => r.relancesToday)) },
    { label: t('mp.offers'), value: String(sum((r) => r.offers)) },
    { label: t('mp.chat2visit'), value: chat ? `${Math.round((conv / chat) * 100)}%` : '-', sub: tf('mp.chat2visit.sub', { a: conv, b: chat }) },
    { label: t('mp.risk'), value: String(manager ? riskTotal : sum((r) => r.atRisk)), warn: (manager ? riskTotal : sum((r) => r.atRisk)) > 0 },
  ]

  return (
    <Card className="mb-5">
      <CardTitle icon={<Gauge size={17} />} title={t(manager ? 'mp.title.manager' : 'mp.title.agent')} right={
        <select className="imo-select" style={{ width: 150 }} value={days} onChange={(e) => setDays(Number(e.target.value) as 7 | 30)} aria-label={t('mp.7d')}>
          <option value={7}>{t('mp.7d')}</option><option value={30}>{t('mp.30d')}</option>
        </select>} />
      <div className="text-[12.5px] t-muted mb-3">{t(manager ? 'mp.sub.manager' : 'mp.sub.agent')}</div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}>
            <div className="text-[11.5px] t-muted">{k.label}</div>
            <div className="text-[22px] font-bold leading-tight">{k.value}</div>
            {k.sub && <div className="text-[11.5px]" style={{ color: k.warn ? '#B45309' : 'var(--muted)' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <div className="rounded-xl p-3" style={{ border: '1px solid var(--gold)' }}>
          <div className="flex items-center gap-2 font-semibold text-[14px] mb-1"><Trophy size={16} style={{ color: '#C9A24B' }} /> {t('mp.best.title')}</div>
          {manager ? (best ? (
            <div className="flex items-center gap-3 mt-2">
              <Avatar name={best.agent} size={42} />
              <div><div className="font-bold">{best.agent}</div><div className="text-[12.5px]">{tf('mp.best.pts', { n: best.weekPoints })}</div><div className="text-[11.5px] t-muted">{tf('mp.best.breakdown', { d: best.weekDeals, v: best.weekVisits, c: best.weekConv })}</div></div>
            </div>
          ) : <div className="text-[13px] t-muted mt-2">{t('mp.best.none')}</div>) : (
            <div className="mt-2"><div className="text-[12.5px] t-muted">{t('mp.best.mine')}</div><div className="text-[22px] font-bold">{tf('mp.best.pts', { n: mine?.weekPoints ?? 0 })}</div><div className="text-[11.5px] t-muted">{tf('mp.best.breakdown', { d: mine?.weekDeals ?? 0, v: mine?.weekVisits ?? 0, c: mine?.weekConv ?? 0 })}</div></div>
          )}
          <div className="text-[11px] t-muted mt-2">{t('mp.best.rule')}</div>
        </div>

        <div className="lg:col-span-2 rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 font-semibold text-[14px] mb-1"><AlertTriangle size={16} style={{ color: '#B45309' }} /> {t('risk.title')} {riskTotal > 0 && manager && <Badge color="#B45309">{riskTotal}</Badge>}</div>
          {risk.length === 0 ? <div className="text-[13px] t-muted mt-2">{t('risk.empty')}</div> : (
            <ul className="grid gap-1.5 mt-2">
              {risk.map((r) => (
                <li key={r.lead.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                  <Link href={`/immo/leads?q=${encodeURIComponent(r.lead.name)}`} className="font-semibold">{r.lead.name}</Link>
                  <span className="t-muted">{r.lead.agent ?? t('as.unassigned')} · {tf('risk.idle', { n: r.idleDays })}</span>
                  {r.reasons.map((x) => <Badge key={x} color={x === 'orphan' ? '#DC2626' : '#B45309'}>{t('risk.' + x)}</Badge>)}
                </li>
              ))}
            </ul>
          )}
          <div className="text-[11px] t-muted mt-2">{t('risk.rule')}</div>
        </div>
      </div>

      {manager && (
        <div className="mt-4" style={{ overflowX: 'auto' }}>
          <table className="imo-table">
            <thead><tr><th>{t('mp.agent')}</th><th>{t('mp.conv')}</th><th>{t('mp.visits')}</th><th>{t('mp.reply')}</th><th>{t('mp.followup')}</th><th>{t('mp.relances')}</th><th>{t('mp.offers')}</th><th>{t('mp.chat2visit')}</th><th>{t('mp.risk')}</th><th>{t('mp.lastact')}</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={10}><Empty title={t('risk.empty')} /></td></tr>}
              {rows.map((r) => (
                <tr key={r.agent}>
                  <td className="font-medium whitespace-nowrap"><span className="flex items-center gap-2"><Avatar name={r.agent} size={24} />{r.agent}</span></td>
                  <td>{r.conversations}{r.unanswered > 0 && <span className="text-[11px]" style={{ color: '#B45309' }}> ({tf('mp.unanswered', { n: r.unanswered })})</span>}</td>
                  <td>{r.visitsDone} <span className="t-muted text-[11px]">/ {r.visitsPlanned}</span></td>
                  <td className="whitespace-nowrap">{fmtMinutes(r.replyMedianMin, th, tm)} <span className="t-muted text-[11px]">({pct(r.repliedWithinHourPct)} ≤1{th})</span></td>
                  <td className="whitespace-nowrap">{pct(r.followUpPct)} <span className="t-muted text-[11px]">({tf('mp.nofollow', { n: r.noFollowUp })})</span></td>
                  <td>{r.relancesToday}</td><td>{r.offers}</td><td>{pct(r.chatToVisitPct)}</td>
                  <td style={{ color: r.atRisk ? '#B45309' : undefined }}>{r.atRisk}</td>
                  <td className="whitespace-nowrap t-muted text-[12px]">{agoLocal(last[r.agent], t, tf, 'team.noact')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-[11px] t-muted mt-3">{t('mp.how')}</div>
    </Card>
  )
}
