'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Building2, Target, Users, UserSquare2, MessageCircle, Bot, Megaphone, Handshake, BarChart3, UsersRound, Settings,
  Search, Bell, Menu, Moon, Sun, LogOut, FlaskConical,
} from 'lucide-react'
import { ImmoProvider, useImmo } from '@/lib/immo-os/store'
import { supabase } from '@/lib/supabase'
import { Avatar, LogoMark, Skyline } from '@/lib/immo-os/ui'
import { ago } from '@/lib/immo-os/helpers'
import { LANGS, isRtl, type Lang } from '@/lib/immo-os/i18n'

const NAV = [
  { href: '/immo', k: 'dashboard', icon: LayoutDashboard },
  { href: '/immo/properties', k: 'properties', icon: Building2 },
  { href: '/immo/leads', k: 'leads', icon: Target },
  { href: '/immo/clients', k: 'clients', icon: Users },
  { href: '/immo/owners', k: 'owners', icon: UserSquare2 },
  { href: '/immo/whatsapp', k: 'whatsapp', icon: MessageCircle },
  { href: '/immo/assistant', k: 'assistant', icon: Bot },
  { href: '/immo/marketing', k: 'marketing', icon: Megaphone },
  { href: '/immo/deals', k: 'deals', icon: Handshake },
  { href: '/immo/reports', k: 'reports', icon: BarChart3 },
  { href: '/immo/team', k: 'team', icon: UsersRound },
  { href: '/immo/settings', k: 'settings', icon: Settings },
]

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <ImmoProvider>
      <Frame>{children}</Frame>
    </ImmoProvider>
  )
}

