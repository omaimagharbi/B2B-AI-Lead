'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, HelpCircle } from 'lucide-react'
import { translate, isRtl, type Lang } from '@/lib/immo-os/i18n'

// Lot 9 : page publique de retour apres un paiement MyFatoorah. Elle n'affiche que ce que le serveur a deja VERIFIE aupres de MyFatoorah
// (api/payments.ts) : le statut dans l'adresse n'est jamais cru comme preuve de paiement, il ne sert qu'a afficher un message.
const VIEW: Record<string, { icon: typeof Clock; color: string; key: string }> = {
  paid: { icon: CheckCircle2, color: '#16A34A', key: 'pay.pub.paid' },
  failed: { icon: XCircle, color: '#DC2626', key: 'pay.pub.failed' },
  pending: { icon: Clock, color: '#B45309', key: 'pay.pub.pending' },
  unknown: { icon: HelpCircle, color: '#64748B', key: 'pay.pub.unknown' },
}

function Inner() {
  const q = useSearchParams()
  const l = q.get('lang'); const lang: Lang = l === 'fr' || l === 'ar' ? l : 'en'
  const v = VIEW[q.get('s') ?? ''] ?? VIEW.unknown
  const Icon = v.icon
  return (
    <main dir={isRtl(lang) ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F3F6FB', fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: '36px 28px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 8px 30px rgba(11,36,71,.12)' }}>
        <Icon size={56} style={{ color: v.color, margin: '0 auto 14px' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0B2447', margin: '0 0 8px' }}>{translate(lang, v.key)}</h1>
        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{translate(lang, v.key + '_sub')}</p>
        <div style={{ marginTop: 22, fontSize: 12, color: '#94A3B8' }}>PiloBrain Real Estate</div>
      </div>
    </main>
  )
}
export default function PayPage() { return <Suspense fallback={null}><Inner /></Suspense> }
