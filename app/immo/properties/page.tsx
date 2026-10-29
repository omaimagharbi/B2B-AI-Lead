'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Search, LayoutGrid, List, Pencil, Trash2, Megaphone, Star, Link2 } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, Empty, Field, Modal, PageHead, PropImage } from '@/lib/immo-os/ui'
import { AREAS, PROP_TYPES, type Property } from '@/lib/immo-os/types'
import { qar } from '@/lib/immo-os/helpers'
import { confirmDelete, useQueryParam } from '@/lib/immo-os/hooks'

const STATUS_COLOR: Record<string, string> = { available: '#16A34A', reserved: '#F59E0B', sold: '#EF4444', rented: '#8B5CF6' }
const blank = (): Partial<Property> => ({ title: '', type: 'apartment', listing: 'sale', status: 'available', area: AREAS[0], price: 0, beds: 0, baths: 0, size_m2: 0, featured: false, owner_id: null, image_url: '', description: '' })

export default function PropertiesPage() {
  const { data, create, update, remove, notify, clientId, uploadPhoto, canDelete } = useImmo()
  const [uploading, setUploading] = useState(false)
  const onFile = async (f?: File | null) => {
    if (!f) return
    setUploading(true)
    const url = await uploadPhoto(f)
    setUploading(false)
    if (url) setEdit((e) => ({ ...e, image_url: url }))
  }
  const copyLink = async (id: string) => {
    if (!clientId) return notify('Agency not loaded yet', 'err')
    try { await navigator.clipboard.writeText(`${window.location.origin}/lead?a=${clientId}&property=${id}`); notify('Lead form link copied') } catch { notify('Copy failed', 'err') }
  }
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ type: '', listing: '', area: '', status: '' })
  const [edit, setEdit] = useState<Partial<Property> | null>(null)
  const [saving, setSaving] = useState(false)
  const wantNew = useQueryParam('new')
  useEffect(() => { if (wantNew) setEdit(blank()) }, [wantNew])

  const list = useMemo(() => data.properties.filter((p) =>
    (!q || `${p.title} ${p.area}`.toLowerCase().includes(q.toLowerCase())) &&
    (!f.type || p.type === f.type) && (!f.listing || p.listing === f.listing) && (!f.area || p.area === f.area) && (!f.status || p.status === f.status),
  ), [data.properties, q, f])

  const owner = (id?: string | null) => data.owners.find((o) => o.id === id)?.name

  const save = async () => {
    if (!edit?.title?.trim()) return notify('Title is required', 'err')
    if (!(Number(edit.price) > 0)) return notify('Price must be greater than 0', 'err')
    setSaving(true)
    if (edit.id) await update('properties', edit.id, edit)
    else await create('properties', edit)
    setSaving(false)
    setEdit(null)
  }
  const set = (k: keyof Property, v: unknown) => setEdit((e) => ({ ...e, [k]: v }))

  return (
    <div>
      <PageHead icon={<Building2 size={28} />} title="Properties" sub={`${list.length} of ${data.properties.length} properties`}
        right={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={15} /> Add property</Btn>} />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 t-muted" /><input className="imo-input" style={{ paddingLeft: 32 }} placeholder="Search title or area…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="imo-select" style={{ width: 140 }} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option>{PROP_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
          <select className="imo-select" style={{ width: 130 }} value={f.listing} onChange={(e) => setF({ ...f, listing: e.target.value })}><option value="">Sale &amp; rent</option><option value="sale">For sale</option><option value="rent">For rent</option></select>
          <select className="imo-select" style={{ width: 160 }} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">All areas</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
          <select className="imo-select" style={{ width: 130 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All status</option>{Object.keys(STATUS_COLOR).map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <div className="flex gap-1"><Btn onClick={() => setView('grid')} style={view === 'grid' ? { borderColor: 'var(--gold)' } : undefined} aria-label="Grid"><LayoutGrid size={15} /></Btn><Btn onClick={() => setView('table')} style={view === 'table' ? { borderColor: 'var(--gold)' } : undefined} aria-label="Table"><List size={15} /></Btn></div>
        </div>
      </Card>

      {list.length === 0 ? <Card><Empty title="No properties found" sub="Adjust the filters or add a new property." action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add property</Btn>} /></Card> : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((p) => (
            <Card key={p.id} pad={false} className="overflow-hidden">
              <div className="relative"><PropImage p={p} h={140} rounded={0} />
                <div className="absolute top-2 left-2 flex gap-1.5"><Badge color={p.listing === 'rent' ? '#2563EB' : '#16A34A'}>{p.listing === 'rent' ? 'For Rent' : 'For Sale'}</Badge></div>
                {p.featured && <Star size={16} className="absolute top-2 right-2" style={{ color: '#F5C542', fill: '#F5C542' }} />}
              </div>
              <div className="p-3.5">
                <div className="font-semibold truncate">{p.title}</div>
                <div className="text-[12.5px] t-muted">{p.area} · <span style={{ color: STATUS_COLOR[p.status] }} className="font-semibold">{p.status}</span></div>
                <div className="text-[17px] font-bold mt-1">{qar(p.price)}{p.listing === 'rent' && <span className="text-[12px] t-muted font-normal"> /month</span>}</div>
                <div className="text-[12px] t-muted">{p.beds} bd · {p.baths} ba · {p.size_m2} m²{owner(p.owner_id) ? ` · ${owner(p.owner_id)}` : ''}</div>
                <div className="flex gap-1.5 mt-3">
                  <Btn style={{ padding: '5px 9px' }} onClick={() => setEdit(p)} aria-label="Edit"><Pencil size={13} /></Btn>
                  <Link href={`/immo/marketing?property=${p.id}`}><Btn style={{ padding: '5px 9px' }}><Megaphone size={13} /> Ad</Btn></Link>
                  <Btn style={{ padding: '5px 9px' }} onClick={() => copyLink(p.id)} title="Copy the lead form link for this property"><Link2 size={13} /> Link</Btn>
                  {canDelete && <Btn kind="danger" style={{ padding: '5px 9px', marginLeft: 'auto' }} aria-label="Delete" onClick={() => confirmDelete(`"${p.title}"`) && remove('properties', p.id)}><Trash2 size={13} /></Btn>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card pad={false}><div className="overflow-x-auto imo-scroll"><table className="imo-table">
          <thead><tr><th>Property</th><th>Type</th><th>Area</th><th>Price</th><th>Beds</th><th>Size</th><th>Owner</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td className="font-medium">{p.title}{p.featured && <Star size={12} className="inline ml-1" style={{ color: '#F5C542', fill: '#F5C542' }} />}</td><td>{p.type}</td><td>{p.area}</td><td>{qar(p.price)}{p.listing === 'rent' ? '/mo' : ''}</td><td>{p.beds}</td><td>{p.size_m2} m²</td><td>{owner(p.owner_id) ?? '-'}</td>
              <td><Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
              <td className="text-right whitespace-nowrap"><Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(p)}><Pencil size={13} /></Btn> {canDelete && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(`"${p.title}"`) && remove('properties', p.id)}><Trash2 size={13} /></Btn>}</td></tr>
          ))}</tbody></table></div></Card>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit property' : 'Add property'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title *"><input className="imo-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Luxury Villa" /></Field></div>
            <Field label="Type"><select className="imo-select" value={edit.type} onChange={(e) => set('type', e.target.value)}>{PROP_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</select></Field>
            <Field label="Listing"><select className="imo-select" value={edit.listing} onChange={(e) => set('listing', e.target.value)}><option value="sale">For sale</option><option value="rent">For rent</option></select></Field>
            <Field label="Area"><select className="imo-select" value={edit.area ?? ''} onChange={(e) => set('area', e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></Field>
            <Field label="Status"><select className="imo-select" value={edit.status} onChange={(e) => set('status', e.target.value)}>{Object.keys(STATUS_COLOR).map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label={`Price (QAR)${edit.listing === 'rent' ? ' per month' : ''} *`}><input type="number" min={0} className="imo-input" value={edit.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} /></Field>
            <Field label="Size (m²)"><input type="number" min={0} className="imo-input" value={edit.size_m2 ?? 0} onChange={(e) => set('size_m2', Number(e.target.value))} /></Field>
            <Field label="Bedrooms"><input type="number" min={0} className="imo-input" value={edit.beds ?? 0} onChange={(e) => set('beds', Number(e.target.value))} /></Field>
            <Field label="Bathrooms"><input type="number" min={0} className="imo-input" value={edit.baths ?? 0} onChange={(e) => set('baths', Number(e.target.value))} /></Field>
            <Field label="Owner"><select className="imo-select" value={edit.owner_id ?? ''} onChange={(e) => set('owner_id', e.target.value || null)}><option value="">- none -</option>{data.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Photo">
              <div className="flex gap-2 items-center">
                <label className="imo-btn" style={{ cursor: uploading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>{uploading ? 'Uploading…' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} style={{ display: 'none' }} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} /></label>
                <input className="imo-input" value={edit.image_url ?? ''} onChange={(e) => set('image_url', e.target.value)} placeholder="or paste an image URL" />
              </div>
              {edit.image_url && <div className="mt-2" style={{ maxWidth: 220 }}><PropImage p={{ type: (edit.type ?? 'apartment') as Property['type'], image_url: edit.image_url, title: edit.title ?? '' }} h={110} /></div>}
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><textarea className="imo-textarea" value={edit.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><input type="checkbox" checked={!!edit.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured property (shown on the dashboard)</label>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save property'}</Btn></div>
        </Modal>
      )}
    </div>
  )
}
