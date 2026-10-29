'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EMPTY_DATA, ENTITY_KEYS, AGENTS_DEFAULT, type Data, type Entity } from './types'
import { makeDemo } from './demo'
import { uid } from './helpers'
import { resizeImage } from './resize'
import { isManager } from './permissions'
import { translate, type Lang } from './i18n'

type Member = { id: string; name: string; role: string; photo: string | null; phone: string | null }
type Mode = 'loading' | 'live' | 'demo'
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
type AiMode = 'chat' | 'market' | 'ad' | 'reply' | 'report'

type Ctx = {
  mode: Mode
  data: Data
  agency: string
  clientId: string | null
  canDelete: boolean
  aiUsage: { used: number; limit: number } | null
  logo: string | null
  me: { id: string; name: string; role: string; photo: string | null } | null
  team: Member[]
  agents: string[]
  liveEmpty: boolean
  dark: boolean
  toggleDark: () => void
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  create: <T = any>(e: Entity, row: Record<string, unknown>) => Promise<T | null>
  update: (e: Entity, id: string, patch: Record<string, unknown>) => Promise<void>
  remove: (e: Entity, id: string) => Promise<void>
  seedLive: () => Promise<void>
  resetDemo: () => void
  sendWhatsapp: (name: string, phone: string | null | undefined, body: string) => Promise<void>
  ai: (mode: AiMode, prompt: string, opts?: { extra?: string; language?: string; context: string }) => Promise<string | null>
  uploadPhoto: (file: File) => Promise<string | null>
  callApi: (path: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: any }>
  reload: () => Promise<void>
  notify: (msg: string, kind?: 'ok' | 'err') => void
  toasts: Toast[]
}

const C = createContext<Ctx | null>(null)
export const useImmo = () => {
  const c = useContext(C)
  if (!c) throw new Error('useImmo outside provider')
  return c
}

const DEMO_KEY = 'imo_demo_v1'
const THEME_KEY = 'imo_theme'

