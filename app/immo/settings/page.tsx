'use client'

import { useRouter } from 'next/navigation'
import { Settings, Moon, Database, RefreshCw, Sparkles, LogOut, Webhook, Link2, Copy } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, PageHead } from '@/lib/immo-os/ui'
import { supabase } from '@/lib/supabase'
import { confirmDelete } from '@/lib/immo-os/hooks'
import ZonesCard from './zones-card'
import ComplianceCard from './compliance-card'
import MetaCard from './meta-card'
import PaymentCard from './payment-card'

export default function SettingsPage() {
  const { mode, agency, clientId, aiUsage, aiModel, t, tf, me, dark, toggleDark, resetDemo, seedLive, liveEmpty, notify } = useImmo()
  const router = useRouter()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const formUrl = clientId ? `${origin}/lead?a=${clientId}` : ''
  const copy = async (txt: string) => { try { await navigator.clipboard.writeText(txt); notify(t('x38.copied')) } catch { notify(t('x38.copy_failed'), 'err') } }
  return (
    <div>
      <PageHead icon={<Settings size={28} />} title={t('nav.settings')} sub={`${agency}${me ? ` · ${me.name}` : ''}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<Moon size={17} />} title={t('x38.appearance')} />
          <div className="flex items-center justify-between text-[13px]"><span>{t('x38.dark_mode')}</span><Btn onClick={toggleDark}>{dark ? t('xm.switch_light') : t('xm.switch_dark')}</Btn></div>
        </Card>
        <Card>
          <CardTitle icon={<Database size={17} />} title={t('x38.data')} right={<Badge color={mode === 'live' ? '#16A34A' : '#F59E0B'}>{mode === 'live' ? t('xm.live_db') : t('xm.demo_mode')}</Badge>} />
          {mode === 'demo' ? (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">{t('x38.sample_data_is_stored_in')} <b>70_immobilier_os.sql</b> {t('x38.in_the_supabase_sql_editor')}</div>
              <div><Btn onClick={() => confirmDelete(t('cf.demo')) && resetDemo()}><RefreshCw size={14} /> {t('x38.reset_demo_data')}</Btn></div>
            </div>
          ) : (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">{t('x38.connected_to_your_supabase_database')}</div>
              {liveEmpty && <div><Btn kind="gold" onClick={seedLive}><Sparkles size={14} /> {t('x38.load_sample_qatar_data')}</Btn></div>}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle icon={<Sparkles size={17} />} title={t('x38.ai_usage_this_month')} />
          {aiUsage ? (
            <div className="text-[13px] flex flex-col gap-2">
              <div className="flex justify-between"><span>{tf('xl.used_of', { used: aiUsage.used, limit: aiUsage.limit })}</span><b>{aiUsage.limit > 0 ? Math.min(100, Math.round((aiUsage.used / aiUsage.limit) * 100)) : 100}%</b></div>
              <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}><div className="h-2 rounded-full" style={{ width: `${aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 100}%`, background: aiUsage.used >= aiUsage.limit ? '#EF4444' : aiUsage.used / Math.max(1, aiUsage.limit) > 0.8 ? '#F59E0B' : '#2563EB' }} /></div>
              <div className="t-muted">{t('x38.counts_assistant_ads_replies_and')}</div>
            </div>
          ) : <div className="text-[13px] t-muted">{t('x38.usage_becomes_available_once_migration')}</div>}
          <div className="text-[13px] mt-3"><b>{t('ai.model')}:</b> {aiModel?.model ? <code dir="ltr">{aiModel.model}</code> : <span className="t-muted">{t('ai.model.none')}</span>}</div>
        </Card>
        <Card>
          <CardTitle icon={<Webhook size={17} />} title={t('x38.integrations')} />
          <div className="text-[13px] flex flex-col gap-2 t-muted">
            <div><b className="t-main">AI:</b> {t('x38.uses_gemini_api_key_first')}</div>
            <div><b className="t-main">{t('x38.whatsapp_sending')}</b> {t('x38.uses_your_greenapi_id_instance')}</div>
            <div><b className="t-main">{t('x38.whatsapp_receiving')}</b> {t('x38.uses_your_existing_greenapi_webhook')} <code>/api/webhook/whatsapp?secret=…</code>{t('x38.known_leads_clients_and_owners')} <code>WHATSAPP_IMMO_CLIENT_ID</code>{t('x38.run_migration_71_to_avoid')}</div>
            {clientId && <div><b className="t-main">{t('x38.your_agency_id')}</b> {t('x38.value_for_whatsapp_immo_client')} <code style={{ userSelect: 'all' }}>{clientId}</code></div>}
          </div>
        </Card>
        <ZonesCard />
        <MetaCard />
        <PaymentCard />
        <ComplianceCard />
        <Card className="lg:col-span-2">
          <CardTitle icon={<Link2 size={17} />} title={t('x38.lead_capture_form')} />
          {formUrl ? (
            <div className="text-[13px] flex flex-col gap-3">
              <div className="t-muted">{t('x38.share_this_public_link_whatsapp')} <code>&amp;lang=ar</code> or <code>&amp;lang=fr</code> {t('x38.for_another_language_and')} <code>&amp;property=ID</code> {t('x38.to_link_a_listing_or')}</div>
              <div className="flex gap-2 items-center flex-wrap"><code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{formUrl}</code><Btn onClick={() => copy(formUrl)}><Copy size={13} /> {t('x38.copy_link')}</Btn></div>
              <div className="t-muted">{t('x38.to_embed_it_in_your')}</div>
              <div className="flex gap-2 items-start flex-wrap"><code style={{ userSelect: 'all', wordBreak: 'break-all' }}>{`<iframe src="${formUrl}" width="100%" height="720" style="border:0"></iframe>`}</code><Btn onClick={() => copy(`<iframe src="${formUrl}" width="100%" height="720" style="border:0"></iframe>`)}><Copy size={13} /> {t('x38.copy_code')}</Btn></div>
              {mode === 'demo' && <div style={{ color: '#92400E' }}>{t('x38.demo_mode_the_form_only')}</div>}
            </div>
          ) : <div className="text-[13px] t-muted">{t('x38.loading')}</div>}
        </Card>
        <Card>
          <CardTitle icon={<LogOut size={17} />} title={t('x38.session')} />
          <div className="flex gap-2"><Btn onClick={() => router.push('/dashboard')}>{t('back')}</Btn><Btn kind="danger" onClick={async () => { await supabase.auth.signOut(); router.replace('/auth') }}>{t('ch.signout')}</Btn></div>
        </Card>
      </div>
    </div>
  )
}
