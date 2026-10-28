'use client'

import { useEffect, useId, type ReactNode, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import type { Property } from './types'
import { initials } from './helpers'

export function Card({ children, className = '', style, pad = true }: { children: ReactNode; className?: string; style?: CSSProperties; pad?: boolean }) {
  return <div className={`imo-card ${pad ? 'imo-card-pad' : ''} ${className}`} style={style}>{children}</div>
}
export function CardTitle({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <div className="flex items-center gap-2 font-semibold text-[15px]" style={{ color: 'var(--text)' }}>
        {icon}
        {title}
      </div>
      {right}
    </div>
  )
}
export function Btn({ children, kind = 'default', ...p }: { kind?: 'default' | 'primary' | 'gold' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const k = kind === 'primary' ? 'imo-btn-primary' : kind === 'gold' ? 'imo-btn-gold' : kind === 'danger' ? 'imo-btn-danger' : ''
  return <button {...p} className={`imo-btn ${k} ${p.className ?? ''}`}>{children}</button>
}
export function Badge({ children, color = '#2563EB' }: { children: ReactNode; color?: string }) {
  return <span className="imo-badge" style={{ background: `${color}22`, color }}>{children}</span>
}
export function Avatar({ name, size = 32, src }: { name: string; size?: number; src?: string | null }) {
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue} 55% 42%)`, color: '#fff', fontSize: size * 0.38, fontWeight: 700 }} className="flex items-center justify-center shrink-0">
      {initials(name)}
    </div>
  )
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="imo-label">{label}</label>
      {children}
    </div>
  )
}
export function PageHead({ title, sub, right, icon }: { title: string; sub?: string; right?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        {icon && <div style={{ color: 'var(--navy)' }} className="hidden sm:block">{icon}</div>}
        <div>
          <h1 className="text-[24px] font-bold leading-tight">{title}</h1>
          {sub && <div className="text-[13px] t-muted">{sub}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{right}</div>
    </div>
  )
}
export function Kpi({ icon, color, label, value, delta, vs = 'vs. last month' }: { icon: ReactNode; color: string; label: string; value: ReactNode; delta?: number | null; vs?: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color, color: '#fff' }}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[12.5px] t-muted">{label}</div>
          <div className="text-[24px] font-bold leading-tight">{value}</div>
          {delta !== undefined && delta !== null && (
            <div className="text-[12px] font-semibold" style={{ color: delta >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% <span className="t-muted font-normal">{vs}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
export function Ring({ pct, size = 84, color = '#14B8A6', label }: { pct: number; size?: number; color?: string; label?: string }) {
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  return (
    <div style={{ width: size, height: size, position: 'relative' }} className="shrink-0">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold" style={{ fontSize: size * 0.22 }}>{label ?? `${Math.round(pct)}%`}</div>
    </div>
  )
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="imo-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="imo-card w-full" style={{ maxWidth: wide ? 820 : 560, background: 'var(--card)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="font-bold text-[16px]">{title}</div>
          <button onClick={onClose} aria-label="Close" className="t-muted"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10">
      <div className="font-semibold">{title}</div>
      {sub && <div className="text-[13px] t-muted mt-1">{sub}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
export function Dots() {
  return <span className="imo-dots"><span /><span /><span /></span>
}


// Illustrations vectorielles de biens (rendu "photo" sans fichier image) : ciel, soleil, sable, batiment, palmiers.
function Palm({ x, h = 46 }: { x: number; h?: number }) {
  return (
    <g>
      <path d={`M${x} 104 Q${x - 1} ${104 - h / 2} ${x + 1} ${104 - h}`} stroke="#6B4A2B" strokeWidth="2.2" fill="none" />
      {[-26, -12, 6, 22, 36].map((a, i) => (
        <path key={i} d={`M${x + 1} ${104 - h} q${a * 0.9} ${-8 + Math.abs(a) * 0.12} ${a * 1.2} ${8 + Math.abs(a) * 0.15}`} stroke="#2F7D3A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      ))}
    </g>
  )
}
function Windows({ x, y, cols, rows, w = 7, h = 9, gx = 5, gy = 6, fill = '#BFE3F7' }: { x: number; y: number; cols: number; rows: number; w?: number; h?: number; gx?: number; gy?: number; fill?: string }) {
  const out = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(<rect key={`${r}-${c}`} x={x + c * (w + gx)} y={y + r * (h + gy)} width={w} height={h} rx="1" fill={fill} opacity={(r + c) % 4 === 0 ? 0.55 : 0.95} />)
  return <g>{out}</g>
}
export function PropArt({ type, h = 110, rounded = 10, tint = 0 }: { type: string; h?: number; rounded?: number; tint?: number }) {
  const id = useId().replace(/:/g, '')
  const sky = ['#6EC0EE', '#8FCBF0', '#7DB9E8'][tint % 3]
  return (
    <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: h, borderRadius: rounded, display: 'block' }} aria-hidden>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky} /><stop offset="1" stopColor="#F8E7C6" /></linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#D9B77C" /><stop offset="1" stopColor="#B88F55" /></linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6FA8DC" /><stop offset="1" stopColor="#2F5D94" /></linearGradient>
      </defs>
      <rect width="200" height="120" fill={`url(#s${id})`} />
      <circle cx="165" cy="26" r="11" fill="#FFF3C4" opacity=".9" />
      <rect y="102" width="200" height="18" fill="#E7CFA0" />
      {type === 'villa' && (<g>
        <rect x="40" y="58" width="120" height="44" fill={`url(#b${id})`} /><rect x="58" y="42" width="84" height="20" fill="#E2C690" /><rect x="52" y="38" width="96" height="5" fill="#8E6B3C" />
        <Windows x={50} y={66} cols={7} rows={1} w={9} h={14} gx={6} /><Windows x={68} y={46} cols={5} rows={1} w={9} h={9} gx={7} />
        <rect x="30" y="98" width="140" height="7" fill={`url(#g${id})`} opacity=".85" /><Palm x={26} /><Palm x={176} h={52} />
      </g>)}
      {type === 'apartment' && (<g>
        <rect x="52" y="22" width="52" height="82" fill="#C9D6E6" /><rect x="104" y="40" width="46" height="64" fill="#9FB6D3" /><rect x="28" y="56" width="26" height="48" fill="#B4C5DC" />
        <Windows x={57} y={28} cols={4} rows={6} w={7} h={8} gx={5} gy={5} /><Windows x={109} y={46} cols={4} rows={4} w={6} h={8} gx={4} gy={5} fill="#E8F4FC" /><Windows x={32} y={62} cols={2} rows={4} w={7} h={7} gx={4} gy={4} />
        <Palm x={168} h={40} />
      </g>)}
      {type === 'townhouse' && (<g>
        {[0, 1, 2].map((i) => (<g key={i}><rect x={30 + i * 48} y={56} width={46} height={46} fill={['#D9B77C', '#C99F62', '#E2C690'][i]} /><rect x={30 + i * 48} y={50} width={46} height={7} fill="#8E6B3C" /><Windows x={36 + i * 48} y={64} cols={2} rows={2} w={9} h={10} gx={6} gy={5} /></g>))}
        <Palm x={20} h={38} /><Palm x={182} h={44} />
      </g>)}
      {type === 'office' && (<g>
        <rect x="64" y="10" width="46" height="94" fill="#2E4A75" /><rect x="110" y="30" width="38" height="74" fill="#3E5F93" /><rect x="34" y="52" width="30" height="52" fill="#4A6EA6" />
        <Windows x={69} y={16} cols={4} rows={8} w={6} h={6} gx={4} gy={4} fill="#9FD3F5" /><Windows x={115} y={36} cols={3} rows={6} w={6} h={6} gx={5} gy={5} fill="#9FD3F5" /><Windows x={39} y={58} cols={2} rows={4} w={6} h={6} gx={4} gy={5} fill="#9FD3F5" />
      </g>)}
      {type === 'shop' && (<g>
        <rect x="34" y="52" width="132" height="50" fill="#E5D3B4" /><rect x="28" y="46" width="144" height="9" fill="#B8453A" />
        {[0, 1, 2].map((i) => <rect key={i} x={44 + i * 40} y={64} width={30} height={34} rx="2" fill="#BFE3F7" />)}
        <path d="M34 55h132v8H34z" fill="#C85B4F" opacity=".7" /><Palm x={182} h={36} />
      </g>)}
      {type === 'land' && (<g>
        <path d="M0 102 Q60 90 120 98 T200 96 V120 H0Z" fill="#D8BE86" /><rect x="96" y="60" width="2.4" height="42" fill="#6B4A2B" /><path d="M98 60h26l-6 7 6 7H98z" fill="#C9A24B" />
        <Palm x={30} h={42} /><Palm x={172} h={38} />
      </g>)}
    </svg>
  )
}
export function PropImage({ p, h = 110, rounded = 10 }: { p: Pick<Property, 'type' | 'image_url' | 'title'>; h?: number; rounded?: number }) {
  if (p.image_url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.image_url} alt={p.title} style={{ width: '100%', height: h, objectFit: 'cover', borderRadius: rounded }} />
  return <PropArt type={p.type} h={h} rounded={rounded} tint={p.title.length} />
}

