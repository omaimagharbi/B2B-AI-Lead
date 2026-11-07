'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Btn } from '@/lib/immo-os/ui'
import { isActiveLead, orphanLeadsOf, suggestSplit } from '@/lib/immo-os/orphans'

// n°92 : plan de redistribution des leads orphelins propose par l'IA (ordre d'appel) + repartition equilibree applicable en un clic.
export default function OrphanPlan() {
  const { data, activeAgents, ai, update, notify, t, tf } = useImmo()
  const orphans = useMemo(() => orphanLeadsOf(data.leads, activeAgents), [data.leads, activeAgents])
  const split = useMemo(() => suggestSplit(orphans, activeAgents, data.leads), [orphans, activeAgents, data.leads])
  const [text, setText] = useState<string | null>(null)
  const [aiOff, setAiOff] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!orphans.length) return null

  const run = async () => {
    setBusy(true)
    const days = (l: { last_contact: string }) => Math.floor((Date.now() - new Date(l.last_contact).getTime()) / 86400000)
    const context = [
      'Leads without an active agent (name | stage | budget QAR | days without contact | interest):',
      ...orphans.slice(0, 25).map((l) => [l.name, l.status, l.budget || '-', days(l), l.interest ?? '-'].join(' | ')),
      'Agents and current active leads:',
      ...activeAgents.map((a) => `${a} | ${data.leads.filter((l) => isActiveLead(l) && (l.agent ?? '').trim().toLowerCase() === a.trim().toLowerCase()).length}`),
    ].join('\n')
    const r = await ai('orphans', '', { context })
    setText(r)
    setAiOff(r === null)
    setBusy(false)
  }
  const apply = async () => {
    setBusy(true)
    for (const s of split) await update('leads', s.lead.id, { agent: s.to }) // chaque changement est journalise et historise par le serveur
    setBusy(false)
    notify(tf('ai.orph.applied', { n: split.length }))
    setText(null)
  }
  return (
    <div className="mt-2 w-full">
      <Btn onClick={run} disabled={busy}><Sparkles size={14} /> {busy ? t('ai.orph.wait') : t('ai.orph.btn')}</Btn>
      {(text !== null || aiOff) && (
        <div className="mt-2 rounded-lg p-3 text-[13px]" style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}>
          {text ? <><div className="font-semibold mb-1">{t('ai.orph.title')}</div><div className="whitespace-pre-line">{text}</div></> : <div className="t-muted">{t('ai.orph.nai')}</div>}
          <div className="font-semibold mt-3 mb-1">{t('ai.orph.split')}</div>
          <ul className="grid gap-0.5 text-[12.5px]">{split.slice(0, 12).map((s) => <li key={s.lead.id}>{s.lead.name} → <b>{s.to}</b></li>)}{split.length > 12 && <li className="t-muted">+{split.length - 12}</li>}</ul>
          <div className="mt-2"><Btn kind="primary" onClick={apply} disabled={busy}>{t('ai.orph.apply')}</Btn></div>
        </div>
      )}
    </div>
  )
}
