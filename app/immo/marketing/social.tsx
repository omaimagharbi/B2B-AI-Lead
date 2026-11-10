'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, RefreshCw, Send } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { agoLocal } from '@/lib/immo-os/ago'
import type { Ad } from '@/lib/immo-os/types'

// Lot 8 : publication Facebook / Instagram (n°45 / n°75) et performance des annonces (n°46). Reserve aux gestionnaires (publication publique).
type Info = { configured: boolean; accounts: { fb_page_id: string | null; ig_account_id: string | null } | null; missing?: boolean }

export function usePublishInfo() {
  const { mode, callApi } = useImmo()
  const [info, setInfo] = useState<Info | null>(null)
  const load = () => callApi('/api/immo?r=publish').then((r) => { if (r.ok) setInfo(r.json) })
  useEffect(() => { if (mode === 'live') load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode])
  return { info, reload: load }
}

// Comptes Facebook / Instagram de l'agence
export function SocialAccounts({ info, reload }: { info: Info | null; reload: () => void }) {
  const { t, callApi, notify, me, mode } = useImmo()
  const [fb, setFb] = useState(''), [ig, setIg] = useState('')
  useEffect(() => { setFb(info?.accounts?.fb_page_id ?? ''); setIg(info?.accounts?.ig_account_id ?? '') }, [info])
  if (!isManager(me?.role)) return null
  return (
    <Card className="mb-4">
      <CardTitle icon={<Send size={17} />} title={t('soc.title')} />
      {mode !== 'live' ? <div className="text-[12.5px]" style={{ color: '#92400E' }}>{t('soc.demo')}</div> : (
        <div className="grid gap-3 text-[13px]">
          <div className="t-muted">{t('soc.accounts')}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="imo-input" dir="ltr" inputMode="numeric" placeholder={t('soc.fb')} aria-label={t('soc.fb')} value={fb} onChange={(e) => setFb(e.target.value)} />
            <input className="imo-input" dir="ltr" inputMode="numeric" placeholder={t('soc.ig')} aria-label={t('soc.ig')} value={ig} onChange={(e) => setIg(e.target.value)} />
          </div>
          {info && !info.configured && <div style={{ color: '#92400E' }}>{t('soc.token')}</div>}
          <div><Btn onClick={async () => { const r = await callApi('/api/immo?r=publish', { method: 'POST', body: JSON.stringify({ action: 'save_accounts', fb_page_id: fb, ig_account_id: ig }) }); if (r.ok) { notify(t('soc.saved')); reload() } else notify(r.json?.error ?? 'Failed', 'err') }}>{t('soc.save')}</Btn></div>
        </div>
      )}
    </Card>
  )
}

// Boutons de publication d'une annonce
export function AdPublish({ ad, info, reload }: { ad: Ad; info: Info | null; reload: () => void }) {
  const { t, tf, callApi, notify, me, mode, reload: reloadData } = useImmo()
  const [busy, setBusy] = useState(false)
  if (mode !== 'live' || !isManager(me?.role) || !info?.configured) return null
  const targets = [info.accounts?.fb_page_id && !ad.fb_post_id ? 'facebook' : null, info.accounts?.ig_account_id && !ad.ig_media_id ? 'instagram' : null].filter(Boolean) as ('facebook' | 'instagram')[]
  const go = async () => {
    if (!window.confirm(tf('soc.confirm', { targets: targets.map((x) => t('soc.' + x)).join(' + ') }))) return
    setBusy(true)
    const r = await callApi('/api/immo?r=publish', { method: 'POST', body: JSON.stringify({ action: 'publish', ad_id: ad.id, targets }) })
    setBusy(false)
    if (r.ok && !r.json.errors?.length) notify(t('soc.done'))
    else notify(`${t('soc.failed')}: ${(r.json?.errors ?? [r.json?.error]).filter(Boolean).join(' | ')}`, 'err')
    reloadData(); reload()
  }
  return (
    <>
      {ad.fb_post_id && <Badge color="#1877F2">{t('soc.facebook')}</Badge>}
      {ad.ig_media_id && <Badge color="#C13584">{t('soc.instagram')}</Badge>}
      {targets.length > 0 && <Btn kind="primary" style={{ padding: '4px 9px' }} disabled={busy} onClick={go}><Send size={12} /> {busy ? t('soc.publishing') : `${t('soc.publish')} · ${targets.map((x) => t('soc.' + x)).join(' + ')}`}</Btn>}
      {ad.publish_error && <span className="text-[11.5px]" style={{ color: '#B91C1C' }} title={ad.publish_error}>⚠ {ad.publish_error.slice(0, 80)}</span>}
    </>
  )
}

