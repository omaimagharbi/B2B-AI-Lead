'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Building2, Target, Users, UserSquare2, MessageSquare, Handshake, Home as HomeIcon, MapPin, Plus, UserPlus, MessageCircle, Megaphone, BarChart3, UsersRound, CheckCircle2, Eye, Sparkles } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, CardTitle, Kpi, PageHead, PropImage, Ring, Empty } from '@/lib/immo-os/ui'
import { ago, lastMonths, monthKey, qar, qarShort, isHot } from '@/lib/immo-os/helpers'
import { LEAD_COLUMNS, PROP_TYPES } from '@/lib/immo-os/types'
import AssistantChat from './assistant-chat'

function growth(items: { created_at: string }[]): number | null {
  const now = Date.now()
  const d30 = 30 * 86400000
  const cur = items.filter((x) => now - new Date(x.created_at).getTime() < d30).length
  const prev = items.filter((x) => { const a = now - new Date(x.created_at).getTime(); return a >= d30 && a < 2 * d30 }).length
  return prev === 0 ? null : Math.round(((cur - prev) / prev) * 100)
}

export default function Dashboard() {
  const { data, me, liveEmpty, seedLive, agents, t, lang } = useImmo()
  const { properties, leads, clients, owners, deals, messages } = data

  const closed = deals.filter((d) => d.status === 'closed')
  const months = lastMonths(6)
  const chart = months.map((m) => ({
    month: m.label,
    Leads: leads.filter((l) => monthKey(l.created_at) === m.key).length,
    'Closed deals': closed.filter((d) => monthKey(d.closed_at ?? d.created_at) === m.key).length,
  }))

  const priceSeries = useMemo(() => lastMonths(12).map((m) => {
    const upto = properties.filter((p) => p.listing === 'sale' && p.created_at.slice(0, 7) <= m.key)
    return { month: m.label, 'Average price': upto.length ? Math.round(upto.reduce((t, p) => t + p.price, 0) / upto.length) : 0 }
  }).filter((x, i, arr) => x['Average price'] > 0 || arr.slice(i).some((y) => y['Average price'] > 0)), [properties])
  const marketDelta = (() => {
    const v = priceSeries.map((x) => x['Average price']).filter(Boolean)
    return v.length >= 2 && v[v.length - 2] > 0 ? Math.round(((v[v.length - 1] - v[v.length - 2]) / v[v.length - 2]) * 1000) / 10 : null
  })()
  const conversion = leads.length ? Math.round((leads.filter((l) => l.status === 'won').length / leads.length) * 100) : 0
  const latestProps = [...properties].sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 4)
  const typeStats = useMemo(() => PROP_TYPES.map((pt) => ({ ...pt, l: t('ty.' + pt.v), n: properties.filter((p) => p.type === pt.v).length })).filter((x) => x.n).sort((a, b) => b.n - a.n), [properties, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const areaStats = useMemo(() => {
    const c: Record<string, number> = {}
    properties.forEach((p) => p.area && (c[p.area] = (c[p.area] || 0) + 1))
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [properties])
  const sale = properties.filter((p) => p.listing === 'sale' && p.status === 'available')
  const avgPrice = sale.length ? sale.reduce((s, p) => s + p.price, 0) / sale.length : 0

  // Taux de reponse : contacts ayant ecrit et auxquels on a repondu apres leur dernier message
  const threads = useMemo(() => {
    const by: Record<string, typeof messages> = {}
    messages.forEach((m) => (by[m.contact_name] = [...(by[m.contact_name] ?? []), m]))
    return Object.entries(by).map(([name, ms]) => {
      const s = [...ms].sort((a, b) => a.created_at.localeCompare(b.created_at))
      return { name, last: s[s.length - 1], unread: s.filter((x) => x.unread).length, replied: s[s.length - 1].direction === 'out' }
    }).sort((a, b) => b.last.created_at.localeCompare(a.last.created_at))
  }, [messages])
  const inboundThreads = threads.filter((t) => messages.some((m) => m.contact_name === t.name && m.direction === 'in'))
  const responseRate = inboundThreads.length ? Math.round((inboundThreads.filter((t) => t.replied).length / inboundThreads.length) * 100) : 0

  const stale = leads.filter((l) => !['won', 'lost'].includes(l.status) && Date.now() - new Date(l.last_contact).getTime() > 48 * 3600000)

  const agentRows = useMemo(() => agents.map((a) => {
    const ls = leads.filter((l) => l.agent === a)
    const ds = closed.filter((d) => d.agent === a)
    const conv = ls.length ? Math.round((ds.length / ls.length) * 1000) / 10 : 0
    return { a, leads: ls.length, viewings: ls.filter((l) => ['viewing', 'negotiation', 'won'].includes(l.status)).length, deals: ds.length, conv }
  }).filter((r) => r.leads || r.deals).sort((x, y) => y.deals - x.deals || y.leads - x.leads).slice(0, 5), [agents, leads, closed])

  const activities = useMemo(() => [
    ...leads.map((l) => ({ at: l.created_at, icon: <Target size={15} />, color: '#10B981', t: `${t('a.lead')} ${l.name}`, s: l.interest ?? '' })),
    ...closed.map((d) => ({ at: d.closed_at ?? d.created_at, icon: <CheckCircle2 size={15} />, color: '#16A34A', t: t('a.deal'), s: `${d.title} | ${qar(d.value)}` })),
    ...messages.filter((m) => m.direction === 'in').map((m) => ({ at: m.created_at, icon: <MessageCircle size={15} />, color: '#3B82F6', t: `${t('a.msg')} ${m.contact_name}`, s: m.body })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4), [leads, closed, messages, lang])

  const featured = properties.filter((p) => p.featured && p.status === 'available').slice(0, 4)
  const recent = [...leads].sort((a, b) => b.last_contact.localeCompare(a.last_contact)).slice(0, 5)
  const statusMeta = (s: string) => LEAD_COLUMNS.find((c) => c.v === s)!

  return (
    <div>
      <PageHead
        icon={<HomeIcon size={30} />}
        title={t('nav.dashboard')}
        sub={t('dash.sub')}
        right={<span className="imo-card px-3.5 py-2 text-[13px] font-medium">{t('today')} {new Date().toLocaleDateString(lang === 'ar' ? 'ar-QA-u-nu-latn' : lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
      />

      {liveEmpty && (
        <Card className="mb-5" style={{ borderColor: 'var(--gold)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><div className="font-semibold">Your workspace is empty</div><div className="text-[13px] t-muted">Add your first property, or load sample Qatar data to explore every screen.</div></div>
            <div className="flex gap-2"><Link href="/immo/properties"><Btn kind="primary"><Plus size={14} /> Add property</Btn></Link><Btn kind="gold" onClick={seedLive}><Sparkles size={14} /> Load sample data</Btn></div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-6 mb-4">
        <Kpi vs={t('vs')} icon={<Building2 size={22} />} color="#2563EB" label={t('k.props')} value={properties.length} delta={growth(properties)} />
        <Kpi vs={t('vs')} icon={<Target size={22} />} color="#16A34A" label={t('k.leads')} value={leads.length} delta={growth(leads)} />
        <Kpi vs={t('vs')} icon={<Users size={22} />} color="#7C3AED" label={t('k.clients')} value={clients.length} delta={growth(clients)} />
        <Kpi vs={t('vs')} icon={<UserSquare2 size={22} />} color="#F97316" label={t('k.owners')} value={owners.length} delta={growth(owners)} />
        <Kpi vs={t('vs')} icon={<MessageSquare size={22} />} color="#0891B2" label={t('k.convs')} value={messages.length.toLocaleString()} delta={growth(messages)} />
        <Kpi vs={t('vs')} icon={<Handshake size={22} />} color="#E11D48" label={t('k.deals')} value={closed.length} delta={growth(closed)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_.8fr_.8fr_1.35fr] mb-4">
        <Card className="xl:col-span-1">
          <CardTitle icon={<BarChart3 size={17} />} title={t('market')} />
          <div className="text-right -mt-1 mb-1"><div className="text-[11px] t-muted">Average asking price (sale)</div><div className="text-[20px] font-bold" style={{ color: '#2563EB' }}>{qar(avgPrice)}</div>
            {marketDelta !== null && <div className="text-[12px] font-semibold" style={{ color: marketDelta >= 0 ? 'var(--good)' : 'var(--bad)' }}>{marketDelta >= 0 ? '↑' : '↓'} {Math.abs(marketDelta)}% <span className="t-muted font-normal">vs. last month</span></div>}</div>
          <div style={{ height: 150 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceSeries} margin={{ left: -6, right: 8, top: 6 }}>
                <defs><linearGradient id="mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563EB" stopOpacity={0.35} /><stop offset="1" stopColor="#2563EB" stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => qarShort(Number(v))} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => qar(Number(v))} />
                <Area type="monotone" dataKey="Average price" stroke="#2563EB" strokeWidth={2.5} fill="url(#mk)" dot={{ r: 3, fill: '#2563EB' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle title={t('types')} />
          {typeStats.length === 0 && <Empty title={t('none.props')} />}
          <div className="flex flex-col gap-3">
            {typeStats.map((t) => (
              <div key={t.v}>
                <div className="flex justify-between text-[13px]"><span>{t.l}</span><span className="font-semibold">{Math.round((t.n / properties.length) * 100)}%</span></div>
                <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full" style={{ width: `${(t.n / properties.length) * 100}%`, background: '#2563EB' }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle title={t('areas')} />
          {areaStats.length === 0 && <Empty title="No areas yet" />}
          <div className="flex flex-col gap-3">
            {areaStats.map(([a, n]) => (
              <div key={a} className="flex items-center gap-2 text-[13px]"><MapPin size={14} style={{ color: '#2563EB' }} /><span className="flex-1">{a}</span><span className="font-semibold">{Math.round((n / properties.length) * 100)}%</span></div>
            ))}
          </div>
        </Card>

        <Card pad={false}>
          <div className="p-4 pb-2"><CardTitle title={t('featured')} right={<Link href="/immo/properties" className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>{t('viewall')}</Link>} /></div>
          {featured.length === 0 ? <Empty title="No featured properties" sub="Mark a property as featured to show it here." /> : (
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              {featured.map((p) => (
                <div key={p.id} className="text-[12px]">
                  <PropImage p={p} h={72} />
                  <div className="font-semibold mt-1 truncate">{p.title} · {p.area}</div>
                  <div className="font-bold">{qar(p.price)}{p.listing === 'rent' ? '/mo' : ''}</div>
                  <div className="t-muted">{p.beds} bd · {p.baths} ba · {p.size_m2} m²</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1.1fr_1.1fr] mb-8">
        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle icon={<Target size={17} />} title={t('recentleads')} right={<Link href="/immo/leads" className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>{t('viewall')}</Link>} /></div>
          <div className="overflow-x-auto imo-scroll">
            <table className="imo-table">
              <thead><tr><th>{t('h.name')}</th><th>{t('h.interest')}</th><th>{t('h.budget')}</th><th>{t('h.status')}</th><th>{t('h.last')}</th></tr></thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id}>
                    <td><div className="flex items-center gap-2"><Avatar name={l.name} size={26} /><span className="font-medium">{l.name}</span></div></td>
                    <td className="t-muted">{l.interest ?? '-'}</td>
                    <td>{qar(l.budget)}</td>
                    <td>{isHot(l) ? <Badge color="#EF4444">{t('s.hot')}</Badge> : <Badge color={statusMeta(l.status).color}>{t('s.' + l.status)}</Badge>}</td>
                    <td className="t-muted">{ago(l.last_contact)}</td>
                  </tr>
                ))}
                {recent.length === 0 && <tr><td colSpan={5}><Empty title={t('none.leads')} /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle icon={<BarChart3 size={17} />} title={t('perf')} right={<Link href="/immo/reports" className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>{t('details')}</Link>} />
          <div className="flex items-center gap-4">
            <Ring pct={responseRate} />
            <div><div className="font-semibold">{t('resp')}</div><div className="text-[12px] t-muted">{t('resp.sub')}</div></div>
          </div>
          <div className="grid grid-cols-3 text-center mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div><div className="text-[20px] font-bold">{leads.length}</div><div className="text-[11px] t-muted">{t('k.leads')}</div></div>
            <div><div className="text-[20px] font-bold">{leads.filter((l) => l.status === 'viewing').length}</div><div className="text-[11px] t-muted">{t('viewings')}</div></div>
            <div><div className="text-[20px] font-bold">{closed.length}</div><div className="text-[11px] t-muted">{t('k.deals')}</div></div>
          </div>
          <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: 'var(--soft)', border: '1px solid var(--border)' }}>
            <div className="font-semibold flex items-center gap-1.5"><Sparkles size={14} style={{ color: 'var(--gold)' }} /> {t('aisug')}</div>
            <div className="t-muted mt-1">{stale.length ? t('sug.some').replace('{n}', String(stale.length)) : t('sug.none')}</div>
            {stale.length > 0 && <Link href="/immo/leads"><Btn kind="primary" className="mt-2" style={{ padding: '5px 12px' }}>{t('viewleads')}</Btn></Link>}
          </div>
        </Card>

        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle icon={<MessageCircle size={17} style={{ color: '#22C55E' }} />} title={t('latestconv')} right={<Link href="/immo/whatsapp" className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>{t('viewall')}</Link>} /></div>
          <div className="px-4 pb-3 flex flex-col">
            {threads.slice(0, 5).map((t) => (
              <Link key={t.name} href="/immo/whatsapp" className="flex items-center gap-2.5 py-2" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                <Avatar name={t.name} size={32} />
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold truncate">{t.name}</div><div className="text-[12px] t-muted truncate">{t.last.body}</div></div>
                <div className="text-right shrink-0"><div className="text-[11px] t-muted">{ago(t.last.created_at)}</div>{t.unread > 0 && <span className="inline-flex items-center justify-center text-[10px] font-bold rounded-full w-4 h-4" style={{ background: '#22C55E', color: '#fff' }}>{t.unread}</span>}</div>
              </Link>
            ))}
            {threads.length === 0 && <Empty title={t('none.convs')} />}
          </div>
        </Card>

        <div className="min-h-[300px]"><AssistantChat compact /></div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="text-[15px] font-semibold">{t('insights')}</div>
        <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1.1fr] mb-5">
        <Card>
          <CardTitle icon={<BarChart3 size={17} />} title={t('salesperf')} right={<span className="text-[11.5px] t-muted">{t('last6')}</span>} />
          <div className="flex items-center gap-3"><div style={{ height: 190, flex: 1, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ left: -18, right: 8, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Leads" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Closed deals" stroke="#C9A24B" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center shrink-0"><Ring pct={conversion} size={88} color="#16A34A" /><div className="text-[12px] font-semibold mt-1">{t('conv')}</div><div className="text-[11px] t-muted">{t('conv.sub')}</div></div></div>
        </Card>

        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle icon={<Building2 size={17} />} title={t('latestprops')} right={<Link href="/immo/properties?new=1"><Btn kind="primary" style={{ padding: '5px 12px' }}><Plus size={13} /> {t('addnew')}</Btn></Link>} /></div>
          <div className="px-4 pb-3 flex flex-col">
            {latestProps.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 84, flexShrink: 0 }}><PropImage p={p} h={56} /></div>
                <div className="min-w-0 flex-1 text-[12.5px]"><div className="font-semibold truncate">{p.title} <Badge color={p.listing === 'rent' ? '#2563EB' : '#16A34A'}>{p.listing === 'rent' ? t('forrent') : t('forsale')}</Badge></div><div className="t-muted">{p.area}</div><div className="font-bold">{qar(p.price)}{p.listing === 'rent' ? t('permonth') : ''}</div><div className="t-muted text-[11.5px]">{p.beds} {t('beds')} · {p.baths} {t('baths')} · {p.size_m2} m²</div></div>
              </div>
            ))}
            {latestProps.length === 0 && <Empty title={t('none.props')} />}
          </div>
        </Card>

        <Card>
          <CardTitle icon={<BarChart3 size={17} />} title={t('minsights')} right={<Link href="/immo/reports" className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>{t('fullreport')}</Link>} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[12px] font-semibold mb-2">{t('demanded')}</div>
              <div className="flex flex-col gap-2.5">
                {areaStats.map(([a, n], i) => (<div key={a}><div className="flex justify-between text-[11.5px]"><span>{a}</span><span className="font-semibold">{Math.round((n / properties.length) * 100)}%</span></div><div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full" style={{ width: `${(n / areaStats[0][1]) * 100}%`, background: ['#2563EB', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'][i % 5] }} /></div></div>))}
                {areaStats.length === 0 && <div className="text-[12px] t-muted">No data yet</div>}
              </div>
            </div>
            <div>
              <div className="text-[12px] font-semibold mb-1">{t('ptypes')}</div>
              <div style={{ height: 120, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={typeStats} dataKey="n" nameKey="l" innerRadius={34} outerRadius={52} paddingAngle={2} stroke="none">{typeStats.map((t, i) => <Cell key={t.v} fill={['#2563EB', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#84CC16'][i % 6]} />)}</Pie><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} /></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-[10px] t-muted">{t('total')}</div><div className="text-[17px] font-bold leading-none">{properties.length}</div></div>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">{typeStats.slice(0, 4).map((t, i) => <div key={t.v} className="flex items-center gap-1.5 text-[11px]"><span className="w-2 h-2 rounded-full" style={{ background: ['#2563EB', '#F59E0B', '#10B981', '#8B5CF6'][i] }} />{t.l} <span className="ml-auto font-semibold">{Math.round((t.n / properties.length) * 100)}%</span></div>)}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr_1fr]">
        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle icon={<UsersRound size={17} />} title={t('topagents')} /></div>
          <div className="overflow-x-auto imo-scroll">
            <table className="imo-table">
              <thead><tr><th>#</th><th>{t('h.agent')}</th><th>{t('h.leads')}</th><th>{t('viewings')}</th><th>{t('h.deals')}</th><th>{t('h.conv')}</th></tr></thead>
              <tbody>
                {agentRows.map((r, i) => (
                  <tr key={r.a}><td>{i + 1}</td><td><div className="flex items-center gap-2"><Avatar name={r.a} size={26} />{r.a}</div></td><td>{r.leads}</td><td>{r.viewings}</td><td>{r.deals}</td>
                    <td><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--border)' }}><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, r.conv * 4)}%`, background: r.conv >= 10 ? '#16A34A' : r.conv >= 5 ? '#2563EB' : '#94A3B8' }} /></div>{r.conv}%</div></td></tr>
                ))}
                {agentRows.length === 0 && <tr><td colSpan={6}><Empty title={t('none.agents')} /></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle title={t('quick')} />
          <div className="grid grid-cols-3 gap-2">
            {[
              { h: '/immo/properties?new=1', i: <Building2 size={20} />, l: t('q.prop') }, { h: '/immo/leads?new=1', i: <UserPlus size={20} />, l: t('q.lead') },
              { h: '/immo/whatsapp', i: <MessageCircle size={20} />, l: t('q.wa') }, { h: '/immo/marketing', i: <Megaphone size={20} />, l: t('q.ad') },
              { h: '/immo/reports', i: <BarChart3 size={20} />, l: t('q.rep') }, { h: '/immo/team', i: <UsersRound size={20} />, l: t('q.team') },
            ].map((a) => (
              <Link key={a.l} href={a.h} className="rounded-xl py-3 flex flex-col items-center gap-1 text-[11.5px] font-medium text-center" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                <span style={{ color: 'var(--blue)' }}>{a.i}</span>{a.l}
              </Link>
            ))}
          </div>
          <div className="mt-3 text-[12px] t-muted flex items-center gap-1.5"><Eye size={13} /> {t('avgprice')}: <b className="t-main">{qarShort(avgPrice)} QAR</b></div>
        </Card>

        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle title={t('recentact')} /></div>
          <div className="px-4 pb-3 flex flex-col gap-2.5">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${a.color}22`, color: a.color }}>{a.icon}</div>
                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{a.t}</div><div className="text-[12px] t-muted truncate">{a.s}</div></div>
                <div className="text-[11px] t-muted shrink-0">{ago(a.at)}</div>
              </div>
            ))}
            {activities.length === 0 && <Empty title={t('none.act')} />}
          </div>
        </Card>
      </div>
    </div>
  )
}
