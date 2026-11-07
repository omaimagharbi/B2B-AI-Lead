'use client'

import { useEffect, useMemo, useState } from 'react'
import { UsersRound, UserPlus, AlertTriangle, Trash2, Repeat, ChevronDown } from 'lucide-react'
import { useImmo, type Member } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { qar } from '@/lib/immo-os/helpers'
import { agoLocal } from '@/lib/immo-os/ago'
import { isManager } from '@/lib/immo-os/permissions'
import { isActiveLead, orphanLeadsOf } from '@/lib/immo-os/orphans'
import ReassignModal from '../reassign-modal'
import OrphanPlan from '../orphan-plan'
import OrgChart from './org-chart'
import ActivityLog from './activity-log'

type Tab = 'members' | 'chart' | 'log'
// Menus que l'on peut masquer pour un membre (le tableau de bord, la page Equipe et les Parametres restent toujours visibles)
const HIDEABLE = ['properties', 'leads', 'calendar', 'clients', 'whatsapp', 'assistant', 'marketing', 'deals', 'reports', 'market']

export default function TeamPage() {
  const { data, team, mode, me, t, tf, create, update, inviteMember, removeMember, reassignLeads, setMemberMenus, lastActivity, activeAgents, notify } = useImmo()
  const manager = isManager(me?.role)
  const [tab, setTab] = useState<Tab>('members')
  const [invite, setInvite] = useState(false)
  const [reassign, setReassign] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [last, setLast] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!manager) return
    lastActivity().then(setLast)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, data.activity, team.length])

  const orphans = useMemo(() => orphanLeadsOf(data.leads, activeAgents), [data.leads, activeAgents])
  const closed = data.deals.filter((d) => d.status === 'closed')
  const rows = team.map((m) => {
    const ls = data.leads.filter((l) => (l.agent ?? '').trim().toLowerCase() === m.name.trim().toLowerCase())
    const ds = closed.filter((d) => (d.agent ?? '').trim().toLowerCase() === m.name.trim().toLowerCase())
    return { m, active: ls.filter(isActiveLead).length, deals: ds.length, commission: ds.reduce((s, d) => s + (d.value * d.commission_pct) / 100, 0) }
  })
  const hierOf = (id: string) => data.hierarchy.find((h) => h.member_id === id)
  // Chef d'equipe / rattachement : cree la ligne de hierarchie du membre si elle n'existe pas encore (ecriture + journal faits cote serveur)
  const setHier = async (id: string, patch: { is_lead?: boolean; reports_to?: string | null }) => {
    const cur = hierOf(id)
    if (cur) await update('hierarchy', cur.id, patch)
    else await create('hierarchy', { member_id: id, is_lead: false, reports_to: null, ...patch })
  }
  const parents = (m: Member) => team.filter((x) => x.id !== m.id && (isManager(x.role) || (!!hierOf(x.id)?.is_lead && !hierOf(m.id)?.is_lead && !isManager(m.role))))

  const tabs: { k: Tab; label: string }[] = [{ k: 'members', label: t('team.tab.members') }, { k: 'chart', label: t('team.tab.chart') }, ...(manager ? [{ k: 'log' as Tab, label: t('team.tab.log') }] : [])]

  return (
    <div>
      <PageHead icon={<UsersRound size={28} />} title={t('team.title')} sub={t('team.sub')} right={manager ? <Btn kind="primary" onClick={() => setInvite(true)}><UserPlus size={15} /> {t('team.invite')}</Btn> : undefined} />
      {mode === 'demo' && <div className="text-[12.5px] t-muted mb-3">{t('team.demo')}</div>}
      {manager && orphans.length > 0 && (
        <div className="mb-4 rounded-lg px-3 py-2.5 flex flex-wrap items-center gap-3" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B55' }} role="alert">
          <AlertTriangle size={17} />
          <div className="flex-1 min-w-[200px] text-[13px]"><b>{tf('orph.banner', { n: orphans.length })}</b> {t('orph.why')} <span className="opacity-80">{orphans.slice(0, 4).map((l) => l.name).join(', ')}{orphans.length > 4 ? '…' : ''}</span></div>
          <Btn kind="gold" onClick={() => setReassign('__orphans')}><Repeat size={14} /> {t('ra.btn')}</Btn>
          <OrphanPlan />
        </div>
      )}
      <div className="flex gap-2 mb-4 flex-wrap" role="tablist">
        {tabs.map((x) => <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={`imo-btn ${tab === x.k ? 'imo-btn-primary' : ''}`}>{x.label}</button>)}
      </div>

      {tab === 'chart' && <OrgChart />}
      {tab === 'log' && manager && <ActivityLog />}
      {tab === 'members' && (rows.length === 0 ? <Card><Empty title={t('team.noact')} /></Card> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ m, active, deals, commission }) => {
            const h = hierOf(m.id)
            const boss = h?.reports_to ? team.find((x) => x.id === h.reports_to) : null
            const isOpen = open === m.id
            const mgr = isManager(m.role)
            return (
              <Card key={m.id}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={m.name} size={46} src={m.photo} />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{m.name}{m.id === me?.id && <span className="t-muted text-[12px]"> ({t('team.you')})</span>}</div>
                    <div className="flex gap-1 flex-wrap mt-0.5"><Badge color={mgr ? '#0B2447' : '#475569'}>{t('team.role.' + m.role)}</Badge>{h?.is_lead && <Badge color="#B45309">{t('team.role.lead')}</Badge>}</div>
                    <div className="text-[12px] t-muted truncate">{boss ? `${t('team.reports_to')}: ${boss.name}` : m.phone ?? ''}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 text-center pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div><div className="text-[18px] font-bold">{active}</div><div className="text-[11px] t-muted">{t('team.leads_active')}</div></div>
                  <div><div className="text-[18px] font-bold">{deals}</div><div className="text-[11px] t-muted">{t('team.deals_closed')}</div></div>
                  <div><div className="text-[14px] font-bold pt-1">{qar(commission)}</div><div className="text-[11px] t-muted">{t('team.commission')}</div></div>
                </div>
                {manager && <div className="text-[12px] t-muted mt-2">{t('team.lastact')}: <b>{agoLocal(last[m.name], t, tf, 'team.noact')}</b></div>}
                {manager && (
                  <>
                    <button className="mt-3 text-[12.5px] flex items-center gap-1 t-muted" onClick={() => setOpen(isOpen ? null : m.id)} aria-expanded={isOpen}><ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} /> {t('team.rights')}</button>
                    {isOpen && (
                      <div className="mt-2 grid gap-3">
                        {!mgr && (
                          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!h?.is_lead} onChange={(e) => setHier(m.id, { is_lead: e.target.checked, ...(e.target.checked && !(boss && isManager(boss.role)) ? { reports_to: null } : {}) })} /> {t('team.is_lead')}</label>
                        )}
                        {!mgr && (
                          <Field label={t('team.reports_to')}>
                            <select className="imo-select" value={h?.reports_to ?? ''} onChange={(e) => setHier(m.id, { reports_to: e.target.value || null })}>
                              <option value="">{t('team.nobody')}</option>
                              {parents(m).filter((p) => !h?.is_lead || isManager(p.role)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </Field>
                        )}
                        {!mgr && (
                          <div>
                            <div className="imo-label">{t('team.menus')}</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              {HIDEABLE.map((k) => {
                                const hidden = m.hidden ?? []
                                const visible = !hidden.includes(k)
                                return <label key={k} className="flex items-center gap-1.5 text-[12.5px]"><input type="checkbox" checked={visible} onChange={() => setMemberMenus(m.id, visible ? [...hidden, k] : hidden.filter((x) => x !== k))} /> {t('nav.' + k)}</label>
                              })}
                            </div>
                            <div className="text-[11.5px] t-muted mt-1">{t('team.menus.hint')}</div>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {active > 0 && <Btn onClick={() => setReassign(m.name)}><Repeat size={13} /> {t('ra.btn')}</Btn>}
                          {m.role !== 'proprietaire' && m.id !== me?.id && <Btn kind="danger" onClick={() => setRemoving(m)}><Trash2 size={13} /> {t('team.remove')}</Btn>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      ))}

      {invite && <InviteModal onClose={() => setInvite(false)} onSubmit={inviteMember} />}
      {reassign !== null && <ReassignModal presetFrom={reassign} onClose={() => setReassign(null)} />}
      {removing && (
        <RemoveModal
          member={removing}
          activeLeads={data.leads.filter((l) => isActiveLead(l) && (l.agent ?? '').trim().toLowerCase() === removing.name.trim().toLowerCase()).length}
          others={team.filter((x) => x.id !== removing.id).map((x) => x.name)}
          onClose={() => setRemoving(null)}
          onConfirm={async (to) => {
            if (to) { const n = await reassignLeads(removing.name, to, 'active', 'agent_removed'); if (n === null) return }
            if (await removeMember(removing.id)) notify(tf('team.remove.title', { name: removing.name }))
            setRemoving(null)
          }}
        />
      )}
    </div>
  )
}

function InviteModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (email: string, name: string, role: 'membre' | 'directeur_commercial') => Promise<{ password: string; emailSent: boolean } | null> }) {
  const { t } = useImmo()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'membre' | 'directeur_commercial'>('membre')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ password: string; emailSent: boolean } | null>(null)
  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return
    setBusy(true)
    const r = await onSubmit(email.trim(), name.trim(), role)
    setBusy(false)
    if (r) setDone(r)
  }
  return (
    <Modal title={t('team.invite')} onClose={onClose}>
      {done ? (
        <div className="grid gap-3 text-[13.5px]">
          <div>{t('team.invite.done')}</div>
          <div className="rounded-lg p-3" dir="ltr" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}><div>{email}</div><div className="font-mono font-bold">{done.password}</div></div>
          <div className="t-muted text-[12.5px]">{done.emailSent ? t('team.invite.mail_ok') : t('team.invite.mail_ko')}</div>
          <div className="flex justify-end"><Btn kind="primary" onClick={onClose}>OK</Btn></div>
        </div>
      ) : (
        <div className="grid gap-3">
          <Field label={t('team.invite.name')}><input className="imo-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <Field label={t('team.invite.email')}><input type="email" className="imo-input" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" /></Field>
          <Field label={t('team.invite.role')}><select className="imo-select" value={role} onChange={(e) => setRole(e.target.value as 'membre' | 'directeur_commercial')}><option value="membre">{t('team.role.membre')}</option><option value="directeur_commercial">{t('team.role.directeur_commercial')}</option></select></Field>
          <div className="flex gap-2 justify-end"><Btn onClick={onClose}>{t('f.cancel')}</Btn><Btn kind="primary" disabled={busy || !email.trim()} onClick={submit}>{t('team.invite.go')}</Btn></div>
        </div>
      )}
    </Modal>
  )
}

