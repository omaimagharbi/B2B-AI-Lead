'use client'

import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Card, CardTitle } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'

type Info = { configured: boolean; env: 'test' | 'live' | null; site_ok: boolean; has_webhook_secret: boolean; callback_url: string | null; webhook_url: string | null }

// Lot 9 : etat de la configuration du paiement en ligne (gestionnaires). Aucune cle n'est affichee ni stockee ici.
export default function PaymentCard() {
  const { t, tf, mode, me, callApi } = useImmo()
  const [info, setInfo] = useState<Info | null>(null)
  const manager = isManager(me?.role)
  useEffect(() => {
    if (mode !== 'live' || !manager) return
    callApi('/api/immo?r=payments&info=1').then((r) => { if (r.ok) setInfo(r.json) })
  }, [mode, manager]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!manager) return null
  return (
    <Card>
      <CardTitle icon={<CreditCard size={17} />} title={t('pay.set.title')} right={mode === 'live' && info ? <Badge color={info.configured ? '#16A34A' : '#B45309'}>{info.configured ? tf('pay.set.ok', { env: info.env ?? '' }) : t('pay.status.pending')}</Badge> : undefined} />
      <div className="text-[13px] t-muted flex flex-col gap-2">
        {mode === 'demo' && <div>{t('pay.set.demo')}</div>}
        {mode === 'live' && info && !info.configured && <div>{t('pay.set.missing')}</div>}
        {mode === 'live' && info?.configured && info.env === 'test' && <div style={{ color: '#92400E' }}>{t('pay.set.test')}</div>}
        {mode === 'live' && info && !info.site_ok && <div style={{ color: '#B91C1C' }}>{t('pay.set.site')}</div>}
        {mode === 'live' && info?.configured && info.callback_url && <div>{t('pay.set.return')} <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{info.callback_url}</code></div>}
        {mode === 'live' && info?.configured && info.webhook_url && <div>{t('pay.set.webhook')} <code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{info.webhook_url}</code></div>}
        <div>{t('pay.secure')}</div>
      </div>
    </Card>
  )
}
