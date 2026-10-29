'use client'

import Link from 'next/link'
import { UsersRound, UserPlus } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, PageHead } from '@/lib/immo-os/ui'
import { qar } from '@/lib/immo-os/helpers'

export default function TeamPage() {
  const { data, team, agents, mode } = useImmo()
  const closed = data.deals.filter((d) => d.status === 'closed')
  const rows = agents.map((a) => {
    const m = team.find((t) => t.name === a)
    const ls = data.leads.filter((l) => l.agent === a)
    const ds = closed.filter((d) => d.agent === a)
    return { a, m, leads: ls.length, active: ls.filter((l) => !['won', 'lost'].includes(l.status)).length, deals: ds.length, commission: ds.reduce((s, d) => s + (d.value * d.commission_pct) / 100, 0) }
  })
  return (
    <div>
      <PageHead icon={<UsersRound size={28} />} title="Team" sub="Your agents and their performance" right={<Link href="/dashboard"><Btn kind="primary"><UserPlus size={15} /> Invite / manage members</Btn></Link>} />
      {mode === 'demo' && <div className="text-[12.5px] t-muted mb-3">Demo mode shows sample agents. In live mode, your PiloBrain team members appear here and can be assigned to leads and deals.</div>}
      {rows.length === 0 ? <Card><Empty title="No team members yet" /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.a}>
              <div className="flex items-center gap-3 mb-3"><Avatar name={r.a} size={46} src={r.m?.photo} /><div><div className="font-semibold">{r.a}</div><div className="text-[12px] t-muted">{r.m?.phone ?? 'Sales agent'}</div></div>{r.m && <div className="ml-auto"><Badge color="#2563EB">{r.m.role}</Badge></div>}</div>
              <div className="grid grid-cols-3 text-center pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div><div className="text-[18px] font-bold">{r.active}</div><div className="text-[11px] t-muted">Active leads</div></div>
                <div><div className="text-[18px] font-bold">{r.deals}</div><div className="text-[11px] t-muted">Deals closed</div></div>
                <div><div className="text-[14px] font-bold pt-1">{qar(r.commission)}</div><div className="text-[11px] t-muted">Commission</div></div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
