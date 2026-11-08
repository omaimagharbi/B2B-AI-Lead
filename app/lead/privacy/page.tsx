'use client'

import { useEffect, useState } from 'react'
import { translate, isRtl, type Lang } from '@/lib/immo-os/i18n'
import { POLICY_DRAFT, POLICY_VERSION } from '@/lib/immo-os/policy'
import '../lead.css'

// Page publique STATIQUE : notice de confidentialite d'une agence (/lead/privacy?a=<ID agence>&lang=en|fr|ar).
// Texte = BROUILLON a faire valider par un juriste (voir lib/immo-os/policy.ts : passer POLICY_DRAFT a false une fois valide).
const KEYS = ['pol.priv.p1', 'pol.priv.p2', 'pol.priv.p3', 'pol.priv.p4', 'pol.priv.p5', 'pol.priv.p6', 'pol.priv.p7']

export default function PrivacyPage() {
  const [st, setSt] = useState<{ lang: Lang; agency: string | null; state: 'loading' | 'ok' | 'notfound' }>({ lang: 'en', agency: null, state: 'loading' })
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const l = q.get('lang')
    const lang: Lang = l === 'ar' || l === 'fr' ? l : 'en'
    const a = q.get('a') ?? ''
    fetch(`/api/immo?r=capture&agency=${encodeURIComponent(a)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { name: string }) : null))
      .then((i) => setSt({ lang, agency: i?.name ?? null, state: i ? 'ok' : 'notfound' }))
      .catch(() => setSt({ lang, agency: null, state: 'notfound' }))
  }, [])
  const T = (k: string) => translate(st.lang, k)
  if (st.state !== 'ok') return <div className="lead-wrap" style={{ justifyContent: 'center' }}>{st.state === 'loading' ? '…' : <div style={{ textAlign: 'center' }}><h1>Page not found</h1></div>}</div>
  return (
    <div className="lead-wrap" dir={isRtl(st.lang) ? 'rtl' : 'ltr'} lang={st.lang}>
      <header className="lead-top"><div style={{ fontWeight: 700, fontSize: 18 }}>{st.agency}</div></header>
      <main className="lead-card">
        <h1 style={{ margin: '0 0 10px', fontSize: 24 }}>{T('pol.priv.title')}</h1>
        {POLICY_DRAFT && <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>{T('pol.draft')}</div>}
        {KEYS.map((k) => <p key={k} style={{ margin: '0 0 12px', lineHeight: 1.6 }}>{T(k).replace('{agency}', st.agency ?? '')}</p>)}
        <p style={{ fontSize: 12, color: '#5B6B82' }}>{POLICY_VERSION}</p>
      </main>
    </div>
  )
}
