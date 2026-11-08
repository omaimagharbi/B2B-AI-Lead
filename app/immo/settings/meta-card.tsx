'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, Field } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'

type Num = { id: string; phone_number_id: string; waba_id: string | null; display_phone: string | null; label: string | null; active: boolean }
type Tpl = { name: string; language: string; category: string | null; status: string }
type Info = { channel: 'meta' | 'greenapi'; missing: boolean; numbers: Num[]; templates: Tpl[]; env?: { token: boolean; appSecret: boolean; verifyToken: boolean } }

// Lot 6a (n°34 / n°77) : numeros WhatsApp Business (Meta) de l'agence, modeles de messages, etat de la configuration serveur.
export default function MetaCard() {
  const { t, tf, mode, me, callApi, notify } = useImmo()
  const manager = isManager(me?.role)
  const [info, setInfo] = useState<Info | null>(null)
  const [f, setF] = useState({ phone_number_id: '', waba_id: '', display_phone: '', label: '' })
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { const r = await callApi('/api/immo?r=wa'); if (r.ok) setInfo(r.json) }, [callApi])
  useEffect(() => { if (mode === 'live') load() }, [mode, load])
  if (!manager) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const post = async (body: Record<string, unknown>) => { setBusy(true); const r = await callApi('/api/immo?r=wa', { method: 'POST', body: JSON.stringify(body) }); setBusy(false); if (!r.ok) notify(r.json?.error ?? 'Failed', 'err'); return r }

  return (
    <Card className="lg:col-span-2">
      <CardTitle icon={<MessageCircle size={17} style={{ color: '#22C55E' }} />} title={t('wa.title')} right={info && <Badge color={info.channel === 'meta' ? '#16A34A' : '#64748B'}>{t('wa.channel.' + info.channel)}</Badge>} />
      {mode !== 'live' ? <div className="text-[13px]" style={{ color: '#92400E' }}>{t('wa.demo')}</div> : !info ? <div className="text-[13px] t-muted">…</div> : (
        <div className="grid gap-5 lg:grid-cols-2 text-[13px]">
          <div className="grid gap-3 content-start">
            {info.missing && <div style={{ color: '#92400E' }}>{t('wa.missing')}</div>}
            <div><div className="imo-label">{t('wa.env')}</div>
              <div className="grid gap-1">{info.env && ([['META_WA_ACCESS_TOKEN', info.env.token], ['META_WA_APP_SECRET', info.env.appSecret], ['META_WA_VERIFY_TOKEN', info.env.verifyToken]] as [string, boolean][]).map(([k, ok]) => <div key={k} className="flex justify-between gap-2"><code dir="ltr">{k}</code><Badge color={ok ? '#16A34A' : '#EF4444'}>{ok ? t('wa.env.ok') : t('wa.env.missing')}</Badge></div>)}</div></div>
            <div><div className="imo-label">{t('wa.webhook')}</div><code dir="ltr" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{`${origin}/api/immo?r=meta`}</code></div>
            <div><div className="imo-label">{t('wa.numbers')}</div>
              {info.numbers.length === 0 ? <div className="t-muted">{t('wa.num.none')}</div> : <div className="grid gap-1.5">{info.numbers.map((n) => <div key={n.id} className="flex items-center justify-between gap-2"><span><b>{n.label || n.display_phone || n.phone_number_id}</b> <span className="t-muted" dir="ltr">{n.display_phone ?? ''} · ID {n.phone_number_id}</span></span><Btn kind="danger" style={{ padding: '3px 8px', fontSize: 12 }} onClick={async () => { if (window.confirm(t('wa.num.remove.confirm')) && (await post({ action: 'remove_number', id: n.id })).ok) load() }}>{t('wa.num.remove')}</Btn></div>)}</div>}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t('wa.num.id')}><input className="imo-input" dir="ltr" inputMode="numeric" value={f.phone_number_id} onChange={(e) => setF({ ...f, phone_number_id: e.target.value })} /></Field>
              <Field label={t('wa.num.waba')}><input className="imo-input" dir="ltr" inputMode="numeric" value={f.waba_id} onChange={(e) => setF({ ...f, waba_id: e.target.value })} /></Field>
              <Field label={t('wa.num.display')}><input className="imo-input" dir="ltr" value={f.display_phone} onChange={(e) => setF({ ...f, display_phone: e.target.value })} /></Field>
              <Field label={t('wa.num.label')}><input className="imo-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
            </div>
            <div><Btn kind="primary" disabled={busy || !f.phone_number_id.trim()} onClick={async () => { if ((await post({ action: 'add_number', ...f })).ok) { notify(t('wa.num.saved')); setF({ phone_number_id: '', waba_id: '', display_phone: '', label: '' }); load() } }}>{t('wa.num.add')}</Btn></div>
          </div>
          <div className="grid gap-3 content-start">
            <div className="flex items-center justify-between gap-2"><div className="imo-label" style={{ margin: 0 }}>{t('wa.templates')}</div><Btn disabled={busy} onClick={async () => { const r = await post({ action: 'sync_templates' }); if (r.ok) { notify(tf('wa.tpl.synced', { n: r.json.count })); load() } }}><RefreshCw size={13} /> {t('wa.tpl.sync')}</Btn></div>
            {info.templates.length === 0 ? <div className="t-muted">{t('wa.tpl.none')}</div> : <div className="grid gap-1.5">{info.templates.map((x) => <div key={`${x.name}|${x.language}`} className="flex items-center justify-between gap-2"><span><b dir="ltr">{x.name}</b> <span className="t-muted">{x.language}{x.category ? ` · ${x.category}` : ''}</span></span><Badge color={x.status === 'APPROVED' ? '#16A34A' : x.status === 'PENDING' ? '#F59E0B' : '#EF4444'}>{x.status}</Badge></div>)}</div>}
          </div>
        </div>
      )}
    </Card>
  )
}
