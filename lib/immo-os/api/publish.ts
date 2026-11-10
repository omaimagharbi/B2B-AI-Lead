import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isManager } from '@/lib/immo-os/permissions'
import { isUuid, tableAbsente } from '@/lib/immo-os/server'
import { isOwnMediaUrl } from '@/lib/immo-os/media'
import { logActivity } from '@/lib/immo-os/activity'

// Lot 8 (n°45 / n°75 / n°46) : publication d'une annonce sur Facebook et Instagram (API Meta Graph) et mesure de performance.
// /api/immo?r=publish  - GET : etat ; POST { action: 'save_accounts' | 'publish' | 'insights' }. Reserve aux gestionnaires (publication publique).
// Jeton : variable META_PAGE_ACCESS_TOKEN (jeton d'utilisateur systeme avec pages_manage_posts, instagram_content_publish, pages_read_engagement,
// instagram_basic). Les identifiants de page / compte Instagram sont enregistres PAR AGENCE : une agence ne publie que sur ses propres comptes.
const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v21.0'}`
const token = () => process.env.META_PAGE_ACCESS_TOKEN

async function graph(path: string, method: 'GET' | 'POST', params: Record<string, string> = {}): Promise<{ ok: true; json: any } | { ok: false; message: string }> {
  try {
    const url = new URL(`${GRAPH()}/${path}`)
    const init: RequestInit = { method, headers: { Authorization: `Bearer ${token()}` } }
    if (method === 'GET') Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    else { init.body = new URLSearchParams(params); }
    const res = await fetch(url, init)
    const json = await res.json().catch(() => null)
    return res.ok && json && !json.error ? { ok: true, json } : { ok: false, message: String(json?.error?.message ?? `HTTP ${res.status}`).slice(0, 300) }
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'network error' } }
}

export async function GET(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const { data, error } = await supabaseAdmin.from('re_social_accounts').select('fb_page_id, ig_account_id').eq('client_id', auth.clientId).maybeSingle()
  return NextResponse.json({ configured: !!token(), accounts: data ?? null, missing: !!error && tableAbsente(error) })
}