// Skyline de Doha (decoratif) : tours en bleu avec fenetres dorees, utilise dans l'en-tete et la sidebar.
const TOWERS: [number, number, number][] = [[0, 34, 14], [16, 52, 12], [30, 40, 16], [48, 70, 10], [60, 46, 14], [76, 84, 12], [90, 58, 18], [110, 92, 9], [121, 62, 15], [138, 76, 12], [152, 50, 16], [170, 68, 11], [183, 44, 14], [199, 58, 12]]
export function Skyline({ height = 90, opacity = 1, style }: { height?: number; opacity?: number; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 215 100" preserveAspectRatio="xMaxYMax slice" style={{ height, width: '100%', opacity, ...style }} aria-hidden>
      <defs><linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5B8FD0" /><stop offset="1" stopColor="#1B3F78" /></linearGradient></defs>
      {TOWERS.map(([x, hh, w], i) => (
        <g key={i}>
          <rect x={x} y={100 - hh} width={w} height={hh} fill={`url(#t${id})`} />
          {Array.from({ length: Math.floor(hh / 9) }).map((_, r) => (r + i) % 3 === 0 ? <rect key={r} x={x + 2} y={100 - hh + 4 + r * 9} width={w - 4} height="2" fill="#F0CC7A" opacity=".85" /> : null)}
        </g>
      ))}
      <rect x="109.5" y="4" width="1.6" height="10" fill="#9DB8E0" />
    </svg>
  )
}
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3D88F" /><stop offset="1" stopColor="#C9A24B" /></linearGradient></defs>
      {[[4, 16, 6], [12, 8, 6], [20, 2, 6], [28, 12, 6]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={38 - y} rx="1" fill="url(#lg)" />)}
      <path d="M2 36 L38 36" stroke="#F3D88F" strokeWidth="2" />
    </svg>
  )
}
