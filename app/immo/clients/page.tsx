'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Search, Pencil, Trash2, Download, Ban, IdCard } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Avatar, Badge, Btn, Card, Empty, Field, Modal, PageHead } from '@/lib/immo-os/ui'
import { CLIENT_KINDS, type RClient } from '@/lib/immo-os/types'
import { ago, downloadCsv, qar } from '@/lib/immo-os/helpers'
import { confirmDelete } from '@/lib/immo-os/hooks'

const KIND_COLOR: Record<string, string> = { buyer: '#2563EB', seller: '#F97316', tenant: '#0891B2', investor: '#7C3AED' }
const blank = (): Partial<RClient> => ({ name: '', phone: '', email: '', nationality: '', kind: 'buyer', budget: 0, preferred_areas: '', notes: '', agent: '', beds_wanted: null, do_not_contact: false })

export default function ClientsPage() {
  const { data, agents, create, update, remove, notify, canDelete, t, tf, me } = useImmo()
  const router = useRouter()
  const manager = !!me && ['proprietaire', 'admin', 'directeur_commercial'].includes(me.role)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [edit, setEdit] = useState<Partial<RClient> | null>(null)

  const list = useMemo(() => data.clients.filter((c) => (!q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (!kind || c.kind === kind)), [data.clients, q, kind])
  const set = (k: keyof RClient, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  const save = async () => {
    if (!edit?.name?.trim()) return notify(t('x38.name_is_required'), 'err')
    if (edit.id) await update('clients', edit.id, edit)
    else await create('clients', edit)
    setEdit(null)
  }

  return (
    <div>
      <PageHead icon={<Users size={28} />} title={t('nav.clients')} sub={`${data.clients.length} clients`}
        right={<><Btn onClick={() => downloadCsv('clients.csv', list.map((c) => ({ name: c.name, type: c.kind, phone: c.phone, email: c.email, nationality: c.nationality, budget: c.budget, areas: c.preferred_areas, agent: c.agent })))}><Download size={14} /> {t('x38.export_csv')}</Btn><Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> {t('x38.add_client')}</Btn></>} />
      <Card className="mb-4"><div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 32 }} placeholder={t('x38.search_name_email_or_phone')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="imo-select" style={{ width: 160 }} value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{t('f.alltypes')}</option>{CLIENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
      </div></Card>

      <Card pad={false}>
        {list.length === 0 ? <Empty title={t('x38.no_clients_found')} action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> {t('x38.add_client')}</Btn>} /> : (
          <div className="overflow-x-auto imo-scroll"><table className="imo-table">
            <thead><tr><th>{t('x38.client')}</th><th>{t('x38.type')}</th><th>{t('x38.phone')}</th><th>{t('h.budget')}</th><th>{t('pf.areas')}</th><th>{t('h.agent')}</th><th>{t('x38.since')}</th><th /></tr></thead>
            <tbody>{list.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/immo/client?id=${c.id}`)}>
                <td><div className="flex items-center gap-2"><Avatar name={c.name} size={28} /><div><div className="font-medium">{c.name} {c.do_not_contact && <Badge color="#7F1D1D"><Ban size={10} className="mr-0.5" />{t('dnc.badge')}</Badge>}</div><div className="text-[11.5px] t-muted">{c.email ?? c.nationality ?? ''}</div></div></div></td>
                <td><Badge color={KIND_COLOR[c.kind]}>{c.kind}</Badge></td><td>{c.phone ?? '-'}</td><td>{c.budget ? qar(c.budget) : '-'}</td><td className="t-muted">{c.preferred_areas ?? '-'}</td><td>{c.agent ?? '-'}</td><td className="t-muted">{ago(c.created_at)}</td>
                <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}><Btn style={{ padding: '4px 8px' }} onClick={() => router.push(`/immo/client?id=${c.id}`)} title={t('pf.title')} aria-label={t('pf.title')}><IdCard size={13} /></Btn> <Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(c)}><Pencil size={13} /></Btn> {canDelete && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(tf('cf.client', { name: c.name })) && remove('clients', c.id)}><Trash2 size={13} /></Btn>}</td>
              </tr>))}</tbody></table></div>
        )}
      </Card>

      {edit && (
        <Modal title={edit.id ? t('xm.edit_client') : t('x38.add_client')} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('x38.name')}><input className="imo-input" value={edit.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label={t('x38.type')}><select className="imo-select" value={edit.kind} onChange={(e) => set('kind', e.target.value)}>{CLIENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select></Field>
            <Field label={t('x38.phone')}><input className="imo-input" value={edit.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+974…" /></Field>
            <Field label={t('team.invite.email')}><input className="imo-input" value={edit.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label={t('x38.nationality')}><input className="imo-input" value={edit.nationality ?? ''} onChange={(e) => set('nationality', e.target.value)} /></Field>
            <Field label={t('x38.budget_qar')}><input type="number" min={0} className="imo-input" value={edit.budget ?? 0} onChange={(e) => set('budget', Number(e.target.value))} /></Field>
            <Field label={t('beds.wanted')}><input type="number" min={0} max={20} className="imo-input" value={edit.beds_wanted ?? ''} onChange={(e) => set('beds_wanted', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label={t('pf.areas')}><input className="imo-input" value={edit.preferred_areas ?? ''} onChange={(e) => set('preferred_areas', e.target.value)} placeholder="Lusail, The Pearl" /></Field>
            <Field label={t('h.agent')}><select className="imo-select" value={edit.agent ?? ''} onChange={(e) => set('agent', e.target.value)}><option value="">{t('x38.unassigned')}</option>{agents.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <div className="sm:col-span-2"><Field label={t('pf.notes')}><textarea className="imo-textarea" value={edit.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><label className="flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-1" checked={!!edit.do_not_contact} disabled={!!edit.id && !!data.clients.find((x) => x.id === edit.id)?.do_not_contact && !manager} onChange={(e) => set('do_not_contact', e.target.checked)} /><span><b>{t('dnc.label')}</b><span className="block t-muted text-[12px]">{t('dnc.help')}</span></span></label></div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>{t('f.cancel')}</Btn><Btn kind="primary" onClick={save}>{t('x38.save_client')}</Btn></div>
        </Modal>
      )}
    </div>
  )
}
