'use client'

import { useEffect, useState } from 'react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Card, Empty } from '@/lib/immo-os/ui'
import { agoLocal } from '@/lib/immo-os/ago'
import type { Activity } from '@/lib/immo-os/types'

const ENTITIES = ['leads', 'properties', 'owners', 'clients', 'deals', 'visits', 'zones', 'hierarchy', 'contacts', 'settings', 'wa_numbers', 'payments']
const COLOR: Record<string, string> = { create: '#16A34A', update: '#2563EB', delete: '#DC2626', assign: '#B45309', reassign_bulk: '#B45309', team_invite: '#0F766E', team_remove: '#DC2626', team_update: '#475569', auto: '#8B5CF6', hot_alert: '#EF4444', optout: '#7F1D1D', optin: '#16A34A', charter_accept: '#0F766E', ai_auto_reply: '#C9A24B', ai_handoff: '#B45309', ai_blocked: '#DC2626', ai_qualify: '#C9A24B', ai_review: '#C9A24B' }

// Journal d'activite (n°30 / n°82) : lecture seule. L'ecriture est faite par le serveur (api/entity.ts, api/reassign.ts, /api/team/*).
export default function ActivityLog() {
  const { team, loadActivity, t, tf, data } = useImmo()
  const [rows, setRows] = useState<Activity[] | null>(null)
  const [actor, setActor] = useState('')
  const [entity, setEntity] = useState('')
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let off = false
    ;(async () => {
      const r = await loadActivity({ actor: actor || undefined, entity: entity || undefined })
      if (off) return
      setMissing(r === null)
      setRows(r ?? [])
    })()
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, entity, data.activity])

  const detail = (a: Activity): string => {
    const d = (a.details ?? {}) as Record<string, any>
    if (a.action === 'reassign_bulk') return `${tf('log.count', { n: d.count ?? 0 })} · ${d.from ?? t('as.unassigned')} → ${d.to ?? ''}`
    if (a.action === 'assign') return `${d.from ?? t('as.unassigned')} → ${d.to ?? t('as.unassigned')}`
    if (Array.isArray(d.fields) && d.fields.length) return `${t('log.fields')}: ${d.fields.join(', ')}`
    return ''
  }
  const names = Array.from(new Set([...team.map((m) => m.name), ...(rows ?? []).map((r) => r.actor_name)])).filter(Boolean)

  return (
    <Card>
      <div className="text-[12.5px] t-muted mb-3">{t('log.sub')}</div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select className="imo-select" style={{ width: 200 }} value={actor} onChange={(e) => setActor(e.target.value)} aria-label={t('log.all')}><option value="">{t('log.all')}</option>{names.map((n) => <option key={n}>{n}</option>)}</select>
        <select className="imo-select" style={{ width: 200 }} value={entity} onChange={(e) => setEntity(e.target.value)} aria-label={t('log.allent')}><option value="">{t('log.allent')}</option>{ENTITIES.map((x) => <option key={x} value={x}>{t('log.e.' + x)}</option>)}</select>
      </div>
      {missing && <div className="text-[12.5px] mb-2" style={{ color: '#92400E' }}>{t('log.migration')}</div>}
      {rows && rows.length === 0 && !missing ? <Empty title={t('log.empty')} /> : (
        <div style={{ overflowX: 'auto' }}>
          <table className="imo-table"><tbody>
            {(rows ?? []).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap t-muted text-[12px]" title={new Date(a.created_at).toLocaleString()}>{agoLocal(a.created_at, t, tf)}</td>
                <td className="font-medium whitespace-nowrap">{a.actor_name || '-'}</td>
                <td><Badge color={COLOR[a.action] ?? '#475569'}>{t('log.a.' + a.action)}</Badge> {a.entity && a.action !== 'reassign_bulk' ? <span className="t-muted text-[12.5px]">{t('log.e.' + a.entity)} </span> : null}<b>{a.label}</b>{detail(a) && <div className="text-[12px] t-muted">{detail(a)}</div>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </Card>
  )
}