function Frame({ children }: { children: ReactNode }) {
  const { mode, dark, toggleDark, me, data, toasts, lang, setLang, t } = useImmo()
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [showN, setShowN] = useState(false)
  const unread = data.messages.filter((m) => m.unread)

  const results = q.trim().length < 2 ? [] : [
    ...data.properties.filter((p) => `${p.title} ${p.area}`.toLowerCase().includes(q.toLowerCase())).slice(0, 4).map((p) => ({ k: `p${p.id}`, label: `${p.title} · ${p.area}`, tag: 'Property', href: '/immo/properties' })),
    ...data.leads.filter((l) => l.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4).map((l) => ({ k: `l${l.id}`, label: l.name, tag: 'Lead', href: '/immo/leads' })),
    ...data.clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3).map((c) => ({ k: `c${c.id}`, label: c.name, tag: 'Client', href: '/immo/clients' })),
    ...data.owners.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3).map((o) => ({ k: `o${o.id}`, label: o.name, tag: 'Owner', href: '/immo/owners' })),
  ]

  return (
    <div className={`imo ${dark ? 'imo-dark' : ''}`} dir={isRtl(lang) ? 'rtl' : 'ltr'} lang={lang}>
      <div className="flex min-h-screen">
        <aside className={`imo-sidebar ${open ? 'open' : ''} w-[236px] shrink-0 flex flex-col`} style={{ background: 'linear-gradient(180deg,#0B2447,#0A1C38)', borderInlineEnd: '1px solid rgba(255,255,255,.06)' }}>
          <div className="px-4 pt-5 pb-4 flex items-center gap-3">
            <LogoMark size={42} />
            <div className="min-w-0">
              <div className="font-bold text-[14px] leading-tight uppercase" style={{ color: '#fff' }}>PiloBrain Real Estate</div>
              <div className="text-[10.5px] tracking-[0.14em]" style={{ color: '#E3C275' }}>AI OPERATING SYSTEM</div>
            </div>
          </div>
          <nav className="px-3 flex-1 flex flex-col gap-0.5 overflow-y-auto imo-scroll">
            {NAV.map((n) => {
              const active = n.href === '/immo' ? path === '/immo' : path.startsWith(n.href)
              const Icon = n.icon
              return (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`imo-nav ${active ? 'active' : ''}`}>
                  <Icon size={18} />
                  {t('nav.' + n.k)}
                  {n.href === '/immo/whatsapp' && unread.length > 0 && (
                    <span className="ml-auto text-[11px] font-bold rounded-full px-1.5" style={{ background: '#22C55E', color: '#fff' }}>{unread.length}</span>
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="px-3 pb-2">
            <Link href="/dashboard?classic=1" className="imo-nav text-[12.5px]"><LogOut size={16} /> {t('back')}</Link>
          </div>
          <div className="relative overflow-hidden" style={{ height: 118 }}>
            <Skyline height={92} opacity={0.9} style={{ position: 'absolute', bottom: 0, left: 0 }} />
            <div className="absolute bottom-2 left-0 right-0 text-center leading-tight">
              <div className="text-[13px] font-bold tracking-[0.18em]" style={{ color: '#E3C275' }}>QATAR</div>
              <div className="text-[9.5px] tracking-[0.16em]" style={{ color: '#C9D6EA' }}>REAL ESTATE SOLUTIONS</div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6 h-[84px] overflow-visible" style={{ background: 'linear-gradient(90deg,#0B2447 0%,#0F2D5C 55%,#14407F 100%)', borderBottom: '2px solid rgba(201,162,75,.55)' }}>
            <div className="absolute inset-y-0 right-0 w-[62%] pointer-events-none overflow-hidden hidden md:block" style={{ maskImage: 'linear-gradient(90deg,transparent,#000 40%)', WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 40%)' }}>
              <Skyline height={84} opacity={0.75} style={{ position: 'absolute', right: 0, bottom: 0 }} />
            </div>
            <button className="lg:hidden relative" style={{ color: '#fff' }} onClick={() => setOpen(!open)} aria-label="Menu"><Menu size={22} /></button>
            <div className="hidden md:block relative leading-tight">
              <div className="text-[18px] font-bold" style={{ color: '#fff' }}>{t('tag1')}</div>
              <div className="text-[18px] font-bold" style={{ color: '#E3C275' }}>{t('tag2')}</div>
            </div>
            <div className="flex-1" />
            <div className="relative w-full max-w-[360px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#66768C' }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} className="w-full rounded-full pl-9 pr-3 h-10 text-[13px] outline-none" style={{ background: '#fff', color: '#0F2540', border: 'none' }} />
              {results.length > 0 && (
                <div className="imo-card absolute left-0 right-0 top-12 overflow-hidden" style={{ zIndex: 60 }}>
                  {results.map((r) => (
                    <button key={r.k} onClick={() => { setQ(''); router.push(r.href) }} className="w-full text-left px-3 py-2 text-[13px] flex items-center justify-between hover:opacity-80" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span>{r.label}</span><span className="t-muted text-[11px]">{r.tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button style={{ color: '#fff' }} onClick={() => setShowN(!showN)} aria-label="Notifications" className="relative">
                <Bell size={20} />
                {unread.length > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center" style={{ background: '#EF4444', color: '#fff' }}>{unread.length}</span>}
              </button>
              {showN && (
                <div className="imo-card absolute right-0 top-9 w-[300px]" style={{ zIndex: 60 }}>
                  <div className="px-3 py-2 font-semibold text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>{t('unread')}</div>
                  {unread.length === 0 && <div className="p-3 text-[13px] t-muted">{t('caughtup')}</div>}
                  {unread.slice(0, 5).map((m) => (
                    <Link key={m.id} href="/immo/whatsapp" onClick={() => setShowN(false)} className="block px-3 py-2 text-[13px]" style={{ borderBottom: '1px solid var(--border)' }}>
                      <div className="font-semibold">{m.contact_name}</div>
                      <div className="t-muted truncate">{m.body}</div>
                      <div className="text-[11px] t-muted">{ago(m.created_at)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <select aria-label={t('lang')} value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-md text-[12px] font-semibold px-1.5 h-8" style={{ background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}>
              {LANGS.map((l) => <option key={l.v} value={l.v} style={{ color: '#0F2540' }}>{l.label}</option>)}
            </select>
            <button style={{ color: '#fff' }} onClick={toggleDark} aria-label="Toggle theme">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            {me && (
              <div className="hidden sm:flex items-center gap-2">
                <Avatar name={me.name} size={34} src={me.photo} />
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold" style={{ color: '#fff' }}>{me.name}</div>
                  <div className="text-[11px]" style={{ color: '#A9BAD3' }}>{me.role}</div>
                </div>
              </div>
            )}
          </header>

          {mode === 'demo' && (
            <div className="px-6 py-2 text-[12.5px] flex items-center gap-2" style={{ background: '#FEF3C7', color: '#92400E' }}>
              <FlaskConical size={14} /> {t('demo')}
            </div>
          )}
          <main className="p-4 sm:p-6 flex-1">
            {mode === 'loading' ? <div className="t-muted text-sm">{t('loading')}</div> : children}
          </main>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-xl px-4 py-2.5 text-[13px] font-medium shadow-lg" style={{ background: t.kind === 'ok' ? '#0B2447' : '#B91C1C', color: '#fff', maxWidth: 340 }}>{t.msg}</div>
        ))}
      </div>
    </div>
  )
}
