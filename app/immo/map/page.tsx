'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import { useImmo } from '@/lib/immo-os/store'
import { Card, Empty, PageHead } from '@/lib/immo-os/ui'
import { googleLink, osmLink } from '@/lib/immo-os/geo'
import { qar } from '@/lib/immo-os/helpers'

// n°12 : carte de tous les biens avec coordonnees. OpenStreetMap (aucune cle) ; liens Google Maps en complement.
const STATUS_COLOR: Record<string, string> = { available: '#16A34A', reserved: '#F59E0B', sold: '#EF4444', rented: '#8B5CF6' }
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export default function MapPage() {
  const { data, t, tf } = useImmo()
  const el = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<string | null>(null)
  useEffect(() => { setFocus(new URLSearchParams(window.location.search).get('p')) }, [])
  const withGeo = useMemo(() => data.properties.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'), [data.properties])
  const missing = data.properties.length - withGeo.length

  useEffect(() => {
    if (!el.current || withGeo.length === 0) return
    let map: any
    let off = false
    import('leaflet').then((L) => {
      if (off || !el.current) return
      map = L.map(el.current, { scrollWheelZoom: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map)
      const pts: [number, number][] = []
      for (const p of withGeo) {
        const c = STATUS_COLOR[p.status] ?? '#2563EB'
        const icon = L.divIcon({ className: '', html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`, iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20] })
        const m = L.marker([p.lat as number, p.lng as number], { icon, title: p.title }).addTo(map)
        m.bindPopup(`<b>${esc(p.title)}</b><br>${esc(p.area ?? '')}<br>${esc(qar(p.price))}<br><a href="${googleLink({ lat: p.lat as number, lng: p.lng as number })}" target="_blank" rel="noopener noreferrer">${esc(t('map.google'))}</a>`)
        if (p.id === focus) m.openPopup()
        pts.push([p.lat as number, p.lng as number])
      }
      const f = withGeo.find((p) => p.id === focus)
      if (f) map.setView([f.lat as number, f.lng as number], 16)
      else map.fitBounds(pts, { padding: [40, 40], maxZoom: 15 })
    })
    return () => { off = true; map?.remove() }
  }, [withGeo, focus, t])

  return (
    <div>
      <PageHead icon={<MapPin size={28} />} title={t('map.title')} sub={t('map.sub')} />
      {withGeo.length === 0 ? <Card><Empty title={t('map.none')} /></Card> : (
        <Card pad={false}><div ref={el} style={{ height: 'calc(100vh - 290px)', minHeight: 380, borderRadius: 12 }} /></Card>
      )}
      <div className="mt-3 text-[12.5px] t-muted flex flex-wrap gap-x-4 gap-y-1">
        {missing > 0 && <span>{tf('map.missing', { n: missing })} · <Link href="/immo/properties" className="underline">{t('nav.properties')}</Link></span>}
        {withGeo.length > 0 && <span>{t('map.attr')} · <a className="underline" href={osmLink({ lat: withGeo[0].lat as number, lng: withGeo[0].lng as number })} target="_blank" rel="noopener noreferrer">{t('map.osm')}</a></span>}
      </div>
    </div>
  )
}
