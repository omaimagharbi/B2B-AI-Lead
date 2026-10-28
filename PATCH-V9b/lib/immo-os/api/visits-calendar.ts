import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { contexteImmo } from '@/lib/immo-os/ctx'
import { isUuid } from '@/lib/immo-os/server'
import { canWrite } from '@/lib/immo-os/permissions'
import { creerEvenementGoogle } from '@/lib/google-calendar'

// Ajoute une visite au Google Calendar de l'agence (connecte depuis le dashboard PiloBrain).
export async function POST(req: NextRequest) {
  const auth = await contexteImmo(req)
  if (auth.erreur) return NextResponse.json({ error: auth.erreur }, { status: auth.statut })
  const { visitId } = await req.json().catch(() => ({}))
  if (!isUuid(visitId)) return NextResponse.json({ error: 'visitId required' }, { status: 400 })

  const { data: visit } = await supabaseAdmin.from('re_visits').select('*').eq('id', visitId).eq('client_id', auth.clientId).maybeSingle()
  if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
  if (!canWrite('visits', 'update', { role: auth.role, name: auth.name }, visit)) return NextResponse.json({ error: 'You do not have permission to do this' }, { status: 403 })
  if (visit.calendar_event_id) return NextResponse.json({ ok: true, already: true })

  const { data: cab } = await supabaseAdmin
    .from('clients')
    .select('id, google_calendar_connecte, google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expiry, google_calendar_id')
    .eq('id', auth.clientId)
    .maybeSingle()
  if (!cab?.google_calendar_connecte) return NextResponse.json({ error: 'Google Calendar is not connected. Connect it from your PiloBrain dashboard first.' }, { status: 409 })

  const { data: prop } = visit.property_id ? await supabaseAdmin.from('re_properties').select('title, area').eq('id', visit.property_id).eq('client_id', auth.clientId).maybeSingle() : { data: null }
  const debut = new Date(visit.starts_at)
  try {
    const eventId = await creerEvenementGoogle(cab, {
      titre: `Viewing: ${prop?.title ?? 'Property'}${prop?.area ? ` (${prop.area})` : ''} - ${visit.contact_name}`,
      description: [`Client: ${visit.contact_name}`, visit.contact_phone ? `Phone: ${visit.contact_phone}` : '', visit.agent ? `Agent: ${visit.agent}` : '', visit.notes ?? ''].filter(Boolean).join('\n'),
      debut,
      fin: new Date(debut.getTime() + (visit.duration_min || 45) * 60000),
    })
    await supabaseAdmin.from('re_visits').update({ calendar_event_id: eventId }).eq('id', visit.id).eq('client_id', auth.clientId)
    return NextResponse.json({ ok: true, eventId })
  } catch (e) {
    console.error('immo visit calendar:', e)
    return NextResponse.json({ error: 'Google Calendar refused the request. Reconnect it from your PiloBrain dashboard.' }, { status: 502 })
  }
}