export function ImmoProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [data, setData] = useState<Data>(EMPTY_DATA)
  const [agency, setAgency] = useState('My Agency')
  const [logo, setLogo] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null)
  const [me, setMe] = useState<Ctx['me']>(null)
  const [team, setTeam] = useState<Member[]>([])
  const [dark, setDark] = useState(false)
  const [lang, setLangState] = useState<Lang>('en')
  const [toasts, setToasts] = useState<Toast[]>([])
  const tokenRef = useRef<string>('')

  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const { data: s } = await supabase.auth.getSession()
    tokenRef.current = s.session?.access_token ?? ''
    const res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}`, ...(init?.headers ?? {}) },
    })
    const json = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, json }
  }, [])

  const persistDemo = (d: Data) => {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(d))
    } catch {}
  }

  // Chargement initial : session -> profil -> donnees (base reelle ou mode demo si migration 70 absente)
  useEffect(() => {
    try {
      setDark(localStorage.getItem(THEME_KEY) === 'dark')
      const l = localStorage.getItem('imo_lang')
      if (l === 'ar' || l === 'fr' || l === 'en') setLangState(l)
    } catch {}
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      if (!s.session) {
        router.replace('/auth')
        return
      }
      const meRes = await api('/api/immo?r=me')
      if (!meRes.ok) {
        notify(meRes.json?.error ?? 'Could not load your agency', 'err')
        setMode('demo')
        setData(makeDemo())
        return
      }
      setAgency(meRes.json.agency)
      setClientId(meRes.json.clientId ?? null)
      if (meRes.json.ai) setAiUsage(meRes.json.ai)
      setLogo(meRes.json.logo)
      setMe(meRes.json.me)
      setTeam(meRes.json.team)

      const all = await api('/api/immo?r=all')
      if (all.ok && all.json.demo === false) {
        setData({ ...EMPTY_DATA, ...all.json.data })
        setMode('live')
        return
      }
      // Mode demo : donnees locales au navigateur uniquement
      let d: Data | null = null
      try {
        const raw = localStorage.getItem(DEMO_KEY)
        if (raw) d = JSON.parse(raw)
      } catch {}
      if (!d) {
        d = makeDemo()
        persistDemo(d)
      }
      setData(d)
      setMode('demo')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode reel : les messages WhatsApp recus et les leads crees par le webhook apparaissent sans recharger la page.
  useEffect(() => {
    if (mode !== 'live') return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const all = await api('/api/immo?r=all')
      if (all.ok && all.json.data) setData((d) => ({ ...d, messages: all.json.data.messages ?? d.messages, leads: all.json.data.leads ?? d.leads }))
    }, 30000)
    return () => clearInterval(id)
  }, [mode, api])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('imo_lang', l) } catch {}
  }
  const t = (key: string) => translate(lang, key)

  const toggleDark = () => {
    const n = !dark
    setDark(n)
    try {
      localStorage.setItem(THEME_KEY, n ? 'dark' : 'light')
    } catch {}
  }

  const create: Ctx['create'] = async (e, row) => {
    if (mode === 'demo') {
      const r = { id: uid(), created_at: new Date().toISOString(), ...row } as any
      setData((d) => {
        const n = { ...d, [e]: [r, ...(d[e] as any[])] } as Data
        persistDemo(n)
        return n
      })
      return r
    }
    const res = await api(`/api/immo?r=${e}`, { method: 'POST', body: JSON.stringify(row) })
    if (!res.ok) {
      notify(res.json?.error ?? 'Could not save', 'err')
      return null
    }
    setData((d) => ({ ...d, [e]: [res.json.row, ...(d[e] as any[])] }) as Data)
    return res.json.row
  }

  const update: Ctx['update'] = async (e, id, patch) => {
    const before = data
    setData((d) => {
      const n = { ...d, [e]: (d[e] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Data
      if (mode === 'demo') persistDemo(n)
      return n
    })
    if (mode === 'demo') return
    const res = await api(`/api/immo?r=${e}`, { method: 'PATCH', body: JSON.stringify({ id, ...patch }) })
    if (!res.ok) {
      setData(before)
      notify(res.json?.error ?? 'Update failed', 'err')
    }
  }

  const remove: Ctx['remove'] = async (e, id) => {
    if (!isManager(me?.role)) return notify('Only managers can delete records', 'err')
    const before = data
    setData((d) => {
      const n = { ...d, [e]: (d[e] as any[]).filter((x) => x.id !== id) } as Data
      if (mode === 'demo') persistDemo(n)
      return n
    })
    if (mode === 'demo') return
    const res = await api(`/api/immo?r=${e}&id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setData(before)
      notify(res.json?.error ?? 'Delete failed', 'err')
    }
  }

  const seedLive = async () => {
    const demo = makeDemo()
    const res = await api('/api/immo?r=seed', { method: 'POST', body: JSON.stringify(demo) })
    if (!res.ok) return notify(res.json?.error ?? 'Seeding failed', 'err')
    const all = await api('/api/immo?r=all')
    if (all.ok && all.json.data) setData({ ...EMPTY_DATA, ...all.json.data })
    notify('Sample data loaded')
  }

  const resetDemo = () => {
    const d = makeDemo()
    persistDemo(d)
    setData(d)
    notify('Demo data reset')
  }

  const sendWhatsapp: Ctx['sendWhatsapp'] = async (name, phone, body) => {
    if (mode === 'demo') {
      await create('messages', { contact_name: name, contact_phone: phone ?? null, direction: 'out', body, unread: false })
      notify('Saved (demo mode - nothing was actually sent)')
      return
    }
    const res = await api('/api/immo?r=whatsapp', { method: 'POST', body: JSON.stringify({ name, phone, body }) })
    if (!res.ok) return notify(res.json?.error ?? 'Could not send', 'err')
    setData((d) => ({ ...d, messages: [res.json.row, ...d.messages] }))
    if (res.json.sent) notify('Message sent on WhatsApp')
    else notify(`Saved but not sent: ${res.json.warning ?? 'WhatsApp not configured'}`, 'err')
  }

  const uploadPhoto: Ctx['uploadPhoto'] = async (file) => {
    if (mode === 'demo') {
      notify('Photo upload needs the live database (run migration 72). Paste an image URL instead.', 'err')
      return null
    }
    try {
      const blob = await resizeImage(file)
      const fd = new FormData()
      fd.append('file', blob, 'photo.jpg')
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch('/api/immo?r=upload', { method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` }, body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { notify(json.error ?? 'Upload failed', 'err'); return null }
      return json.url as string
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Upload failed', 'err')
      return null
    }
  }

  const reload = async () => {
    if (mode !== 'live') return
    const all = await api('/api/immo?r=all')
    if (all.ok && all.json.data) setData({ ...EMPTY_DATA, ...all.json.data })
  }

  const ai: Ctx['ai'] = async (m, prompt, opts) => {
    const res = await api('/api/immo?r=assistant', {
      method: 'POST',
      body: JSON.stringify({ mode: m, prompt, context: opts?.context ?? '', extra: opts?.extra, language: opts?.language ?? lang }),
    })
    if (!res.ok) {
      notify(res.json?.error ?? 'AI request failed', 'err')
      return null
    }
    return (res.json.reply as string | null) ?? null
  }

  const agents = useMemo(() => {
    const set = new Set<string>()
    if (mode === 'demo') AGENTS_DEFAULT.forEach((a) => set.add(a))
    team.forEach((t) => set.add(t.name))
    ;[...data.leads, ...data.deals, ...data.clients].forEach((x: any) => x.agent && set.add(x.agent))
    return Array.from(set)
  }, [mode, team, data])

  const liveEmpty = mode === 'live' && data.properties.length === 0 && data.leads.length === 0 && ENTITY_KEYS.every((k) => data[k].length === 0)

  return (
    <C.Provider
      value={{ mode, data, agency, clientId, canDelete: isManager(me?.role), aiUsage, logo, me, team, agents, liveEmpty, dark, toggleDark, lang, setLang, t, create, update, remove, seedLive, resetDemo, sendWhatsapp, ai, uploadPhoto, callApi: api, reload, notify, toasts }}
    >
      {children}
    </C.Provider>
  )
}
