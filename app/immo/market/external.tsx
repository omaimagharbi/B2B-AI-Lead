'use client'

import { useEffect, useMemo, useState } from 'react'
import { Database, Trash2 } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Btn, Card, CardTitle, Field } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { parseMarketCsv, type MarketStat } from '@/lib/immo-os/market-import'
import { qar } from '@/lib/immo-os/helpers'

// n°74 : import de donnees de marche par fichier CSV. La SOURCE est obligatoire et reste affichee a cote des chiffres.
type Imp = { import_id: string; source: string; source_url: string | null; as_of: string | null; rows: number; created_at: string }

export default function ExternalMarket() {
  const { data, t, tf, lang, mode, me, callApi, notify } = useImmo()
  const manager = isManager(me?.role)
  const [imports, setImports] = useState<Imp[] | null>(null)
  const [stats, setStats] = useState<MarketStat[]>([])
  const [src, setSrc] = useState(''), [url, setUrl] = useState(''), [asOf, setAsOf] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseMarketCsv> | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => callApi('/api/immo?r=market-import').then((r) => { if (r.ok) { setImports(r.json.imports); setStats(r.json.stats) } })
  useEffect(() => { if (mode === 'live') load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode])

  // Prix au m2 de VOS biens par zone, pour comparer avec le marche externe
  const own = useMemo(() => {
    const m = new Map<string, number[]>()
    data.properties.filter((p) => p.size_m2 > 0 && p.price > 0 && p.area).forEach((p) => m.set(p.area!, [...(m.get(p.area!) ?? []), p.price / p.size_m2]))
    return (a: string) => { const v = (m.get(a) ?? []).sort((x, y) => x - y); return v.length ? Math.round(v[Math.floor(v.length / 2)]) : null }
  }, [data.properties])

  const onFile = async (f: File | undefined) => { if (f) setParsed(parseMarketCsv(await f.text())) }
  const doImport = async () => {
    if (!parsed?.rows.length) return
    if (src.trim().length < 2) return notify(t('mkx.nosource'), 'err')
    setBusy(true)
    const r = await callApi('/api/immo?r=market-import', { method: 'POST', body: JSON.stringify({ source: src, source_url: url, as_of: asOf, rows: parsed.rows }) })
    setBusy(false)
    if (!r.ok) return notify(r.json?.error ?? t('xm.import_failed'), 'err')
    notify(tf('mkx.done', { n: r.json.rows })); setParsed(null); setSrc(''); setUrl(''); setAsOf(''); load()
  }
  const del = async (id: string) => { if (window.confirm(t('mkx.delete.confirm')) && (await callApi('/api/immo?r=market-import', { method: 'POST', body: JSON.stringify({ action: 'delete_import', import_id: id }) })).ok) load() }

  return (
    <Card className="mt-4">
      <CardTitle icon={<Database size={17} />} title={t('mkx.title')} />
      {mode !== 'live' ? <div className="text-[12.5px]" style={{ color: '#92400E' }}>{t('mkx.demo')}</div> : (
        <div className="grid gap-4 text-[13px]">
          {manager ? (
            <div className="grid gap-3">
              <div className="t-muted">{t('mkx.help')}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label={`${t('mkx.source')} *`}><input className="imo-input" value={src} maxLength={120} onChange={(e) => setSrc(e.target.value)} /></Field>
                <Field label={t('mkx.url')}><input className="imo-input" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
                <Field label={t('mkx.asof')}><input className="imo-input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
              </div>
              <Field label={t('mkx.file')}><input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} /></Field>
              {parsed && (
                <div className="grid gap-1">
                  <div><b>{tf('mkx.preview', { n: parsed.rows.length })}</b> / {parsed.total}</div>
                  {parsed.errors.map((e) => <div key={e} style={{ color: '#B91C1C' }}>{e}</div>)}
                  {parsed.rows.length > 0 && <div><Btn kind="primary" disabled={busy || src.trim().length < 2} onClick={doImport}>{t('mkx.import')}</Btn></div>}
                </div>
              )}
            </div>
          ) : <div className="t-muted">{t('mkx.managers')}</div>}
          {imports && imports.length === 0 && <div className="t-muted">{t('mkx.none')}</div>}
          {imports && imports.length > 0 && (
            <div className="grid gap-1.5">
              {imports.map((i) => (
                <div key={i.import_id} className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <span><b>{tf('mkx.src', { source: i.source, date: i.as_of ? new Date(i.as_of).toLocaleDateString(lang) : new Date(i.created_at).toLocaleDateString(lang) })}</b> <span className="t-muted">· {i.rows} {t('mkx.count').toLowerCase()}</span>{i.source_url && <> · <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="underline" dir="ltr">link</a></>}</span>
                  {manager && <Btn kind="danger" style={{ padding: '2px 8px', fontSize: 12, marginInlineStart: 'auto' }} onClick={() => del(i.import_id)} title={t('mkx.delete')} aria-label={t('mkx.delete')}><Trash2 size={12} /></Btn>}
                </div>
              ))}
            </div>
          )}
          {stats.length > 0 && (
            <div className="overflow-x-auto"><div className="imo-label">{t('mkx.stats')} <span className="t-muted font-normal">· {Array.from(new Set((imports ?? []).map((i) => i.source))).join(', ')}</span></div>
              <table className="imo-table"><thead><tr><th>{t('zone.zone')}</th><th>{t('x38.type')}</th><th>{t('mkx.count')}</th><th>{t('mkx.median')}</th><th>{t('mkx.ppm')}</th><th /></tr></thead>
                <tbody>{stats.slice(0, 15).map((s, i) => { const o = own(s.area); return <tr key={i}><td>{s.area}</td><td>{s.type ?? '-'}</td><td>{s.count}</td><td>{qar(s.medianPrice)}</td><td>{s.medianPerM2 ? qar(s.medianPerM2) : '-'}</td><td className="t-muted text-[12px]">{o ? tf('mkx.yours', { n: qar(o) }) : ''}</td></tr> })}</tbody></table></div>
          )}
        </div>
      )}
    </Card>
  )
}
