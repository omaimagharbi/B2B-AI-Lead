'use client'

import { useRouter } from 'next/navigation'
import { Settings, Moon, Database, RefreshCw, Sparkles, LogOut, Webhook, Link2, Copy } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, PageHead } from '@/lib/immo-os/ui'
import { supabase } from '@/lib/supabase'
import { confirmDelete } from '@/lib/immo-os/hooks'

export default function SettingsPage() {
  const { mode, agency, clientId, me, dark, toggleDark, resetDemo, seedLive, liveEmpty, notify } = useImmo()
  const router = useRouter()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const formUrl = clientId ? `${origin}/lead?a=${clientId}` : ''
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); notify('Copied') } catch { notify('Copy failed', 'err') } }
  return (
    <div>
      <PageHead icon={<Settings size={28} />} title="Settings" sub={`${agency}${me ? ` · ${me.name}` : ''}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Moon size={17} />} title="Appearance" />
          <div className="flex items-center justify-between text-[13px]"><span>Dark mode</span><Btn onClick={toggleDark}>{dark ? 'Switch to light' : 'Switch to dark'}</Btn></div>
        </Card>
        <Card>
          <CardTitle icon={<Database size={17} />} title="Data" right={<Badge color={mode === 'live' ? '#16A34A' : '#F59E0B'}>{mode === 'live' ? 'Live database' : 'Demo mode'}</Badge>} />
          {mode === 'demo' ? (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">Sample data is stored in this browser only. To save real data, run <b>70_immobilier_os.sql</b> in the Supabase SQL editor, then reload this page.</div>
              <div><Btn onClick={() => confirmDelete('all demo changes') && resetDemo()}><RefreshCw size={14} /> Reset demo data</Btn></div>
            </div>
          ) : (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">Connected to your Supabase database. Every record belongs to your agency only.</div>
              {liveEmpty && <div><Btn kind="gold" onClick={seedLive}><Sparkles size={14} /> Load sample Qatar data</Btn></div>}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle icon={<Webhook size={17} />} title="Integrations" />
          <div className="text-[13px] flex flex-col gap-2 t-muted">
            <div><b className="t-main">AI:</b> uses GEMINI_API_KEY first, then ANTHROPIC_API_KEY. Without a key, standard templates are used.</div>
            <div><b className="t-main">WhatsApp sending:</b> uses your GREENAPI_ID_INSTANCE / GREENAPI_API_TOKEN.</div>
            <div><b className="t-main">WhatsApp receiving:</b> uses your existing GreenAPI webhook <code>/api/webhook/whatsapp?secret=…</code>. Known leads, clients and owners are matched by phone number; messages from unknown numbers create a new lead for the agency set in <code>WHATSAPP_IMMO_CLIENT_ID</code>. Run migration 71 to avoid duplicate messages.</div>
            {clientId && <div><b className="t-main">Your agency ID</b> (value for WHATSAPP_IMMO_CLIENT_ID): <code style={{ userSelect: 'all' }}>{clientId}</code></div>}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardTitle icon={<Link2 size={17} />} title="Lead capture form" />
          {formUrl ? (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">Share this public link (WhatsApp status, Instagram bio, ads, your website). Every request becomes a lead in PiloBrain Real Estate and your director gets a WhatsApp alert. Add <code>&amp;lang=ar</code> or <code>&amp;lang=fr</code> for another language, and <code>&amp;property=ID</code> to link a listing (or use the "Link" button on a property).</div>
              <div className="flex gap-2 items-center flex-wrap"><code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{formUrl}</code><Btn onClick={() => copy(formUrl)}><Copy size={13} /> Copy link</Btn></div>
              <div className="t-muted">To embed it in your own website:</div>
              <div className="flex gap-2 items-start flex-wrap"><code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{`<iframe src="${formUrl}" width="100%" height="720" style="border:0"></iframe>`}</code><Btn onClick={() => copy(`<iframe src="${formUrl}" width="100%" height="720" style="border:0"></iframe>`)}><Copy size={13} /> Copy code</Btn></div>
              {mode === 'demo' && <div style={{ color: '#92400E' }}>Demo mode: the form only saves requests once migration 70 has been run.</div>}
            </div>
          ) : <div className="text-[13px] t-muted">Loading…</div>}
        </Card>
        <Card>
          <CardTitle icon={<LogOut size={17} />} title="Session" />
          <div className="flex gap-2"><Btn onClick={() => router.push('/dashboard')}>Back to PiloBrain</Btn><Btn kind="danger" onClick={async () => { await supabase.auth.signOut(); router.replace('/auth') }}>Sign out</Btn></div>
        </Card>
      </div>
    </div>
  )
}
