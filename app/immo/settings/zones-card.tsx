'use client'

import { useMemo, useState } from 'react'
import { MapPin, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle } from '@/lib/immo-os/ui'
import { DEFAULT_MUNICIPALITIES, type Zone, type ZoneLevel } from '@/lib/immo-os/types'
import { isManager } from '@/lib/immo-os/permissions'
import { zoneLabel, subtreeIds } from '@/lib/immo-os/zones'

type Draft = { id?: string; level: ZoneLevel; parent_id: string | null; name: string; name_ar: string }
const LEVEL_COLOR: Record<ZoneLevel, string> = { municipality: '#0B2447', zone: '#2563EB', project: '#B45309' }
const CHILD: Record<ZoneLevel, ZoneLevel | null> = { municipality: 'zone', zone: 'project', project: null }

// Parametres > Zones et projets : hierarchie configurable municipalite > zone > projet (l'unite = le bien).
export default function ZonesCard() {
  const { data, me, mode, create, update, remove, reload, notify, t, tf, lang } = useImmo()
  const manager = isManager(me?.role)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const kids = useMemo(() => {
    const m = new Map<string | null, Zone[]>()
    for (const z of data.zones) {
      const k = data.zones.some((p) => p.id === z.parent_id) ? z.parent_id ?? null : null
      m.set(k, [...(m.get(k) ?? []), z])
    }
    m.forEach((v) => v.sort((a, b) => a.name.localeCompare(b.name)))
    return m
  }, [data.zones])
  const units = (z: Zone) => { const ids = subtreeIds(data.zones, z.id); return data.properties.filter((p) => p.zone_id && ids.has(p.zone_id)).length }

  const save = async () => {
    if (!draft) return
    const name = draft.name.trim()
    if (!name) return notify(t('zones.name'), 'err')
    setBusy(true)
    const body = { level: draft.level, parent_id: draft.parent_id, name, name_ar: draft.name_ar.trim() || null }
    if (draft.id) await update('zones', draft.id, { name: body.name, name_ar: body.name_ar })
    else await create('zones', body)
    setBusy(false)
    setDraft(null)
  }
  const del = async (z: Zone) => {
    if (!window.confirm(tf('zones.delete', { name: z.name }))) return
    setBusy(true)
    // On supprime les niveaux du bas vers le haut pour ne laisser aucun orphelin
    const ids = Array.from(subtreeIds(data.zones, z.id))
    const order = ids.map((id) => data.zones.find((x) => x.id === id)!).filter(Boolean).sort((a, b) => (a.level === 'project' ? 0 : a.level === 'zone' ? 1 : 2) - (b.level === 'project' ? 0 : b.level === 'zone' ? 1 : 2))
    for (const n of order) await remove('zones', n.id)
    await reload()
    setBusy(false)
  }
  const loadDefaults = async () => {
    setBusy(true)
    const munis = await Promise.all(DEFAULT_MUNICIPALITIES.map((m) => create<Zone>('zones', { level: 'municipality', name: m.name, name_ar: m.name_ar, parent_id: null })))
    const jobs: Promise<unknown>[] = []
    DEFAULT_MUNICIPALITIES.forEach((m, i) => {
      const parent = munis[i]
      if (parent) m.zones.forEach((z) => jobs.push(create('zones', { level: 'zone', name: z.name, name_ar: z.name_ar, parent_id: parent.id })))
    })
    await Promise.all(jobs)
    setBusy(false)
    notify(t('zones.loaded'))
  }

  // Fonctions de rendu (pas des composants) : sinon les champs perdent le focus a chaque frappe
  const renderRow = (z: Zone, depth: number): JSX.Element => {
    const child = CHILD[z.level]
    const editing = draft?.id === z.id
    return (
      <div key={z.id}>
        <div className="flex items-center gap-2 py-1.5 flex-wrap" style={{ paddingInlineStart: depth * 20 }}>
          <Badge color={LEVEL_COLOR[z.level]}>{t('zone.' + z.level)}</Badge>
          {editing ? (
            <>
              <input className="imo-input" style={{ width: 160 }} value={draft!.name} onChange={(e) => setDraft({ ...draft!, name: e.target.value })} aria-label={t('zones.name')} autoFocus />
              <input className="imo-input" style={{ width: 160 }} value={draft!.name_ar} onChange={(e) => setDraft({ ...draft!, name_ar: e.target.value })} aria-label={t('zones.name_ar')} dir="rtl" />
              <Btn kind="primary" disabled={busy} onClick={save} style={{ padding: '4px 8px' }}><Check size={13} /></Btn>
              <Btn onClick={() => setDraft(null)} style={{ padding: '4px 8px' }}><X size={13} /></Btn>
            </>
          ) : (
            <>
              <span className="font-medium text-[13px]">{zoneLabel(z, lang)}</span>
              <span className="text-[12px] t-muted">{tf('zones.units', { n: units(z) })}</span>
              {manager && (
                <span className="flex gap-1 ms-auto">
                  {child && <Btn style={{ padding: '3px 7px' }} onClick={() => setDraft({ level: child, parent_id: z.id, name: '', name_ar: '' })} title={t('zones.add.' + child)}><Plus size={12} /> {t('zone.' + child)}</Btn>}
                  <Btn style={{ padding: '3px 7px' }} onClick={() => setDraft({ id: z.id, level: z.level, parent_id: z.parent_id ?? null, name: z.name, name_ar: z.name_ar ?? '' })} aria-label={t('zones.edit')} title={t('zones.edit')}><Pencil size={12} /></Btn>
                  <Btn kind="danger" disabled={busy} style={{ padding: '3px 7px' }} onClick={() => del(z)} aria-label={t('f.delete')}><Trash2 size={12} /></Btn>
                </span>
              )}
            </>
          )}
        </div>
        {draft && !draft.id && draft.parent_id === z.id && renderNew(depth + 1)}
        {(kids.get(z.id) ?? []).map((c) => renderRow(c, depth + 1))}
      </div>
    )
  }
  const renderNew = (depth: number): JSX.Element => (
    <div key="new" className="flex items-center gap-2 py-1.5 flex-wrap" style={{ paddingInlineStart: depth * 20 }}>
      <Badge color={LEVEL_COLOR[draft!.level]}>{t('zone.' + draft!.level)}</Badge>
      <input className="imo-input" style={{ width: 160 }} placeholder={t('zones.name')} value={draft!.name} onChange={(e) => setDraft({ ...draft!, name: e.target.value })} autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
      <input className="imo-input" style={{ width: 160 }} placeholder={t('zones.name_ar')} value={draft!.name_ar} onChange={(e) => setDraft({ ...draft!, name_ar: e.target.value })} dir="rtl" onKeyDown={(e) => e.key === 'Enter' && save()} />
      <Btn kind="primary" disabled={busy} onClick={save} style={{ padding: '4px 8px' }}><Check size={13} /></Btn>
      <Btn onClick={() => setDraft(null)} style={{ padding: '4px 8px' }}><X size={13} /></Btn>
    </div>
  )

  const roots = kids.get(null) ?? []
  return (
    <Card className="lg:col-span-2">
      <CardTitle icon={<MapPin size={17} />} title={t('zones.title')} right={manager && (
        <Btn onClick={() => setDraft({ level: 'municipality', parent_id: null, name: '', name_ar: '' })}><Plus size={13} /> {t('zones.add.municipality')}</Btn>
      )} />
      <div className="text-[13px] t-muted mb-3">{t('zones.sub')}</div>
      {!manager && <div className="text-[12.5px] mb-2" style={{ color: '#92400E' }}>{t('zones.managers')}</div>}
      {mode === 'live' && data.zones.length === 0 && <div className="text-[12px] t-muted mb-2">{t('zones.migration')}</div>}
      {roots.length === 0 && !draft && (
        <div className="text-[13px] t-muted flex items-center gap-3 flex-wrap">
          <span>{t('zones.empty')}</span>
          {manager && <Btn kind="gold" disabled={busy} onClick={loadDefaults}>{t('zones.load')}</Btn>}
        </div>
      )}
      {draft && !draft.id && draft.level === 'municipality' && renderNew(0)}
      <div>{roots.map((z) => renderRow(z, 0))}</div>
    </Card>
  )
}
