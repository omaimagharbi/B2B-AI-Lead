'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EMPTY_DATA, ENTITY_KEYS, AGENTS_DEFAULT, type Data, type Entity, type Activity, type Assignment } from './types'
import { demoLog, demoAssign, changedFields, SCOPED_ENTITIES, type DemoActor } from './demo-journal'
import { demoDealTransition, demoStage } from './demo-flow'
import { sameNumber } from './inbound-pure'
import { CHARTER_VERSION } from './policy'
import { makeDemo } from './demo'
import { uid } from './helpers'
import { resizeImage } from './resize'
import { isManager } from './permissions'
import { translate, fmt, type Lang } from './i18n'

export type Member = { id: string; name: string; role: string; photo: string | null; phone: string | null; hidden?: string[]; tabs?: string[] }
type Mode = 'loading' | 'live' | 'demo'
type Toast = { id: number; msg: string; kind: 'ok' | 'err' }
type AiMode = 'chat' | 'market' | 'ad' | 'reply' | 'report' | 'orphans'

type Ctx = {
  mode: Mode
  data: Data
  agency: string
  clientId: string | null
  canDelete: boolean
  aiUsage: { used: number; limit: number } | null
  aiModel: { provider: 'gemini' | 'anthropic' | 'none'; model: string | null } | null
  logo: string | null
  me: { id: string; name: string; role: string; photo: string | null; hidden?: string[] } | null
  team: Member[]
  activeAgents: string[] // noms des membres actuels de l'equipe (cibles possibles d'une affectation)
  reassignLeads: (from: string, to: string, scope?: 'active' | 'all', reason?: 'bulk' | 'agent_removed') => Promise<number | null>
  inviteMember: (email: string, fullName: string, role: 'membre' | 'directeur_commercial') => Promise<{ password: string; emailSent: boolean } | null>
  removeMember: (id: string) => Promise<boolean>
  setMemberMenus: (id: string, hidden: string[]) => Promise<void>
  loadActivity: (opts?: { actor?: string; entity?: string }) => Promise<Activity[] | null>
  lastActivity: () => Promise<Record<string, string>>
  loadAssignments: (leadId: string) => Promise<Assignment[]>
  agents: string[]
  liveEmpty: boolean
  dark: boolean
  toggleDark: () => void
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  tf: (key: string, vars: Record<string, string | number>) => string
  create: <T = any>(e: Entity, row: Record<string, unknown>) => Promise<T | null>
  update: (e: Entity, id: string, patch: Record<string, unknown>) => Promise<void>
  remove: (e: Entity, id: string) => Promise<void>
  seedLive: () => Promise<void>
  resetDemo: () => void
  sendWhatsapp: (name: string, phone: string | null | undefined, body: string, opts?: { propertyId?: string; lang?: Lang; template?: { name: string; language: string; params: string[] }; media?: { url: string; type: 'image' | 'document'; name: string }[] }) => Promise<boolean>
  charter: { version: string; accepted: boolean | null }
  acceptCharter: () => Promise<boolean>
  ai: (mode: AiMode, prompt: string, opts?: { extra?: string; language?: string; context: string }) => Promise<string | null>
  uploadPhoto: (file: File) => Promise<string | null>
  uploadChatFile: (file: File) => Promise<{ url: string; type: 'image' | 'document'; name: string } | null>
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

const DEMO_KEY = 'imo_demo_v2' // v2 : zones, photos multiples, regime de propriete (les anciennes donnees de demo v1 sont ignorees)
const THEME_KEY = 'imo_theme'

export function ImmoProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('loading')
  const [data, setData] = useState<Data>(EMPTY_DATA)
  const [agency, setAgency] = useState('My Agency')
  const [logo, setLogo] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [aiUsage, setAiUsage] = useState<{ used: number; limit: number } | null>(null)
  const [aiModel, setAiModel] = useState<Ctx['aiModel']>(null)
  const [me, setMe] = useState<Ctx['me']>(null)
  const [team, setTeam] = useState<Member[]>([])
  const [dark, setDark] = useState(false)
  const [lang, setLangState] = useState<Lang>('en')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [charter, setCharter] = useState<{ version: string; accepted: boolean | null }>({ version: CHARTER_VERSION, accepted: null })
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
      if (meRes.json.aiModel) setAiModel(meRes.json.aiModel)
      setLogo(meRes.json.logo)
      setMe(meRes.json.me)
      setTeam(meRes.json.team)
      if (meRes.json.charter) setCharter(meRes.json.charter)

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
        if (raw) d = { ...EMPTY_DATA, ...JSON.parse(raw) }
      } catch {}
      if (!d) {
        d = makeDemo()
        persistDemo(d)
      }
      const dt = (d as any).demoTeam as Member[] | undefined
      const roster = dt ?? AGENTS_DEFAULT.map((n, i) => ({ id: `demo-m${i}`, name: n, role: i === 0 ? 'directeur_commercial' : 'membre', photo: null, phone: null }))
      setTeam(roster)
      setMe({ id: roster[0].id, name: roster[0].name, role: 'directeur_commercial', photo: null, hidden: [] })
      setData(d)
      setMode('demo')
      try { setCharter({ version: CHARTER_VERSION, accepted: localStorage.getItem('imo_charter') === CHARTER_VERSION }) } catch { setCharter({ version: CHARTER_VERSION, accepted: true }) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mode reel : les messages WhatsApp recus et les leads crees par le webhook apparaissent sans recharger la page.
  useEffect(() => {
    if (mode !== 'live') return
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const all = await api('/api/immo?r=all')
      if (all.ok && all.json.data) setData((d) => ({ ...d, messages: all.json.data.messages ?? d.messages, leads: all.json.data.leads ?? d.leads, outcomes: all.json.data.outcomes ?? d.outcomes, sends: all.json.data.sends ?? d.sends }))
    }, 30000)
    return () => clearInterval(id)
  }, [mode, api])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('imo_lang', l) } catch {}
  }
  const t = (key: string) => translate(lang, key)
  const tf = (key: string, vars: Record<string, string | number>) => fmt(translate(lang, key), vars)

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
        let n = { ...d, [e]: [r, ...(d[e] as any[])] } as Data
        n = demoLog(n, demoWho(), { action: 'create', entity: e, record: r })
        if (e === 'leads') { n = demoAssign(n, demoWho(), { lead: r, from: null, to: r.agent, reason: 'creation' }); n = demoStage(n, 'lead', r, null, r.status ?? 'new', demoWho().name) }
        if (e === 'deals') n = demoDealTransition(n, r, null, demoWho().name, t)
        if (e === 'outcomes') r.agent = demoWho().name
        return persist(n)
      })
      return r
    }
    const res = await api(`/api/immo?r=${e}`, { method: 'POST', body: JSON.stringify(row) })
    if (!res.ok) {
      notify(res.json?.error ?? 'Could not save', 'err')
      return null
    }
    setData((d) => ({ ...d, [e]: [res.json.row, ...(d[e] as any[])] }) as Data)
    if (res.json.dropped?.length) notify(t('warn.mig74'), 'err')
    return res.json.row
  }

  const update: Ctx['update'] = async (e, id, patch) => {
    const before = data
    setData((d) => {
      let n = { ...d, [e]: (d[e] as any[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) } as Data
      if (mode === 'demo') {
        const old = (d[e] as any[]).find((x) => x.id === id)
        const changed = changedFields(old, patch)
        if (changed.length) {
          const reassigned = changed.includes('agent') && SCOPED_ENTITIES.includes(e)
          n = demoLog(n, demoWho(), { action: reassigned && changed.length === 1 ? 'assign' : 'update', entity: e, record: { ...old, ...patch }, details: { fields: changed, ...(reassigned ? { from: old?.agent ?? null, to: (patch as any).agent ?? null } : {}) } })
          if (e === 'leads' && changed.includes('agent')) n = demoAssign(n, demoWho(), { lead: { ...old, ...patch }, from: old?.agent, to: (patch as any).agent, reason: 'manual' })
        }
        // Lot 4 : etapes (memes regles que le serveur) ; Lot 5 : "ne plus contacter" manuel
        if (e === 'leads' && 'status' in patch && old && old.status !== (patch as any).status) n = demoStage(n, 'lead', { ...old, ...patch }, old.status, (patch as any).status, demoWho().name)
        if (e === 'deals' && 'status' in patch && old && old.status !== (patch as any).status) n = demoDealTransition(n, { ...old, ...patch }, old.status, demoWho().name, t)
        if (old && 'do_not_contact' in patch && !!old.do_not_contact !== !!(patch as any).do_not_contact) {
          const on = !!(patch as any).do_not_contact
          n = { ...n, [e]: (n[e] as any[]).map((x) => (x.id === id ? { ...x, do_not_contact_at: on ? new Date().toISOString() : null, do_not_contact_reason: on ? 'manual' : null, ...(on ? {} : { consent_at: new Date().toISOString(), consent_source: 'manual' }) } : x)) } as Data
        }
        persistDemo(n)
      }
      return n
    })
    if (mode === 'demo') return
    const res = await api(`/api/immo?r=${e}`, { method: 'PATCH', body: JSON.stringify({ id, ...patch }) })
    if (!res.ok) {
      setData(before)
      notify(res.json?.error ?? 'Update failed', 'err')
    } else if (res.json.dropped?.length) notify(t('warn.mig74'), 'err')
    else if ((e === 'deals' || e === 'leads') && 'status' in patch) await reload() // etapes, taches et statut du bien sont mis a jour cote serveur
  }

  const remove: Ctx['remove'] = async (e, id) => {
    if (!isManager(me?.role)) return notify('Only managers can delete records', 'err')
    const before = data
    setData((d) => {
      let n = { ...d, [e]: (d[e] as any[]).filter((x) => x.id !== id) } as Data
      if (mode === 'demo') n = persist(demoLog(n, demoWho(), { action: 'delete', entity: e, record: (d[e] as any[]).find((x) => x.id === id) }))
      return n
    })
    if (mode === 'demo') return
    const res = await api(`/api/immo?r=${e}&id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setData(before)
      notify(res.json?.error ?? 'Delete failed', 'err')
    }
  }

  // ---- Lot 2 : equipe, affectation, journal (reel = routes existantes + /api/immo ; demo = simulation locale) ----
  const reassignLeads: Ctx['reassignLeads'] = async (from, to, scope = 'active', reason = 'bulk') => {
    const isActive = (st: string) => !['won', 'lost'].includes(st)
    if (mode === 'demo') {
      let count = 0
      setData((d) => {
        const known = new Set(team.map((m) => m.name.toLowerCase()))
        const hit = d.leads.filter((l) => (scope === 'all' || isActive(l.status)) && (from === '__orphans' ? !l.agent || !known.has(l.agent.toLowerCase()) : l.agent === from))
        count = hit.length
        let n: Data = { ...d, leads: d.leads.map((l) => (hit.some((h) => h.id === l.id) ? { ...l, agent: to } : l)) }
        hit.forEach((l) => { n = demoAssign(n, demoWho(), { lead: l, from: l.agent, to, reason }) })
        n = demoLog(n, demoWho(), { action: 'reassign_bulk', entity: 'leads', label: `${from === '__orphans' ? '-' : from} > ${to}`, details: { count: hit.length, from: from === '__orphans' ? null : from, to, reason } })
        return persist(n)
      })
      return count
    }
    const res = await api('/api/immo?r=leads/reassign', { method: 'POST', body: JSON.stringify({ from, to, scope, reason }) })
    if (!res.ok) { notify(res.json?.error ?? 'Reassignment failed', 'err'); return null }
    await reload()
    return res.json.count as number
  }

  const inviteMember: Ctx['inviteMember'] = async (email, fullName, role) => {
    if (mode === 'demo') {
      const m: Member = { id: `demo-${uid()}`, name: fullName || email, role, photo: null, phone: null }
      setTeam((tm) => { const nt = [...tm, m]; setData((d) => persist(demoLog({ ...d, demoTeam: nt } as Data, demoWho(), { action: 'team_invite', entity: 'team', label: m.name, details: { role } }))); return nt })
      return { password: 'Demo-1234', emailSent: false }
    }
    const res = await api('/api/team/invite', { method: 'POST', body: JSON.stringify({ email, nom_complet: fullName, role }) })
    if (!res.ok) { notify(res.json?.error ?? 'Invitation failed', 'err'); return null }
    await reload()
    return { password: res.json.motDePasseTemporaire as string, emailSent: !!res.json.emailEnvoye }
  }

  const removeMember: Ctx['removeMember'] = async (id) => {
    if (mode === 'demo') {
      const m = team.find((x) => x.id === id)
      setTeam((tm) => { const nt = tm.filter((x) => x.id !== id); setData((d) => persist(demoLog({ ...d, demoTeam: nt, hierarchy: d.hierarchy.filter((h) => h.member_id !== id && h.reports_to !== id) } as Data, demoWho(), { action: 'team_remove', entity: 'team', label: m?.name ?? '' }))); return nt })
      return true
    }
    const res = await api('/api/team/remove', { method: 'POST', body: JSON.stringify({ client_user_id: id }) })
    if (!res.ok) { notify(res.json?.error ?? 'Removal failed', 'err'); return false }
    await reload()
    return true
  }

  // Droits : menus /immo masques pour un membre (entrees "immo:<menu>" dans onglets_masques ; les autres entrees sont conservees)
  const setMemberMenus: Ctx['setMemberMenus'] = async (id, hidden) => {
    if (mode === 'demo') {
      setTeam((tm) => tm.map((m) => (m.id === id ? { ...m, hidden } : m)))
      return
    }
    const m = team.find((x) => x.id === id)
    const others = (m?.tabs ?? []).filter((x) => !x.startsWith('immo:'))
    const res = await api('/api/team/modifier', { method: 'PATCH', body: JSON.stringify({ id, onglets_masques: [...others, ...hidden.map((h) => `immo:${h}`)] }) })
    if (!res.ok) return notify(res.json?.error ?? 'Update failed', 'err')
    setTeam((tm) => tm.map((x) => (x.id === id ? { ...x, hidden, tabs: [...others, ...hidden.map((h) => `immo:${h}`)] } : x)))
  }

  const loadActivity: Ctx['loadActivity'] = async (opts) => {
    if (mode === 'demo') return (data.activity ?? []).filter((a) => (!opts?.actor || a.actor_name === opts.actor) && (!opts?.entity || a.entity === opts.entity))
    const q = new URLSearchParams({ r: 'activity', limit: '150' })
    if (opts?.actor) q.set('actor', opts.actor)
    if (opts?.entity) q.set('entity', opts.entity)
    const res = await api(`/api/immo?${q}`)
    return res.ok ? (res.json.rows as Activity[]) : null
  }
  const lastActivity: Ctx['lastActivity'] = async () => {
    if (mode === 'demo') { const o: Record<string, string> = {}; for (const a of data.activity ?? []) if (!o[a.actor_name]) o[a.actor_name] = a.created_at; return o }
    const res = await api('/api/immo?r=activity&summary=1')
    return res.ok ? (res.json.last as Record<string, string>) : {}
  }
  const loadAssignments: Ctx['loadAssignments'] = async (leadId) => {
    if (mode === 'demo') return (data.assignments ?? []).filter((a) => a.lead_id === leadId)
    const res = await api(`/api/immo?r=assignments&lead_id=${leadId}`)
    return res.ok ? (res.json.rows as Assignment[]) : []
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

  const sendWhatsapp: Ctx['sendWhatsapp'] = async (name, phone, body, opts) => {
    if (mode === 'demo') {
      // Lot 5 : meme garde-fou que le serveur (contact "ne plus contacter")
      if (phone && [...data.leads, ...data.clients, ...data.owners].some((c: any) => c.do_not_contact && sameNumber(c.phone, phone))) { notify(t('dnc.blocked'), 'err'); return false }
      const m = await create('messages', { contact_name: name, contact_phone: phone ?? null, direction: 'out', body: body || (opts?.media?.length ? `[${opts.media[0].type}]` : ''), unread: false, ...(opts?.propertyId ? { property_id: opts.propertyId, property_auto: false } : {}), ...(opts?.media?.[0] ? { media_url: opts.media[0].url, media_type: opts.media[0].type, media_name: opts.media[0].name } : {}) })
      if (opts?.propertyId) { const p = data.properties.find((x) => x.id === opts.propertyId); setData((d) => persist({ ...d, sends: [{ id: uid(), property_id: opts.propertyId!, property_title: p?.title ?? '', contact_name: name, contact_phone: phone ?? null, agent: me?.name ?? '', channel: 'whatsapp', created_at: new Date().toISOString() }, ...(d.sends ?? [])] })) }
      notify('Saved (demo mode - nothing was actually sent)')
      return !!m
    }
    const res = await api('/api/immo?r=whatsapp', { method: 'POST', body: JSON.stringify({ name, phone, body, property_id: opts?.propertyId, lang: opts?.lang ?? lang, template: opts?.template, media: opts?.media }) })
    if (!res.ok) { notify(res.json?.code === 'opted_out' ? t('dnc.blocked') : res.json?.code === 'window_closed' ? t('wa.window.closed') : res.json?.error ?? 'Could not send', 'err'); return false }
    setData((d) => ({ ...d, messages: [...((res.json.rows as any[]) ?? [res.json.row]).slice().reverse(), ...d.messages], sends: res.json.send ? [res.json.send, ...(d.sends ?? [])] : d.sends }))
    if (res.json.sent) notify(res.json.warning ? t('wa.fallback') : 'Message sent on WhatsApp')
    else notify(`Saved but not sent: ${res.json.warning ?? 'WhatsApp not configured'}`, 'err')
    return !!res.json.sent
  }

  const acceptCharter: Ctx['acceptCharter'] = async () => {
    if (mode === 'demo') { try { localStorage.setItem('imo_charter', CHARTER_VERSION) } catch {}; setCharter((c) => ({ ...c, accepted: true })); return true }
    const res = await api('/api/immo?r=charter', { method: 'POST', body: JSON.stringify({ lang }) })
    if (!res.ok) { notify(res.json?.error ?? 'Could not save', 'err'); return false }
    setCharter((c) => ({ ...c, accepted: true }))
    return true
  }

  // Lot 6b : fichier de conversation (image reduite ou PDF) -> stockage de l'agence
  const uploadChatFile: Ctx['uploadChatFile'] = async (file) => {
    if (mode === 'demo') { notify(t('att.demo'), 'err'); return null }
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const blob = isPdf ? file : await resizeImage(file)
      if (blob.size > 4 * 1024 * 1024) { notify(t('att.big'), 'err'); return null }
      const fd = new FormData()
      fd.append('file', blob, isPdf ? file.name : 'photo.jpg')
      const { data: s } = await supabase.auth.getSession()
      const res = await fetch('/api/immo?r=upload&kind=chat', { method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token ?? ''}` }, body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { notify(json.error ?? 'Upload failed', 'err'); return null }
      return { url: json.url, type: json.type === 'document' ? 'document' : 'image', name: json.name ?? file.name }
    } catch (e) { notify(e instanceof Error ? e.message : 'Upload failed', 'err'); return null }
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
    team.forEach((t) => set.add(t.name))
    ;[...data.leads, ...data.deals, ...data.clients].forEach((x: any) => x.agent && set.add(x.agent))
    return Array.from(set)
  }, [mode, team, data])

  const activeAgents = useMemo(() => team.map((m) => m.name).filter(Boolean), [team])
  const demoWho = (): DemoActor => ({ id: me?.id ?? 'demo', name: me?.name ?? 'Demo', role: me?.role ?? 'directeur_commercial' })
  const persist = (n: Data) => { persistDemo(n); return n }

  const liveEmpty = mode === 'live' && data.properties.length === 0 && data.leads.length === 0 && ENTITY_KEYS.every((k) => data[k].length === 0)

  return (
    <C.Provider
      value={{ mode, data, agency, clientId, canDelete: isManager(me?.role), aiUsage, aiModel, logo, me, team, agents, liveEmpty, dark, toggleDark, lang, setLang, t, tf, activeAgents, charter, acceptCharter, reassignLeads, inviteMember, removeMember, setMemberMenus, loadActivity, lastActivity, loadAssignments, create, update, remove, seedLive, resetDemo, sendWhatsapp, ai, uploadPhoto, uploadChatFile, callApi: api, reload, notify, toasts }}
    >
      {children}
    </C.Provider>
  )
}