function RemoveModal({ member, activeLeads, others, onClose, onConfirm }: { member: Member; activeLeads: number; others: string[]; onClose: () => void; onConfirm: (reassignTo: string | null) => Promise<void> }) {
  const { t, tf } = useImmo()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (target: string | null) => { setBusy(true); await onConfirm(target); setBusy(false) }
  return (
    <Modal title={tf('team.remove.title', { name: member.name })} onClose={onClose}>
      <div className="grid gap-3 text-[13.5px]">
        <div>{activeLeads > 0 ? tf('team.remove.warn', { name: member.name, n: activeLeads }) : tf('team.remove.noleads', { name: member.name })}</div>
        {activeLeads > 0 && (
          <Field label={t('team.remove.reassign')}>
            <select className="imo-select" value={to} onChange={(e) => setTo(e.target.value)}><option value="">{t('ra.pick')}</option>{others.map((n) => <option key={n}>{n}</option>)}</select>
          </Field>
        )}
        {activeLeads > 0 && !to && <div className="text-[12.5px]" style={{ color: '#92400E' }}>{t('team.remove.orphans')}</div>}
        <div className="flex gap-2 justify-end flex-wrap">
          <Btn onClick={onClose}>{t('f.cancel')}</Btn>
          {activeLeads > 0 && to && <Btn kind="primary" disabled={busy} onClick={() => run(to)}>{t('team.remove.go')}</Btn>}
          <Btn kind="danger" disabled={busy} onClick={() => run(null)}>{activeLeads > 0 ? t('team.remove.only') : t('team.remove')}</Btn>
        </div>
      </div>
    </Modal>
  )
}
