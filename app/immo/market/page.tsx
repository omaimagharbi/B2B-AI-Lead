'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, Sparkles } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, Empty, PageHead } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { lastMonths, qar } from '@/lib/immo-os/helpers'
import { budgetGap, marketContext, momChange, priceTrend, typeMix, zoneStats } from '@/lib/immo-os/market'
import { fallbackMarket } from '@/lib/immo-os/fallbacks'

const tip = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }
const ax = { fontSize: 11, fill: 'var(--muted)' }
const arrow = (v: number | null) => (v === null ? '-' : `${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)}%`)

// Market Intelligence interne (n°37, 51, 73, 57). Donnees = biens et leads de l'agence uniquement.
export default function MarketPage() {
  const { data, me, ai, t, tf } = useImmo()
  const manager = isManager(me?.role)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const zones = useMemo(() => zoneStats(data, manager), [data, manager])
  const trend = useMemo(() => priceTrend(data, lastMonths(12)), [data])
  const mom = momChange(trend)
  const gap = useMemo(() => budgetGap(data, manager), [data, manager])
  const mix = useMemo(() => typeMix(data), [data])
  const hot = manager ? [...zones].filter((z) => z.leads > 0).sort((a, b) => b.leads - a.leads).slice(0, 3) : []

  const run = async () => {
    setBusy(true)
    const r = await ai('market', '', { context: marketContext(data, manager) })
    setText(r ?? fallbackMarket(data))
    setBusy(false)
  }

  return (
    <div>
      <PageHead icon={<TrendingUp size={28} />} title={t('mk.title')} sub={t('mk.sub')} right={<Btn kind="primary" disabled={busy || !data.properties.length} onClick={run}><Sparkles size={15} /> {busy ? t('mk.ai.wait') : t('mk.ai.btn')}</Btn>} />
      {data.properties.length === 0 ? <Card><Empty title={t('mk.empty')} /></Card> : (
        <div className="grid gap-5">
          {text && <Card style={{ borderColor: 'var(--gold)' }}><CardTitle icon={<Sparkles size={17} />} title={t('mk.ai')} /><div className="text-[13.5px] whitespace-pre-line">{text}</div></Card>}

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardTitle title={t('mk.trend')} right={mom !== null ? <Badge color={mom >= 0 ? '#16A34A' : '#DC2626'}>{tf('mk.mom', { p: mom })}</Badge> : undefined} />
              {trend.length < 2 ? <div className="text-[13px] t-muted">{t('mk.nodata')}</div> : (
                <div dir="ltr" style={{ height: 220 }}>
                  <ResponsiveContainer><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={ax} /><YAxis tick={ax} width={64} tickFormatter={(v) => `${Math.round(v / 1000)}k`} /><Tooltip contentStyle={tip} formatter={(v) => qar(Number(v))} /><Line type="monotone" dataKey="price" stroke="#C9A24B" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card>
              <CardTitle title={t('mk.budget')} />
              <div className="grid gap-2 text-[13px]">
                <div className="flex justify-between"><span className="t-muted">{t('mk.price.med')}</span><b>{gap.medianPrice ? qar(gap.medianPrice) : '-'}</b></div>
                {manager ? <div className="flex justify-between"><span className="t-muted">{t('mk.budget.med')}</span><b>{gap.medianBudget ? qar(gap.medianBudget) : '-'}</b></div> : <div className="text-[12px] t-muted">{t('mk.demand.mgr')}</div>}
                {manager && gap.gapPct !== null && <div className="flex justify-between"><span className="t-muted">%</span><Badge color={gap.gapPct >= 0 ? '#16A34A' : '#B45309'}>{gap.gapPct > 0 ? '+' : ''}{gap.gapPct}%</Badge></div>}
              </div>
              <div className="mt-4 text-[12px] font-semibold t-muted">{t('mk.types')}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">{mix.map((x) => <Badge key={x.type} color="#475569">{t('pt.' + x.type)} · {x.n}</Badge>)}</div>
            </Card>
          </div>

          {manager && hot.length > 0 && (
            <Card><CardTitle title={t('mk.hot')} /><div className="flex flex-wrap gap-2">{hot.map((z) => <Badge key={z.zone} color="#B45309">{z.zone} · {z.leads} {t('mk.leads')}</Badge>)}</div></Card>
          )}

          <Card pad={false}>
            <div className="p-4 pb-1"><CardTitle title={`${t('mk.avgprice')} / ${t('mk.demand')}`} /></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="imo-table">
                <thead><tr><th>{t('mk.zone')}</th><th>{t('mk.listings')}</th><th>{t('mk.sale')}</th><th>{t('mk.rent')}</th><th>{t('mk.ppm2')}</th>{manager && <><th>{t('mk.leads')}</th><th>{t('mk.available')}</th><th>{t('mk.ratio')}</th></>}<th>{t('mk.zonetrend')}</th></tr></thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.zone}>
                      <td className="font-medium">{z.zone}</td><td>{z.listings}</td><td>{z.avgSale ? qar(z.avgSale) : '-'}</td><td>{z.avgRent ? qar(z.avgRent) : '-'}</td><td>{z.ppm2 ? qar(z.ppm2) : '-'}</td>
                      {manager && <><td>{z.leads}</td><td>{z.available}</td><td>{z.ratio ?? '-'}</td></>}
                      <td style={{ color: z.change90 === null ? undefined : z.change90 >= 0 ? '#16A34A' : '#DC2626' }}>{arrow(z.change90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3 pt-2 text-[11.5px] t-muted">{manager ? t('mk.demand.note') : t('mk.demand.mgr')}</div>
          </Card>
        </div>
      )}
    </div>
  )
}
