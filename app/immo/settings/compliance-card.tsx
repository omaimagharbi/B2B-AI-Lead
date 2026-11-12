'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'
import { UNKNOWN_RULES, DEFAULT_UNKNOWN_RULE, isUnknownRule, type UnknownRule } from '@/lib/immo-os/unknown-rule'
import { CHARTER_VERSION, POLICY_DRAFT, POLICY_VERSION } from '@/lib/immo-os/policy'
import { CHARTER_KEYS } from '../charter-gate'

const PRIV_KEYS = ['pol.priv.p1', 'pol.priv.p2', 'pol.priv.p3', 'pol.priv.p4', 'pol.priv.p5', 'pol.priv.p6', 'pol.priv.p7']
type Row = { id: string; name: string; role: string; accepted_at: string | null }

// n°102 / n°103 / n°101 / n°55 : regles WhatsApp documentees, regle "numero inconnu" choisie par l'agence, charte, notice de confidentialite.
export default function ComplianceCard() {
  const { t, tf, lang, mode, me, clientId, agency, callApi, notify, charter } = useImmo()
  const manager = isManager(me?.role)
  const [rule, setRule] = useState<UnknownRule>(DEFAULT_UNKNOWN_RULE)
  const [missing, setMissing] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [show, setShow] = useState<'' | 'charter' | 'policy'>('')

  useEffect(() => {
    if (mode === 'demo') {
      try { const v = localStorage.getItem('imo_unknown_rule'); if (isUnknownRule(v)) setRule(v) } catch {}
      return
    }
    if (mode !== 'live') return
    callApi('/api/immo?r=settings').then((r) => { if (r.ok) { if (isUnknownRule(r.json.unknown_number_rule)) setRule(r.json.unknown_number_rule); setMissing(!!r.json.missing) } })
    if (manager) callApi('/api/immo?r=charter').then((r) => { if (r.ok) setRows(r.json.missing ? null : (r.json.rows as Row[])) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, manager])

  const choose = async (v: UnknownRule) => {
    if (!manager) return notify(t('cp.unknown.managers'), 'err')
    if (mode === 'demo') { setRule(v); try { localStorage.setItem('imo_unknown_rule', v) } catch {}; return notify(t('cp.unknown.saved')) }
    const r = await callApi('/api/immo?r=settings', { method: 'PATCH', body: JSON.stringify({ unknown_number_rule: v }) })
    if (!r.ok) return notify(r.json?.error ?? t('xm.update_failed'), 'err')
    setRule(v); notify(t('cp.unknown.saved'))
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const privUrl = clientId ? `${origin}/lead/privacy?a=${clientId}&lang=${lang}` : ''
  const accepted = rows?.filter((r) => r.accepted_at).length ?? 0

  return (
    <Card className="lg:col-span-2">
      <CardTitle icon={<ShieldCheck size={17} />} title={t('cp.title')} right={POLICY_DRAFT ? <Badge color="#B45309">{t('x38.draft')}</Badge> : undefined} />
      <div className="grid gap-5 lg:grid-cols-2 text-[13px]">
        <div>
          <div className="imo-label">{t('cp.rules')}</div>
          <ul className="grid gap-2 list-disc ps-5">{['cp.rule.company', 'cp.rule.groups', 'cp.rule.scraping', 'cp.rule.stop', 'cp.rule.consent'].map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </div>
        <div>
          <div className="imo-label">{t('cp.unknown.title')}</div>
          <div className="t-muted mb-2">{t('cp.unknown.help')}</div>
          <div className="grid gap-1.5" role="radiogroup" aria-label={t('cp.unknown.title')}>
            {UNKNOWN_RULES.map((v) => (
              <label key={v} className="flex items-start gap-2" style={{ opacity: manager ? 1 : 0.7 }}><input type="radio" name="unk" className="mt-1" checked={rule === v} disabled={!manager} onChange={() => choose(v)} />{t('cp.unknown.' + v)}</label>
            ))}
          </div>
          {!manager && <div className="t-muted mt-1.5">{t('cp.unknown.managers')}</div>}
          {mode === 'demo' && <div className="mt-1.5" style={{ color: '#92400E' }}>{t('cp.unknown.demo')}</div>}
          {missing && <div className="mt-1.5" style={{ color: '#92400E' }}>{t('cp.unknown.missing')}</div>}
        </div>
        <div>
          <div className="imo-label">{t('cp.charter')} <span className="t-muted font-normal">· {CHARTER_VERSION}</span></div>
          {manager && rows && <div className="mb-2">{tf('cp.charter.count', { n: accepted, m: rows.length })}</div>}
          {manager && rows && <div className="grid gap-1 mb-2">{rows.map((r) => <div key={r.id} className="flex justify-between gap-2"><span className="truncate">{r.name}</span>{r.accepted_at ? <Badge color="#16A34A">{tf('cp.charter.accepted', { date: new Date(r.accepted_at).toLocaleDateString(lang) })}</Badge> : <Badge color="#B45309">{t('cp.charter.pending')}</Badge>}</div>)}</div>}
          {manager && mode === 'live' && rows === null && <div className="t-muted mb-2">{t('cp.charter.missing')}</div>}
          {charter.accepted === true && <div className="mb-2"><Badge color="#16A34A">{t('ch.saved')}</Badge></div>}
          <Btn onClick={() => setShow(show === 'charter' ? '' : 'charter')}>{t('cp.charter.read')}</Btn>
          {show === 'charter' && <ol className="grid gap-2 list-decimal ps-6 mt-3">{CHARTER_KEYS.map((k) => <li key={k}>{t(k)}</li>)}</ol>}
        </div>
        <div>
          <div className="imo-label">{t('cp.policy')}</div>
          <div className="t-muted mb-1">{tf('cp.policy.version', { v: POLICY_VERSION })}</div>
          {privUrl && <div className="mb-2"><span className="t-muted">{t('cp.policy.link')}</span> <a href={privUrl} target="_blank" rel="noopener noreferrer" className="underline break-all" dir="ltr">{privUrl}</a></div>}
          <Btn onClick={() => setShow(show === 'policy' ? '' : 'policy')}>{t('pol.priv.title')}</Btn>
          {show === 'policy' && <div className="grid gap-2 mt-3">{POLICY_DRAFT && <div className="rounded-md px-2.5 py-1.5" style={{ background: '#FEF3C7', color: '#92400E' }}>{t('pol.draft')}</div>}{PRIV_KEYS.map((k) => <p key={k}>{t(k).replace('{agency}', agency)}</p>)}</div>}
        </div>
      </div>
    </Card>
  )
}
