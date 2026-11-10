'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import PropertyGeoVideo from '../property-geo-video'
import { Building2, Plus, Search, LayoutGrid, List, Pencil, Trash2, Megaphone, Star, Link2, X, Images } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, Empty, Field, Gallery, Modal, PageHead, PropImage } from '@/lib/immo-os/ui'
import { AREAS, MAX_PHOTOS, PROP_TYPES, TENURES, type Property } from '@/lib/immo-os/types'
import { areaOf, filterNodes, legacyAreas, locationOptions, pathText, subtreeIds } from '@/lib/immo-os/zones'
import { qar } from '@/lib/immo-os/helpers'
import { confirmDelete, useQueryParam } from '@/lib/immo-os/hooks'

const STATUS_COLOR: Record<string, string> = { available: '#16A34A', reserved: '#F59E0B', sold: '#EF4444', rented: '#8B5CF6' }
const blank = (): Partial<Property> => ({ title: '', type: 'apartment', listing: 'sale', status: 'available', area: AREAS[0], price: 0, beds: 0, baths: 0, size_m2: 0, featured: false, owner_id: null, image_url: '', photos: [], description: '', tenure: null, usufruct_years: null, zone_id: null, unit_no: '', commission_pct: null })

export default function PropertiesPage() {
  const { data, create, update, remove, notify, clientId, uploadPhoto, canDelete, t, tf, lang } = useImmo()
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [similarOf, setSimilarOf] = useState<Property | null>(null)
  const [gallery, setGallery] = useState<{ photos: string[]; start: number } | null>(null)
  const photosOf = (p: Partial<Property>): string[] => (p.photos?.length ? p.photos : p.image_url ? [p.image_url] : [])
  const setPhotos = (list: string[]) => setEdit((e) => ({ ...e, photos: list, image_url: list[0] ?? null }))
  const room = () => MAX_PHOTOS - photosOf(edit ?? {}).length
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const picked = Array.from(files)
    if (picked.length > room()) notify(tf('photo.max', { n: MAX_PHOTOS }), 'err')
    setUploading(true)
    const urls: string[] = []
    for (const f of picked.slice(0, Math.max(0, room()))) {
      const u = await uploadPhoto(f)
      if (u) urls.push(u)
    }
    setUploading(false)
    if (urls.length) setEdit((e) => { const list = [...photosOf(e ?? {}), ...urls].slice(0, MAX_PHOTOS); return { ...e, photos: list, image_url: list[0] ?? null } })
  }
  const addUrl = () => {
    const u = urlInput.trim()
    if (!/^https?:\/\//i.test(u)) return
    if (room() <= 0) return notify(tf('photo.max', { n: MAX_PHOTOS }), 'err')
    setPhotos([...photosOf(edit ?? {}), u].filter((x, i, a) => a.indexOf(x) === i))
    setUrlInput('')
  }
  const copyLink = async (id: string) => {
    if (!clientId) return notify('Agency not loaded yet', 'err')
    try { await navigator.clipboard.writeText(`${window.location.origin}/lead?a=${clientId}&property=${id}`); notify('Lead form link copied') } catch { notify('Copy failed', 'err') }
  }
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [q, setQ] = useState('')
  const [f, setF] = useState({ type: '', listing: '', area: '', status: '', tenure: '', node: '' })
  const [edit, setEdit] = useState<Partial<Property> | null>(null)
  const [saving, setSaving] = useState(false)
  const wantNew = useQueryParam('new')
  useEffect(() => { if (wantNew) setEdit(blank()) }, [wantNew])

  const hasZones = data.zones.length > 0
  const nodeSet = useMemo(() => (f.node ? subtreeIds(data.zones, f.node) : null), [f.node, data.zones])
  const locOptions = useMemo(() => locationOptions(data.zones, lang), [data.zones, lang])
  const nodeOptions = useMemo(() => filterNodes(data.zones, lang), [data.zones, lang])
  // Biens similaires (n°16) : meme offre + meme type, meme zone, prix a +-25 %, chambres proches ; les plus proches d'abord
  const similar = (p: Property): Property[] =>
    data.properties
      .filter((x) => x.id !== p.id && x.listing === p.listing && x.type === p.type && x.status !== 'sold' && x.status !== 'rented')
      .map((x) => {
        let sc = 0
        if (x.area && x.area === p.area) sc += 3
        if (p.price > 0 && Math.abs(x.price - p.price) / p.price <= 0.25) sc += 3
        if (p.beds != null && x.beds != null && Math.abs(x.beds - p.beds) <= 1) sc += 1
        return { x, sc }
      })
      .filter((r) => r.sc >= 3)
      .sort((a, b) => b.sc - a.sc)
      .slice(0, 4)
      .map((r) => r.x)
  const listedOn = (p: Property) => new Date(p.created_at).toLocaleDateString(lang === 'ar' ? 'ar' : lang === 'fr' ? 'fr-FR' : 'en-GB')
  const where = (p: Property) => (p.zone_id ? pathText(data.zones, p.zone_id, lang, ' · ') || p.area : p.area) || ''
  const tenureText = (p: Property) => (p.tenure ? (p.tenure === 'usufruct' && p.usufruct_years ? tf('tenure.usu_n', { n: p.usufruct_years }) : t('tenure.' + p.tenure)) : '')
  const list = useMemo(() => data.properties.filter((p) =>
    (!q || `${p.title} ${p.area} ${p.unit_no ?? ''}`.toLowerCase().includes(q.toLowerCase())) &&
    (!f.type || p.type === f.type) && (!f.listing || p.listing === f.listing) && (!f.area || p.area === f.area) && (!f.status || p.status === f.status) &&
    (!f.tenure || (f.tenure === 'none' ? !p.tenure : p.tenure === f.tenure)) &&
    (!f.node || (!!p.zone_id && nodeSet?.has(p.zone_id))),
  ), [data.properties, q, f, nodeSet])

  const owner = (id?: string | null) => data.owners.find((o) => o.id === id)?.name

  const save = async () => {
    if (!edit?.title?.trim()) return notify('Title is required', 'err')
    if (!(Number(edit.price) > 0)) return notify('Price must be greater than 0', 'err')
    const ph = photosOf(edit)
    const payload: Partial<Property> = {
      ...edit, photos: ph, image_url: ph[0] ?? null,
      usufruct_years: edit.tenure === 'usufruct' && Number(edit.usufruct_years) > 0 ? Math.round(Number(edit.usufruct_years)) : null,
      // le champ historique "area" suit la zone choisie (filtres, annonces, assistant IA)
      ...(edit.zone_id ? { area: areaOf(data.zones, edit.zone_id) } : {}),
    }
    setSaving(true)
    if (edit.id) await update('properties', edit.id, payload)
    else await create('properties', payload)
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
          <select className="imo-select" style={{ width: 140 }} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">{t('f.alltypes')}</option>{PROP_TYPES.map((x) => <option key={x.v} value={x.v}>{t('pt.' + x.v)}</option>)}</select>
          <select className="imo-select" style={{ width: 130 }} value={f.listing} onChange={(e) => setF({ ...f, listing: e.target.value })}><option value="">Sale &amp; rent</option><option value="sale">For sale</option><option value="rent">For rent</option></select>
          {hasZones
            ? <select className="imo-select" style={{ width: 210 }} value={f.node} onChange={(e) => setF({ ...f, node: e.target.value })}><option value="">{t('loc.allareas')}</option>{nodeOptions.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}</select>
            : <select className="imo-select" style={{ width: 160 }} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">{t('loc.allareas')}</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>}
          <select className="imo-select" style={{ width: 190 }} value={f.tenure} onChange={(e) => setF({ ...f, tenure: e.target.value })} aria-label={t('tenure.label')}><option value="">{t('tenure.all')}</option>{TENURES.map((x) => <option key={x} value={x}>{t('tenure.' + x)}</option>)}<option value="none">{t('tenure.none')}</option></select>
          <select className="imo-select" style={{ width: 130 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All status</option>{Object.keys(STATUS_COLOR).map((s) => <option key={s} value={s}>{s}</option>)}</select>
          <div className="flex gap-1"><Btn onClick={() => setView('grid')} style={view === 'grid' ? { borderColor: 'var(--gold)' } : undefined} aria-label="Grid"><LayoutGrid size={15} /></Btn><Btn onClick={() => setView('table')} style={view === 'table' ? { borderColor: 'var(--gold)' } : undefined} aria-label="Table"><List size={15} /></Btn></div>
        </div>
      </Card>

      {list.length === 0 ? <Card><Empty title="No properties found" sub="Adjust the filters or add a new property." action={<Btn kind="primary" onClick={() => setEdit(blank())}><Plus size={14} /> Add property</Btn>} /></Card> : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((p) => (
            <Card key={p.id} pad={false} className="overflow-hidden">
              <div className="relative"><div style={{ cursor: photosOf(p).length ? 'pointer' : undefined }} onClick={() => photosOf(p).length && setGallery({ photos: photosOf(p), start: 0 })}><PropImage p={p} h={140} rounded={0} /></div>
                <div className="absolute top-2 left-2 flex gap-1.5"><Badge color={p.listing === 'rent' ? '#2563EB' : '#16A34A'}>{p.listing === 'rent' ? 'For Rent' : 'For Sale'}</Badge></div>
                {p.featured && <Star size={16} className="absolute top-2 right-2" style={{ color: '#F5C542', fill: '#F5C542' }} />}
                {photosOf(p).length > 1 && <button className="absolute bottom-2 right-2 imo-badge" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }} onClick={() => setGallery({ photos: photosOf(p), start: 0 })} aria-label={t('photo.view')}><Images size={12} /> {photosOf(p).length}</button>}
              </div>
              <div className="p-3.5">
                <div className="font-semibold truncate">{p.title}</div>
                <div className="text-[12.5px] t-muted">{where(p)}{p.unit_no ? ` · ${p.unit_no}` : ''}{typeof p.lat === 'number' && <Link href={`/immo/map?p=${p.id}`} className="underline ms-1" aria-label={t('map.view')} title={t('map.view')}>📍</Link>}{p.video_url && <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="underline ms-1" title={t('vid.badge')}>▶ {t('vid.badge')}</a>} · <span style={{ color: STATUS_COLOR[p.status] }} className="font-semibold">{p.status}</span></div>
                {tenureText(p) && <div className="mt-1"><Badge color={p.tenure === 'usufruct' ? '#B45309' : '#0F766E'}>{tenureText(p)}</Badge></div>}
                <div className="text-[11.5px] t-muted mt-1">{t('prop.listed')} {listedOn(p)}{p.commission_pct ? ` · ${p.commission_pct}%` : ''} · <button className="underline" onClick={() => setSimilarOf(p)}>{t('sim.btn')}</button></div>
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
          <thead><tr><th>Property</th><th>Type</th><th>Area</th><th>{t('tenure.label')}</th><th>{t('prop.listed')}</th><th>Price</th><th>Beds</th><th>Size</th><th>Owner</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id}><td className="font-medium">{p.title}{p.featured && <Star size={12} className="inline ml-1" style={{ color: '#F5C542', fill: '#F5C542' }} />}</td><td>{t('pt.' + p.type)}</td><td>{where(p)}{p.unit_no ? ` · ${p.unit_no}` : ''}</td><td>{tenureText(p) || '-'}</td><td className="t-muted">{listedOn(p)}</td><td>{qar(p.price)}{p.listing === 'rent' ? '/mo' : ''}</td><td>{p.beds}</td><td>{p.size_m2} m²</td><td>{owner(p.owner_id) ?? '-'}</td>
              <td><Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge></td>
              <td className="text-right whitespace-nowrap"><Btn style={{ padding: '4px 8px' }} onClick={() => setEdit(p)}><Pencil size={13} /></Btn> {canDelete && <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={() => confirmDelete(`"${p.title}"`) && remove('properties', p.id)}><Trash2 size={13} /></Btn>}</td></tr>
          ))}</tbody></table></div></Card>
      )}

      {edit && (
        <Modal title={edit.id ? 'Edit property' : 'Add property'} onClose={() => setEdit(null)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Title *"><input className="imo-input" value={edit.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Luxury Villa" /></Field></div>
            <Field label="Type"><select className="imo-select" value={edit.type} onChange={(e) => set('type', e.target.value)}>{PROP_TYPES.map((x) => <option key={x.v} value={x.v}>{t('pt.' + x.v)}</option>)}</select></Field>
            <Field label="Listing"><select className="imo-select" value={edit.listing} onChange={(e) => set('listing', e.target.value)}><option value="sale">For sale</option><option value="rent">For rent</option></select></Field>
            {hasZones ? (
              <Field label={t('loc.label')}><select className="imo-select" value={edit.zone_id ?? ''} onChange={(e) => { const id = e.target.value || null; setEdit((x) => ({ ...x, zone_id: id, ...(id ? { area: areaOf(data.zones, id) } : {}) })) }}>
                <option value="">{edit.area && !edit.zone_id ? `${t('loc.legacy')}: ${edit.area}` : t('loc.none')}</option>
                {locOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></Field>
            ) : (
              <Field label="Area"><select className="imo-select" value={edit.area ?? ''} onChange={(e) => set('area', e.target.value)}>{legacyAreas(data.zones).map((a) => <option key={a}>{a}</option>)}</select></Field>
            )}
            <Field label={t('loc.unit')}><input className="imo-input" value={edit.unit_no ?? ''} onChange={(e) => set('unit_no', e.target.value)} maxLength={40} /></Field>
            <Field label={t('prop.commission')}><input type="number" min={0} max={100} step="0.1" className="imo-input" value={edit.commission_pct ?? ''} onChange={(e) => set('commission_pct', e.target.value === '' ? null : Number(e.target.value))} /></Field>
            <Field label={t('tenure.label')}><select className="imo-select" value={edit.tenure ?? ''} onChange={(e) => setEdit((x) => ({ ...x, tenure: (e.target.value || null) as Property['tenure'], ...(e.target.value === 'usufruct' ? {} : { usufruct_years: null }) }))}><option value="">{t('tenure.none')}</option>{TENURES.map((x) => <option key={x} value={x}>{t('tenure.' + x)}</option>)}</select></Field>
            {edit.tenure === 'usufruct' && <Field label={t('tenure.years')}><input type="number" min={1} max={999} className="imo-input" value={edit.usufruct_years ?? ''} onChange={(e) => set('usufruct_years', e.target.value === '' ? null : Number(e.target.value))} placeholder="99" /></Field>}
            <Field label="Status"><select className="imo-select" value={edit.status} onChange={(e) => set('status', e.target.value)}>{Object.keys(STATUS_COLOR).map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label={`Price (QAR)${edit.listing === 'rent' ? ' per month' : ''} *`}><input type="number" min={0} className="imo-input" value={edit.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} /></Field>
            <Field label="Size (m²)"><input type="number" min={0} className="imo-input" value={edit.size_m2 ?? 0} onChange={(e) => set('size_m2', Number(e.target.value))} /></Field>
            <Field label="Bedrooms"><input type="number" min={0} className="imo-input" value={edit.beds ?? 0} onChange={(e) => set('beds', Number(e.target.value))} /></Field>
            <Field label="Bathrooms"><input type="number" min={0} className="imo-input" value={edit.baths ?? 0} onChange={(e) => set('baths', Number(e.target.value))} /></Field>
            <Field label="Owner"><select className="imo-select" value={edit.owner_id ?? ''} onChange={(e) => set('owner_id', e.target.value || null)}><option value="">- none -</option>{data.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <div className="sm:col-span-2"><PropertyGeoVideo edit={edit} set={set} /></div>
            <div className="sm:col-span-2"><Field label={`${t('photo.title')} (${photosOf(edit).length}/${MAX_PHOTOS})`}>
              <div className="flex gap-2 items-center flex-wrap">
                <label className="imo-btn" style={{ cursor: uploading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>{uploading ? t('photo.uploading') : t('photo.add')}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploading || room() <= 0} style={{ display: 'none' }} onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} /></label>
                <input className="imo-input" style={{ flex: 1, minWidth: 160 }} value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl() } }} placeholder={t('photo.url')} dir="ltr" />
                <Btn onClick={addUrl} disabled={!urlInput.trim()}>{t('photo.addurl')}</Btn>
              </div>
              <div className="text-[12px] t-muted mt-1">{t('photo.hint')}</div>
              {photosOf(edit).length > 0 && (
                <div className="grid gap-2 mt-2 grid-cols-3 sm:grid-cols-4">
                  {photosOf(edit).map((u, i) => (
                    <div key={u} className="relative rounded-lg overflow-hidden" style={{ border: i === 0 ? '2px solid var(--gold)' : '1px solid var(--border)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" style={{ width: '100%', height: 84, objectFit: 'cover', display: 'block' }} />
                      {i === 0 ? <span className="absolute bottom-1 left-1 imo-badge" style={{ background: 'var(--gold)', color: '#1B1B1B' }}>{t('photo.cover')}</span>
                        : <button type="button" className="absolute bottom-1 left-1 imo-badge" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }} onClick={() => setPhotos([u, ...photosOf(edit).filter((x) => x !== u)])}>{t('photo.makecover')}</button>}
                      <button type="button" aria-label={t('photo.remove')} title={t('photo.remove')} className="absolute top-1 right-1 rounded-full p-0.5" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }} onClick={() => setPhotos(photosOf(edit).filter((x) => x !== u))}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </Field></div>
            <div className="sm:col-span-2"><Field label="Description"><textarea className="imo-textarea" value={edit.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><input type="checkbox" checked={!!edit.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured property (shown on the dashboard)</label>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save property'}</Btn></div>
        </Modal>
      )}
      {similarOf && (
        <Modal title={`${t('sim.title')} - ${similarOf.title}`} onClose={() => setSimilarOf(null)}>
          <div className="text-[12px] t-muted mb-3">{t('sim.rule')}</div>
          {similar(similarOf).length === 0 ? <div className="text-[13px]">{t('sim.none')}</div> : (
            <div className="grid gap-2">
              {similar(similarOf).map((x) => (
                <div key={x.id} className="flex items-center gap-3 rounded-lg p-2" style={{ border: '1px solid var(--border)' }}>
                  <div style={{ width: 72 }}><PropImage p={x} h={52} rounded={8} /></div>
                  <div className="min-w-0 flex-1"><div className="font-semibold text-[13px] truncate">{x.title}</div><div className="text-[12px] t-muted truncate">{where(x)}{x.beds != null ? ` · ${x.beds} bd` : ''}</div></div>
                  <div className="text-[13px] font-bold whitespace-nowrap">{qar(x.price)}</div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
      {gallery && <Gallery photos={gallery.photos} start={gallery.start} onClose={() => setGallery(null)} labels={{ prev: t('photo.prev'), next: t('photo.next'), close: t('f.close') }} />}
    </div>
  )
}
