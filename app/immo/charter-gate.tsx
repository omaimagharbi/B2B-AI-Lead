'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Btn } from '@/lib/immo-os/ui'
import { supabase } from '@/lib/supabase'
import { POLICY_DRAFT } from '@/lib/immo-os/policy'

// n°101 : charte d'utilisation (numero de la societe, echanges enregistres). Bloque l'espace tant que le membre ne l'a pas acceptee.
export const CHARTER_KEYS = ['ch.p1', 'ch.p2', 'ch.p3', 'ch.p4', 'ch.p5', 'ch.p6', 'ch.p7', 'ch.p8']

export default function CharterGate() {
  const { charter, acceptCharter, t, tf, me, mode, notify } = useImmo()
  const router = useRouter()
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (mode === 'loading' || !me || charter.accepted !== false) return null
  const accept = async () => {
    setBusy(true)
    if (await acceptCharter()) notify(t('ch.saved'))
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(8,20,40,.72)' }} role="dialog" aria-modal="true" aria-labelledby="charter-title">
      <div className="imo-card w-full max-w-[640px] max-h-[92vh] flex flex-col" style={{ background: 'var(--card)' }}>
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2"><ShieldCheck size={22} style={{ color: 'var(--gold)' }} /><h2 id="charter-title" className="text-[18px] font-bold">{t('ch.title')}</h2><span className="ms-auto text-[11px] t-muted">{tf('ch.version', { v: charter.version })}</span></div>
          <div className="text-[13px] t-muted mt-1">{t('ch.sub')}</div>
          {POLICY_DRAFT && <div className="mt-2 rounded-md px-2.5 py-1.5 text-[12px]" style={{ background: '#FEF3C7', color: '#92400E' }}>{t('pol.draft')}</div>}
        </div>
        <ol className="flex-1 overflow-y-auto imo-scroll px-5 py-3 grid gap-2.5 text-[13.5px] list-decimal ps-9">
          {CHARTER_KEYS.map((k) => <li key={k}>{t(k)}</li>)}
        </ol>
        <div className="px-5 py-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <label className="flex items-start gap-2 text-[13.5px] font-medium"><input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />{t('ch.accept')}</label>
          <div className="flex justify-between gap-2 flex-wrap">
            <Btn onClick={async () => { await supabase.auth.signOut(); router.replace('/auth') }}>{t('ch.signout')}</Btn>
            <Btn kind="primary" disabled={!ok || busy} onClick={accept}>{t('ch.btn')}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}