// n°46 : performance des annonces publiees depuis la plateforme
export function AdPerformance() {
  const { data, t, tf, callApi, notify, me, mode, reload: reloadData, lang } = useImmo()
  const [busy, setBusy] = useState(false)
  const published = useMemo(() => data.ads.filter((a) => a.fb_post_id || a.ig_media_id), [data.ads])
  const total = (k: 'reach' | 'likes' | 'comments' | 'clicks') => published.reduce((n, a) => n + (a[k] ?? 0), 0)
  const best = [...published].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0]
  const leadsBy = (ch: string) => data.leads.filter((l) => l.source === ch).length
  if (!isManager(me?.role) && published.length === 0) return null
  const refresh = async () => {
    setBusy(true)
    for (const a of published.slice(0, 15)) await callApi('/api/immo?r=publish', { method: 'POST', body: JSON.stringify({ action: 'insights', ad_id: a.id }) })
    await reloadData(); setBusy(false); notify(t('perf.updated').replace('{when}', new Date().toLocaleTimeString(lang)))
  }
  const KPIS = [['reach', 'perf.reach'], ['likes', 'perf.likes'], ['comments', 'perf.comments'], ['clicks', 'perf.clicks']] as const
  return (
    <Card className="mb-4">
      <CardTitle icon={<BarChart3 size={17} />} title={t('perf.title')} right={mode === 'live' && isManager(me?.role) && published.length > 0 ? <Btn disabled={busy} onClick={refresh}><RefreshCw size={13} /> {busy ? '…' : t('perf.refresh')}</Btn> : undefined} />
      <div className="text-[12px] t-muted mb-3">{t('perf.help')}</div>
      {published.length === 0 ? <div className="text-[13px] t-muted">{t('perf.none')}</div> : (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mb-3">{KPIS.map(([k, l]) => <div key={k}><div className="text-[20px] font-bold">{total(k).toLocaleString(lang)}</div><div className="text-[12px] t-muted">{t(l)}</div></div>)}</div>
          <div className="grid gap-1.5 text-[13px]">
            {published.map((a) => { const p = data.properties.find((x) => x.id === a.property_id); return (
              <div key={a.id} className="flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <b className="min-w-0 truncate" style={{ maxWidth: 220 }}>{p?.title ?? 'Ad'}</b>
                {a.fb_post_id && <Badge color="#1877F2">{t('soc.facebook')}</Badge>}{a.ig_media_id && <Badge color="#C13584">{t('soc.instagram')}</Badge>}
                <span className="t-muted">{t('perf.reach')} {a.reach ?? '-'} · {t('perf.likes')} {a.likes ?? '-'} · {t('perf.comments')} {a.comments ?? '-'} · {t('perf.clicks')} {a.clicks ?? '-'}</span>
                <span className="t-muted text-[11.5px] ms-auto">{a.metrics_at ? tf('perf.updated', { when: agoLocal(a.metrics_at, t, tf) }) : ''}</span>
              </div>) })}
          </div>
          <div className="mt-3 text-[12.5px] t-muted flex flex-wrap gap-x-4">{best && best.reach ? <span>{t('perf.best')}: <b>{data.properties.find((x) => x.id === best.property_id)?.title ?? 'Ad'}</b></span> : null}<span>{tf('perf.leads', { n: leadsBy('instagram') })} (Instagram)</span><span>{tf('perf.leads', { n: leadsBy('facebook') })} (Facebook)</span></div>
        </>
      )}
    </Card>
  )
}