export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  if (!isManager(auth.role)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const who = { clientId: auth.clientId, id: auth.clientUserId, name: auth.name, role: auth.role }
  const { data: acc, error: accErr } = await supabaseAdmin.from('re_social_accounts').select('fb_page_id, ig_account_id').eq('client_id', auth.clientId).maybeSingle()
  if (accErr && tableAbsente(accErr)) return NextResponse.json({ error: 'Run migration 82 first' }, { status: 503 })

  if (b.action === 'save_accounts') {
    const clean = (v: unknown) => (typeof v === 'string' && /^\d{5,25}$/.test(v.trim()) ? v.trim() : null)
    const { error } = await supabaseAdmin.from('re_social_accounts').upsert({ client_id: auth.clientId, fb_page_id: clean(b.fb_page_id), ig_account_id: clean(b.ig_account_id), updated_by: auth.name, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await logActivity(who, { action: 'update', entity: 'settings', label: 'social_accounts', details: { fields: ['fb_page_id', 'ig_account_id'] } })
    return NextResponse.json({ ok: true })
  }
  if (!token()) return NextResponse.json({ error: 'META_PAGE_ACCESS_TOKEN is not configured' }, { status: 400 })
  if (!isUuid(b.ad_id)) return NextResponse.json({ error: 'ad_id required' }, { status: 400 })
  const { data: ad } = await supabaseAdmin.from('re_ads').select('*').eq('id', b.ad_id).eq('client_id', auth.clientId).maybeSingle()
  if (!ad) return NextResponse.json({ error: 'Ad not found' }, { status: 404 })

  if (b.action === 'publish') {
    const targets: ('facebook' | 'instagram')[] = (Array.isArray(b.targets) ? b.targets : []).filter((x: unknown) => x === 'facebook' || x === 'instagram')
    if (!targets.length) return NextResponse.json({ error: 'Choose Facebook, Instagram or both' }, { status: 400 })
    let image: string | null = null
    if (ad.property_id) {
      const { data: p } = await supabaseAdmin.from('re_properties').select('image_url, photos').eq('id', ad.property_id).eq('client_id', auth.clientId).maybeSingle()
      const cand = [p?.image_url, ...((p?.photos as string[] | null) ?? [])].find((u) => isOwnMediaUrl(u, process.env.NEXT_PUBLIC_SUPABASE_URL, auth.clientId))
      image = cand ?? null
    }
    const caption = String(ad.content ?? '').trim()
    if (!caption) return NextResponse.json({ error: 'The ad text is empty' }, { status: 400 })
    const patch: Record<string, unknown> = {}
    const results: Record<string, string> = {}
    const errors: string[] = []
    if (targets.includes('facebook')) {
      if (ad.fb_post_id) results.facebook = 'already_published'
      else if (!acc?.fb_page_id) errors.push('Facebook page ID is not set')
      else {
        const r = image ? await graph(`${acc.fb_page_id}/photos`, 'POST', { url: image, caption: caption.slice(0, 5000) }) : await graph(`${acc.fb_page_id}/feed`, 'POST', { message: caption.slice(0, 5000) })
        if (r.ok) { patch.fb_post_id = String(r.json.post_id ?? r.json.id); results.facebook = 'published' } else errors.push(`Facebook: ${r.message}`)
      }
    }
    if (targets.includes('instagram')) {
      if (ad.ig_media_id) results.instagram = 'already_published'
      else if (!acc?.ig_account_id) errors.push('Instagram account ID is not set')
      else if (!image) errors.push('Instagram needs a photo: link the ad to a property with photos')
      else {
        const c = await graph(`${acc.ig_account_id}/media`, 'POST', { image_url: image, caption: caption.slice(0, 2200) })
        if (!c.ok) errors.push(`Instagram: ${c.message}`)
        else {
          const pub = await graph(`${acc.ig_account_id}/media_publish`, 'POST', { creation_id: String(c.json.id) })
          if (pub.ok) { patch.ig_media_id = String(pub.json.id); results.instagram = 'published' } else errors.push(`Instagram: ${pub.message}`)
        }
      }
    }
    const published = Object.values(results).some((v) => v === 'published')
    if (published) { patch.status = 'published'; patch.published_at = new Date().toISOString() }
    patch.publish_error = errors.length ? errors.join(' | ').slice(0, 500) : null
    await supabaseAdmin.from('re_ads').update(patch).eq('id', ad.id).eq('client_id', auth.clientId)
    if (published) await logActivity(who, { action: 'publish', entity: 'ads', recordId: ad.id, label: String(ad.channel), details: { targets: Object.entries(results).filter(([, v]) => v === 'published').map(([k]) => k) } })
    return NextResponse.json({ ok: errors.length === 0, results, errors }, { status: errors.length && !published ? 502 : 200 })
  }

  if (b.action === 'insights') {
    const m: { reach: number | null; likes: number | null; comments: number | null; clicks: number | null } = { reach: null, likes: null, comments: null, clicks: null }
    const sum = (a: number | null, v: unknown) => (a ?? 0) + (Number.isFinite(Number(v)) ? Number(v) : 0)
    const errors: string[] = []
    if (ad.fb_post_id) {
      const r = await graph(ad.fb_post_id, 'GET', { fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0),insights.metric(post_impressions_unique,post_clicks)' })
      if (r.ok) {
        m.likes = sum(m.likes, r.json.likes?.summary?.total_count); m.comments = sum(m.comments, r.json.comments?.summary?.total_count)
        for (const i of r.json.insights?.data ?? []) { const v = i.values?.[0]?.value; if (i.name === 'post_impressions_unique') m.reach = sum(m.reach, v); if (i.name === 'post_clicks') m.clicks = sum(m.clicks, v) }
      } else errors.push(`Facebook: ${r.message}`)
    }
    if (ad.ig_media_id) {
      const r = await graph(ad.ig_media_id, 'GET', { fields: 'like_count,comments_count' })
      if (r.ok) { m.likes = sum(m.likes, r.json.like_count); m.comments = sum(m.comments, r.json.comments_count) } else errors.push(`Instagram: ${r.message}`)
      const ins = await graph(`${ad.ig_media_id}/insights`, 'GET', { metric: 'reach' })
      if (ins.ok) m.reach = sum(m.reach, ins.json.data?.[0]?.values?.[0]?.value)
    }
    if (!ad.fb_post_id && !ad.ig_media_id) return NextResponse.json({ error: 'This ad was not published through the platform' }, { status: 400 })
    await supabaseAdmin.from('re_ads').update({ ...m, metrics_at: new Date().toISOString() }).eq('id', ad.id).eq('client_id', auth.clientId)
    return NextResponse.json({ ok: errors.length === 0, metrics: m, errors })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
