'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Sparkles, Copy, Trash2, Check } from 'lucide-react'
import { useImmo } from '@/lib/immo-os/store'
import { Badge, Btn, Card, CardTitle, Empty, Field, PageHead, PropImage } from '@/lib/immo-os/ui'
import { CHANNELS } from '@/lib/immo-os/types'
import { ago, contextSummary, qar } from '@/lib/immo-os/helpers'
import { fallbackAd } from '@/lib/immo-os/fallbacks'
import { confirmDelete, useQueryParam } from '@/lib/immo-os/hooks'
import { AdPerformance, AdPublish, SocialAccounts, usePublishInfo } from './social'

const CH_LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', whatsapp: 'WhatsApp', property_portal: 'Property portal', linkedin: 'LinkedIn', email: 'Email' }
const TONES = ['luxury', 'friendly', 'professional', 'urgent']

export default function MarketingPage() {
  const pub = usePublishInfo()
  const { data, ai, create, update, remove, notify, canDelete, t, tf } = useImmo()
  const chName = (c: string) => (c === 'property_portal' ? t('xm.property_portal') : c === 'email' ? t('team.invite.email') : CH_LABEL[c] ?? c)
  const pre = useQueryParam('property')
  const [pid, setPid] = useState('')
  const [channel, setChannel] = useState('instagram')
  const [language, setLanguage] = useState('en')
  const [tone, setTone] = useState('luxury')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (pre) setPid(pre) }, [pre])
  useEffect(() => { if (!pid && data.properties[0]) setPid(data.properties[0].id) }, [data.properties, pid])
  const p = data.properties.find((x) => x.id === pid)

  const generate = async () => {
    if (!p) return notify(t('x38.choose_a_property_first'), 'err')
    setBusy(true)
    const r = await ai('ad', `Write a ${tone} ${CH_LABEL[channel]} advertisement`, { context: contextSummary(data), extra: `Property: ${JSON.stringify({ title: p.title, type: p.type, listing: p.listing, area: p.area, price: p.price, beds: p.beds, baths: p.baths, size_m2: p.size_m2, description: p.description })}\nChannel: ${CH_LABEL[channel]}\nTone: ${tone}`, language })
    setContent(r ?? fallbackAd(p, channel, language))
    if (!r) notify(t('x38.ai_is_not_configured_used'), 'err')
    setBusy(false)
  }
  const save = async () => {
    if (!content.trim()) return
    await create('ads', { property_id: pid || null, channel, language, tone, content, status: 'draft' })
    notify(t('x38.ad_saved'))
  }
  const copy = async (txt: string) => { try { await navigator.clipboard.writeText(txt); notify(t('x38.copied')) } catch { notify(t('x38.copy_failed'), 'err') } }

  return (
    <div>
      <PageHead icon={<Megaphone size={28} />} title={t('nav.marketing')} sub={t('xm.marketing_sub')} />
      <SocialAccounts info={pub.info} reload={pub.reload} />
      <AdPerformance />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardTitle icon={<Sparkles size={17} style={{ color: 'var(--gold)' }} />} title={t('x38.ad_generator')} />
          {data.properties.length === 0 ? <Empty title={t('x38.add_a_property_first')} /> : (
            <div className="grid gap-3">
              <Field label={t('sp.choose')}><select className="imo-select" value={pid} onChange={(e) => setPid(e.target.value)}>{data.properties.map((x) => <option key={x.id} value={x.id}>{x.title} · {x.area} · {qar(x.price)}</option>)}</select></Field>
              {p && <PropImage p={p} h={120} />}
              <div className="grid grid-cols-3 gap-3">
                <Field label={t('x38.channel')}><select className="imo-select" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c} value={c}>{chName(c)}</option>)}</select></Field>
                <Field label={t('lang')}><select className="imo-select" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="ar">العربية</option><option value="fr">Français</option></select></Field>
                <Field label={t('x38.tone')}><select className="imo-select" value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              </div>
              <Btn kind="gold" onClick={generate} disabled={busy}><Sparkles size={14} /> {busy ? t('xm.writing') : t('xm.generate_ad')}</Btn>
              <Field label={t('x38.ad_text_editable')}><textarea className="imo-textarea" style={{ minHeight: 190, direction: language === 'ar' ? 'rtl' : 'ltr' }} value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('x38.the_generated_ad_appears_here')} /></Field>
              <div className="flex gap-2"><Btn onClick={() => copy(content)} disabled={!content}><Copy size={14} /> {t('x38.copy')}</Btn><Btn kind="primary" onClick={save} disabled={!content}>{t('x38.save_ad')}</Btn></div>
            </div>
          )}
        </Card>

        <Card pad={false}>
          <div className="p-4 pb-1"><CardTitle title={`Saved ads (${data.ads.length})`} /></div>
          <div className="px-4 pb-4 flex flex-col gap-3">
            {data.ads.length === 0 && <Empty title={t('x38.no_saved_ads_yet')} sub={t('xm.marketing_sub2')} />}
            {data.ads.map((a) => {
              const pr = data.properties.find((x) => x.id === a.property_id)
              return (
                <div key={a.id} className="imo-card p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5"><div className="flex items-center gap-2 text-[13px] font-semibold">{pr?.title ?? 'Ad'}<Badge color="#2563EB">{chName(a.channel) ?? a.channel}</Badge><Badge color="#64748B">{a.language.toUpperCase()}</Badge></div><span className="text-[11.5px] t-muted">{ago(a.created_at)}</span></div>
                  <div className="text-[12.5px] whitespace-pre-wrap t-muted max-h-[120px] overflow-y-auto imo-scroll" style={{ direction: a.language === 'ar' ? 'rtl' : 'ltr' }}>{a.content}</div>
                  <div className="flex gap-1.5 mt-2.5 items-center">
                    <Btn style={{ padding: '4px 9px' }} onClick={() => copy(a.content)}><Copy size={12} /> {t('x38.copy')}</Btn>
                    <Btn style={{ padding: '4px 9px' }} onClick={() => update('ads', a.id, { status: a.status === 'draft' ? 'published' : 'draft' })}><Check size={12} /> {a.status === 'draft' ? t('xm.mark_published') : t('xm.published')}</Btn>
                    <Badge color={a.status === 'published' ? '#16A34A' : '#F59E0B'}>{a.status}</Badge>
                    <AdPublish ad={a} info={pub.info} reload={pub.reload} />
                    {canDelete && <Btn kind="danger" style={{ padding: '4px 9px', marginLeft: 'auto' }} onClick={() => confirmDelete(t('cf.ad')) && remove('ads', a.id)}><Trash2 size={12} /></Btn>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
