'use client'

import { useState } from 'react'
import { LEAD_TEXT, type LeadLang } from './texts'

export default function LeadForm({ agency, propertyId, lang, agencyName }: { agency: string; propertyId: string | null; lang: LeadLang; agencyName: string }) {
  const t = LEAD_TEXT[lang]
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state === 'sending') return
    const f = new FormData(e.currentTarget)
    setState('sending')
    setError('')
    try {
      const res = await fetch('/api/immo?r=capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agency, propertyId, name: f.get('name'), phone: f.get('phone'), email: f.get('email'), budget: f.get('budget'), message: f.get('message'), website: f.get('website') }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(res.status === 400 || res.status === 429 ? json.error : t.err)
      setState('done')
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.err)
      setState('idle')
    }
  }

  if (state === 'done')
    return (
      <div role="status" style={{ textAlign: 'center', padding: '28px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{t.okTitle}</div>
        <p style={{ color: '#44546A' }}>{t.okBody}</p>
        <button className="lead-btn" style={{ maxWidth: 260 }} onClick={() => setState('idle')}>{t.again}</button>
      </div>
    )

  return (
    <form onSubmit={submit} noValidate={false}>
      <div className="lead-grid">
        <div><label htmlFor="lf-name">{t.name} *</label><input id="lf-name" name="name" required minLength={2} maxLength={120} autoComplete="name" /></div>
        <div><label htmlFor="lf-phone">{t.phone} *</label><input id="lf-phone" name="phone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" aria-describedby="lf-phone-h" /><div id="lf-phone-h" style={{ fontSize: 12, color: '#5B6B82', marginTop: 4 }}>{t.phoneHint}</div></div>
        <div><label htmlFor="lf-email">{t.email}</label><input id="lf-email" name="email" type="email" maxLength={160} autoComplete="email" /></div>
        <div><label htmlFor="lf-budget">{t.budget}</label><input id="lf-budget" name="budget" type="number" inputMode="numeric" min={0} /></div>
        <div className="lead-full"><label htmlFor="lf-msg">{t.message}</label><textarea id="lf-msg" name="message" rows={4} maxLength={1000} /></div>
        {/* Piege a robots : invisible pour les humains, rempli par les scripts de spam */}
        <div className="lead-hp" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        {error && <div className="lead-full lead-err" role="alert">{error}</div>}
        <div className="lead-full"><button className="lead-btn" type="submit" disabled={state === 'sending'}>{state === 'sending' ? t.sending : t.submit}</button></div>
        <div className="lead-full" style={{ fontSize: 12, color: '#5B6B82' }}>{t.privacy(agencyName)}</div>
      </div>
    </form>
  )
}
