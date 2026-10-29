'use client'

import { useEffect, useState } from 'react'
import { PropImage } from '@/lib/immo-os/ui'
import { qar } from '@/lib/immo-os/helpers'
import { LEAD_TEXT, type LeadLang } from './texts'
import LeadForm from './form'
import './lead.css'

// Page publique STATIQUE (aucune fonction serveur) : /lead?a=<ID agence>[&property=<ID bien>][&lang=ar|fr]
// Les infos de l'agence et du bien sont chargees via l'API publique /api/immo/capture.
type Info = { name: string; property: any | null }

export default function LeadPage() {
  const [ctx, setCtx] = useState<{ agency: string; lang: LeadLang; info: Info | null; state: 'loading' | 'ok' | 'notfound' }>({ agency: '', lang: 'en', info: null, state: 'loading' })

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const agency = q.get('a') ?? ''
    const lang: LeadLang = q.get('lang') === 'ar' || q.get('lang') === 'fr' ? (q.get('lang') as LeadLang) : 'en'
    const property = q.get('property') ?? ''
    fetch(`/api/immo?r=capture&agency=${encodeURIComponent(agency)}${property ? `&property=${encodeURIComponent(property)}` : ''}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Info) : null))
      .then((info) => setCtx({ agency, lang, info, state: info ? 'ok' : 'notfound' }))
      .catch(() => setCtx({ agency, lang, info: null, state: 'notfound' }))
  }, [])

  const t = LEAD_TEXT[ctx.lang]
  const prop = ctx.info?.property
  if (ctx.state !== 'ok' || !ctx.info)
    return <div className="lead-wrap" style={{ justifyContent: 'center' }}>{ctx.state === 'loading' ? '…' : <div style={{ textAlign: 'center' }}><h1>Page not found</h1><p>This request form link is not valid.</p></div>}</div>

  return (
    <div className="lead-wrap" dir={ctx.lang === 'ar' ? 'rtl' : 'ltr'} lang={ctx.lang}>
      <header className="lead-top"><div><div style={{ fontWeight: 700, fontSize: 18 }}>{ctx.info.name}</div></div></header>
      <main className="lead-card">
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>{t.title}</h1>
        <p style={{ margin: '0 0 18px', color: '#44546A' }}>{t.subtitle}</p>
        {prop && (
          <div className="lead-prop">
            <div><PropImage p={prop} h={76} /></div>
            <div style={{ fontSize: 14 }}>
              <b>{prop.title}</b>
              <div style={{ color: '#44546A' }}>{prop.area}</div>
              <b>{qar(prop.price)}{prop.listing === 'rent' ? ` ${t.perMonth}` : ''}</b>
              <div style={{ color: '#44546A', fontSize: 13 }}>{prop.beds} {t.beds} · {prop.baths} {t.baths} · {prop.size_m2} m²</div>
            </div>
          </div>
        )}
        <LeadForm agency={ctx.agency} propertyId={prop?.id ?? null} lang={ctx.lang} agencyName={ctx.info.name} />
      </main>
    </div>
  )
}
