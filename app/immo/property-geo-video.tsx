'use client'

import { useState } from 'react'
import { MapPin, Video, X } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Btn, Field } from '@/lib/immo-os/ui'
import { supabase } from '@/lib/supabase'
import { mapEmbed, parseCoords, videoExt, VIDEO_BUCKET, VIDEO_MAX_BYTES } from '@/lib/immo-os/geo'
import type { Property } from '@/lib/immo-os/types'

// Lot 8 : position sur la carte (n°12) et video du bien (n°11 / n°71) dans la fiche d'un bien.
export default function PropertyGeoVideo({ edit, set }: { edit: Partial<Property>; set: (k: keyof Property, v: unknown) => void }) {
  const { t, mode, callApi, notify } = useImmo()
  const [paste, setPaste] = useState('')
  const [up, setUp] = useState(false)
  const has = typeof edit.lat === 'number' && typeof edit.lng === 'number'
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY // facultative : sans elle, OpenStreetMap

  const onPaste = (v: string) => {
    setPaste(v)
    if (!v.trim()) return
    const c = parseCoords(v)
    if (c) { set('lat', c.lat); set('lng', c.lng) }
  }
  const pickVideo = async (f: File | undefined) => {
    if (!f) return
    if (mode !== 'live') return notify(t('vid.demo'), 'err')
    if (f.size > VIDEO_MAX_BYTES) return notify(t('vid.big'), 'err')
    if (!videoExt(f.type, f.name)) return notify(t('vid.type'), 'err')
    setUp(true)
    try {
      const r = await callApi('/api/immo?r=upload&kind=video-url', { method: 'POST', body: JSON.stringify({ type: f.type, name: f.name, size: f.size }) })
      if (!r.ok) throw new Error(r.json?.error ?? 'Upload failed')
      // envoi direct au stockage avec l'adresse signee (le bucket refuse > 50 Mo et les autres formats)
      const { error } = await supabase.storage.from(VIDEO_BUCKET).uploadToSignedUrl(r.json.path, r.json.token, f, { contentType: f.type || undefined })
      if (error) throw new Error(error.message)
      set('video_url', r.json.url)
    } catch (e) { notify(e instanceof Error ? e.message : 'Upload failed', 'err') }
    setUp(false)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Field label={t('map.coords')}>
          <div className="grid gap-2">
            <input className="imo-input" dir="ltr" placeholder={t('map.paste')} value={paste} onChange={(e) => onPaste(e.target.value)} />
            {paste.trim() && !parseCoords(paste) && <div className="text-[12px]" style={{ color: '#B91C1C' }}>{t('map.invalid')}</div>}
            <div className="grid grid-cols-2 gap-2">
              <input className="imo-input" dir="ltr" inputMode="decimal" aria-label={t('map.lat')} placeholder={t('map.lat')} value={edit.lat ?? ''} onChange={(e) => set('lat', e.target.value === '' ? null : Number(e.target.value))} />
              <input className="imo-input" dir="ltr" inputMode="decimal" aria-label={t('map.lng')} placeholder={t('map.lng')} value={edit.lng ?? ''} onChange={(e) => set('lng', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
            {has && <>
              <iframe title={t('map.coords')} src={mapEmbed({ lat: edit.lat as number, lng: edit.lng as number }, key).url} style={{ width: '100%', height: 170, border: 0, borderRadius: 8 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              <div className="flex items-center justify-between gap-2 text-[11.5px] t-muted"><span>{key ? '' : t('map.attr')}</span><Btn style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => { set('lat', null); set('lng', null); setPaste('') }}><MapPin size={12} /> {t('map.clear')}</Btn></div>
            </>}
          </div>
        </Field>
      </div>
      <div>
        <Field label={t('vid.title')}>
          <div className="grid gap-2">
            {edit.video_url ? (
              <div className="relative"><video src={edit.video_url} controls preload="metadata" style={{ width: '100%', maxHeight: 190, borderRadius: 8, background: '#000' }} />
                <Btn kind="danger" style={{ padding: '2px 8px', fontSize: 12, marginTop: 6 }} onClick={() => set('video_url', null)}><X size={12} /> {t('vid.remove')}</Btn></div>
            ) : (
              <label className="imo-btn" style={{ cursor: up ? 'wait' : 'pointer', justifyContent: 'center' }}><Video size={15} /> {up ? t('vid.uploading') : t('vid.add')}
                <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={up} onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = '' }} /></label>
            )}
            <div className="text-[11.5px] t-muted">{t('vid.help')}</div>
          </div>
        </Field>
      </div>
    </div>
  )
}
