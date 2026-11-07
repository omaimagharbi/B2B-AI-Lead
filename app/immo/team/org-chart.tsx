'use client'

import { useImmo, type Member } from '@/lib/immo-os/store'
import { Avatar, Badge, Card } from '@/lib/immo-os/ui'
import { isManager } from '@/lib/immo-os/permissions'

// Organigramme (n°104) : direction > chefs d'equipe > agents. Construit depuis re_hierarchy (champ "rattache a" + "chef d'equipe").
export default function OrgChart() {
  const { team, data, t } = useImmo()
  const byId = new Map(team.map((m) => [m.id, m]))
  const hier = new Map(data.hierarchy.map((h) => [h.member_id, h]))
  const parentOf = (m: Member): Member | null => {
    const p = hier.get(m.id)?.reports_to
    return p && p !== m.id ? byId.get(p) ?? null : null
  }
  const childrenOf = (id: string) => team.filter((m) => parentOf(m)?.id === id).sort((a, b) => Number(!!hier.get(b.id)?.is_lead) - Number(!!hier.get(a.id)?.is_lead) || a.name.localeCompare(b.name))
  const managers = team.filter((m) => isManager(m.role))
  const placed = new Set<string>()
  const mark = (m: Member, depth = 0) => { if (depth > 6 || placed.has(m.id)) return; placed.add(m.id); childrenOf(m.id).forEach((c) => mark(c, depth + 1)) }
  managers.forEach((m) => mark(m))
  const loose = team.filter((m) => !placed.has(m.id) && !parentOf(m)) // ni manager ni rattache

  const node = (m: Member, depth: number, seen: Set<string>): JSX.Element => {
    const lead = !!hier.get(m.id)?.is_lead
    const kids = depth < 6 && !seen.has(m.id) ? childrenOf(m.id) : []
    const next = new Set(seen).add(m.id)
    return (
      <li key={m.id} className="mt-2">
        <div className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: `1px solid ${lead ? '#B45309' : 'var(--border)'}`, background: 'var(--card)' }}>
          <Avatar name={m.name} size={28} src={m.photo} />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">{m.name}</div>
            <div className="mt-0.5 flex gap-1 flex-wrap">
              <Badge color={isManager(m.role) ? '#0B2447' : '#475569'}>{t('team.role.' + m.role)}</Badge>
              {lead && <Badge color="#B45309">{t('team.role.lead')}</Badge>}
            </div>
          </div>
        </div>
        {kids.length > 0 && <ul className="ms-5 ps-4" style={{ borderInlineStart: '2px solid var(--border)' }}>{kids.map((c) => node(c, depth + 1, next))}</ul>}
      </li>
    )
  }

  return (
    <Card>
      <div className="text-[12.5px] t-muted mb-2">{t('team.chart.hint')}</div>
      {team.length === 0 ? null : (
        <>
          {managers.length > 0 && <div className="text-[11px] font-semibold uppercase t-muted mb-1">{t('team.chart.mgmt')}</div>}
          <ul>{managers.map((m) => node(m, 0, new Set()))}</ul>
          {loose.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase t-muted mb-1">{t('team.chart.unassigned')}</div>
              <ul>{loose.map((m) => node(m, 0, new Set()))}</ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
