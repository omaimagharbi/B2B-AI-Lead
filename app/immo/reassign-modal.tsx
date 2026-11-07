'use client'

import { useMemo, useState } from 'react'
import { useImmo } from '@/lib/immo-os/store'
import { Btn, Field, Modal } from '@/lib/immo-os/ui'
import { isActiveLead, orphanLeadsOf } from '@/lib/immo-os/orphans'

// Reassignation en masse (n°53 / n°69). Utilisee depuis Leads (bouton) et Equipe (bandeau orphelins, fiche membre).
export default function ReassignModal({ presetFrom = '', onClose }: { presetFrom?: string; onClose: () => void }) {
  const { data, activeAgents, reassignLeads, notify, t, tf } = useImmo()
  const [from, setFrom] = useState(presetFrom)
  const [to, setTo] = useState('')
  const [scope, setScope] = useState<'active' | 'all'>('active')
  const [busy, setBusy] = useState(false)
  const norm = (x?: string | null) => String(x ?? '').trim().toLowerCase()

  const orphans = useMemo(() => orphanLeadsOf(data.leads, activeAgents), [data.leads, activeAgents])
  const sources = useMemo(() => {
    const names = Array.from(new Set(data.leads.map((l) => l.agent).filter((a): a is string => !!a && activeAgents.some((m) => norm(m) === norm(a)))))
    return names.sort()
  }, [data.leads, activeAgents])
  const count = useMemo(() => {
    const pool = scope === 'all' ? data.leads : data.leads.filter(isActiveLead)
    if (from === '__orphans') return pool.filter((l) => !l.agent || !activeAgents.some((m) => norm(m) === norm(l.agent))).length
    return from ? pool.filter((l) => norm(l.agent) === norm(from)).length : 0
  }, [data.leads, from, scope, activeAgents])
  const targets = activeAgents.filter((a) => norm(a) !== norm(from))

  const go = async () => {
    if (!from || !to || !count) return
    setBusy(true)
    const n = await reassignLeads(from, to, scope)
    setBusy(false)
    if (n === null) return
    notify(n ? tf('ra.done', { n }) : t('ra.none'))
    onClose()
  }
  return (
    <Modal title={t('ra.title')} onClose={onClose}>
      <div className="grid gap-3">
        <Field label={t('ra.from')}>
          <select className="imo-select" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">{t('ra.pick')}</option>
            {orphans.length > 0 && <option value="__orphans">{t('ra.orphans')} ({orphans.length})</option>}
            {sources.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label={t('ra.to')}>
          <select className="imo-select" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t('ra.pick')}</option>
            {targets.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label={t('ra.scope')}>
          <select className="imo-select" value={scope} onChange={(e) => setScope(e.target.value as 'active' | 'all')}>
            <option value="active">{t('ra.scope.active')}</option>
            <option value="all">{t('ra.scope.all')}</option>
          </select>
        </Field>
        {from && to && <div className="text-[13px]">{count ? tf('ra.preview', { n: count, to }) : t('ra.none')}</div>}
        <div className="flex gap-2 justify-end">
          <Btn onClick={onClose}>{t('f.cancel')}</Btn>
          <Btn kind="primary" disabled={busy || !from || !to || !count} onClick={go}>{t('ra.go')}</Btn>
        </div>
      </div>
    </Modal>
  )
}
