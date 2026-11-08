// Tests des fonctions pures des lots 4 et 5 : npx tsx scripts/test-lot4-5.ts
import assert from 'node:assert/strict'
import { detectOptOut, detectOptIn, pickLang } from '../lib/immo-os/optout'
import { detectProperty, propRef, conversationProperty, type PropLite } from '../lib/immo-os/property-detect'
import { decideUnknown } from '../lib/immo-os/unknown-rule'
import { planDealTransition, nextStep, taskDate } from '../lib/immo-os/deal-flow'
import { becameHot, isHotLead, periodKey, alertRecipient } from '../lib/immo-os/hot-alert'
import { parseIncoming } from '../lib/immo-os/inbound-pure'
import { validateCapture } from '../lib/immo-os/capture-pure'
import { buildTimeline, handledBy } from '../lib/immo-os/profile'
import { translate, I18N_KEYS } from '../lib/immo-os/i18n'
import { MOTS_STOP_BASE } from '../lib/optout-words'
import { parseMetaWebhook, verifySignature, windowState, renderTemplate, templateVars, isTechnicalFailure } from '../lib/immo-os/wa-meta'
import { createHmac } from 'node:crypto'

let n = 0
const ok = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name) }

ok('STOP : mots seuls et phrases FR/EN/AR', () => {
  for (const x of ['STOP', 'stop', ' Stop. ', 'stop please', 'ARRET', 'Arrêtez', 'unsubscribe', 'ne plus me contacter', 'Please stop messaging me', 'توقف', 'لا تتواصل معي', 'ايقاف الرسائل', 'désabonner']) assert.equal(detectOptOut(x), true, x)
})
ok('STOP : pas de faux positifs', () => {
  for (const x of ['the bus stop is near the villa', 'Is the villa near the metro stop? I would like to see it on Thursday', 'Hello, I am interested in the apartment', 'شكرا لك', '', 'Can we stopover at 5pm?']) assert.equal(detectOptOut(x), false, x)
})
ok('START', () => { assert.equal(detectOptIn('START'), true); assert.equal(detectOptIn('reprendre'), true); assert.equal(detectOptIn('I want to start viewing villas'), false) })
ok('liste de mots partagee avec le B2B', () => assert.deepEqual(MOTS_STOP_BASE, ['stop', 'desabonner', 'désabonner', 'ne plus']))
ok('langue de la reponse', () => { assert.equal(pickLang('توقف'), 'ar'); assert.equal(pickLang('Arrêtez svp'), 'fr'); assert.equal(pickLang('STOP'), 'en') })

const P = (o: Partial<PropLite> & { id: string; title: string }): PropLite => ({ type: 'villa', listing: 'sale', status: 'available', beds: 4, price: 3_000_000, area: 'Lusail', unit_no: null, ...o })
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444'
const props = [P({ id: A, title: 'Luxury Villa', area: 'The Pearl', unit_no: 'V-12' }), P({ id: B, title: 'Seafront Apartment', type: 'apartment', beds: 2, area: 'Lusail', unit_no: 'A-804' }), P({ id: C, title: 'Garden Apartment', type: 'apartment', beds: 3, area: 'Lusail' }), P({ id: D, title: 'Family Villa', area: 'West Bay Lagoon', status: 'rented' })]
ok('detection : lien, reference, unite, titre, attributs', () => {
  assert.deepEqual(detectProperty(`https://x.com/lead?a=1&property=${B}`, props), { propertyId: B, confidence: 1, reason: 'link' })
  assert.equal(detectProperty(`Hi, ref ${propRef(C)} please`, props)?.propertyId, C)
  assert.equal(detectProperty('Is unit A-804 still free?', props)?.reason, 'unit')
  assert.equal(detectProperty('I like the luxury villa', props)?.propertyId, A)
  assert.equal(detectProperty('Looking for a 2 bedroom apartment in Lusail', props)?.propertyId, B)
})
ok('detection : ambigu ou inconnu = rien', () => {
  assert.equal(detectProperty('Do you have an apartment in Lusail?', props), null) // 2 appartements a Lusail
  assert.equal(detectProperty('Hello', props), null)
  assert.equal(detectProperty('villa in Al Khor', props), null)
  const dup = [...props, P({ id: '55555555-5555-4555-8555-555555555555', title: 'Luxury Villa', area: 'Lusail' })]
  assert.equal(detectProperty('the luxury villa', dup), null)
  assert.equal(detectProperty('the luxury villa in Lusail', dup)?.propertyId, '55555555-5555-4555-8555-555555555555')
})
ok('bien en discussion', () => {
  assert.equal(conversationProperty([{ direction: 'in', body: 'hi', property_id: C, property_auto: true }], props)?.propertyId, C)
  assert.equal(conversationProperty([{ direction: 'in', body: 'about unit V-12' }], props)?.source, 'detected')
  assert.equal(conversationProperty([{ direction: 'in', body: 'hello' }], props, B)?.source, 'lead')
})
ok('regle numero inconnu', () => {
  assert.equal(decideUnknown('create_lead', { text: 'hi', propertyDetected: false }), 'create_lead')
  assert.equal(decideUnknown('if_property', { text: 'hi', propertyDetected: false }), 'inbox_only')
  assert.equal(decideUnknown('if_property', { text: 'I want to rent a villa', propertyDetected: false }), 'create_lead')
  assert.equal(decideUnknown('if_property', { text: 'hi', propertyDetected: true }), 'create_lead')
  assert.equal(decideUnknown('if_property', { text: 'أريد شراء شقة', propertyDetected: false }), 'create_lead')
  assert.equal(decideUnknown('inbox_only', { text: 'villa', propertyDetected: true }), 'inbox_only')
  assert.equal(decideUnknown('ignore', { text: 'villa', propertyDetected: true }), 'ignore')
})
ok('groupes, statuts et chaines ignores', () => {
  const m = (chatId: string, sender = chatId) => ({ typeWebhook: 'incomingMessageReceived', idMessage: 'x', senderData: { chatId, sender, senderName: 'A' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } } })
  assert.ok(parseIncoming(m('97455123456@c.us')))
  assert.equal(parseIncoming(m('1203@g.us', '97455123456@c.us')), null)
  assert.equal(parseIncoming(m('status@broadcast', '97455123456@c.us')), null)
  assert.equal(parseIncoming(m('97455123456@c.us', '12345@newsletter')), null)
})
ok('formulaire : consentement obligatoire', () => {
  const base = { agency: A.replace('1111', '1111'), name: 'Ali Test', phone: '55123456' }
  const bad = validateCapture({ ...base, agency: '11111111-1111-4111-8111-111111111111' })
  assert.equal(bad.ok, false)
  const good = validateCapture({ ...base, agency: '11111111-1111-4111-8111-111111111111', consent: true })
  assert.equal(good.ok && good.value.consent, true)
})
ok('parcours du deal', () => {
  assert.equal(nextStep('negotiation'), 'offer'); assert.equal(nextStep('closed'), null); assert.equal(nextStep('cancelled'), null)
  const deal = { id: 'd1', kind: 'sale' as const }
  const p1 = planDealTransition(deal, 'negotiation', 'offer', { propertyStatus: 'available' })
  assert.equal(p1.tasks.length, 1); assert.equal(p1.tasks[0].inDays, 2); assert.equal(p1.propertyStatus, null)
  const p2 = planDealTransition(deal, 'offer', 'contract', { propertyStatus: 'available' })
  assert.equal(p2.propertyStatus, 'reserved'); assert.equal(p2.tasks[0].category, 'signing')
  const p3 = planDealTransition(deal, 'contract', 'closed', { propertyStatus: 'reserved', leadActive: true })
  assert.equal(p3.propertyStatus, 'sold'); assert.equal(p3.leadWon, true)
  assert.equal(planDealTransition({ id: 'd2', kind: 'rent' }, 'contract', 'closed', { propertyStatus: 'reserved' }).propertyStatus, 'rented')
  assert.equal(planDealTransition(deal, 'contract', 'cancelled', { propertyStatus: 'reserved' }).propertyStatus, 'available')
  assert.equal(planDealTransition(deal, 'offer', 'offer').auto.length, 0)
  // idempotence : la tache d'une etape n'est pas recreee
  assert.equal(planDealTransition(deal, 'negotiation', 'offer', { existingMarkers: new Set(['[auto:deal:d1:offer]']) }).tasks.length, 0)
  assert.equal(taskDate(Date.UTC(2026, 10, 8, 12), 2, 10, 3), '2026-11-10T07:00:00.000Z')
})
ok('lead chaud : declencheur et periode', () => {
  assert.equal(isHotLead({ score: 75, status: 'new' }), true); assert.equal(isHotLead({ score: 74, status: 'new' }), false); assert.equal(isHotLead({ score: 90, status: 'won' }), false)
  assert.equal(becameHot({ score: 60, status: 'new' }, { score: 80, status: 'new' }), true)
  assert.equal(becameHot({ score: 80, status: 'new' }, { score: 85, status: 'qualified' }), false) // deja chaud : pas de nouvelle alerte
  assert.equal(becameHot(null, { score: 80, status: 'new' }), true)
  const t0 = Date.UTC(2026, 10, 8, 9)
  assert.equal(periodKey(t0), periodKey(t0 + 3600000)); assert.notEqual(periodKey(t0), periodKey(t0 + 73 * 3600000))
  const ag = { id: 'c', whatsapp_directeur: '+97455000000' }
  const mem = [{ client_id: 'c', nom_complet: 'Sara', telephone: '+97455111111' }]
  const L = { id: 'l', client_id: 'c', name: 'X', score: 80, status: 'new', agent: 'Sara' }
  assert.equal(alertRecipient(L, mem, ag), '+97455111111')
  assert.equal(alertRecipient({ ...L, agent: null }, mem, ag), '+97455000000')
  assert.equal(alertRecipient({ ...L, do_not_contact: true }, mem, ag), null)
})
ok('fiche client : chronologie et agents', () => {
  const items = buildTimeline({
    contact: { name: 'Ali', phone: '+97455123456' },
    messages: [{ id: 'm1', contact_name: 'Ali', contact_phone: '97455123456', direction: 'in', body: 'hello', unread: false, created_at: '2026-11-01T10:00:00Z' }, { id: 'm2', contact_name: 'Other', contact_phone: '97466000000', direction: 'in', body: 'no', unread: false, created_at: '2026-11-01T11:00:00Z' }],
    visits: [], deals: [{ id: 'd', title: 'Deal', party_name: 'ali', kind: 'sale', value: 1, commission_pct: 2, status: 'offer', agent: 'Sara', created_at: '2026-11-02T10:00:00Z' }],
    stages: [{ id: 's', kind: 'deal', record_id: 'd', record_name: 'Deal', from_status: 'negotiation', to_status: 'offer', by_name: 'Sara', auto: [], created_at: '2026-11-03T10:00:00Z' }], outcomes: [], sends: [],
    assignments: [{ id: 'a', lead_id: 'l', from_agent: null, to_agent: 'Sara', by_name: 'Boss', reason: 'creation', created_at: '2026-11-01T09:00:00Z' }], propertyName: () => '-',
  })
  assert.equal(items.length, 4); assert.equal(items[0].kind, 'stage')
  const h = handledBy(items, ['Sara'])
  assert.equal(h[0].name, 'Sara'); assert.equal(h[0].current, true)
})
ok('i18n : toutes les cles ont EN, FR et AR', () => {
  const missing = I18N_KEYS.filter((k) => ![0, 1, 2].every((i) => ['en', 'fr', 'ar'].map((l) => translate(l as any, k))[i] && translate(l_(i), k) !== k))
  assert.deepEqual(missing, [])
})
ok('Meta : analyse du webhook (message, bouton, media, statut)', () => {
  const body = { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { metadata: { phone_number_id: '111', display_phone_number: '97455' }, contacts: [{ wa_id: '97455123456', profile: { name: 'Ali' } }],
    messages: [{ from: '97455123456', id: 'wamid.A', timestamp: '1760000000', type: 'text', text: { body: 'Hello villa' } }, { from: '97455123456', id: 'wamid.B', timestamp: '1760000001', type: 'image', image: { caption: 'plan' } }, { from: '97455123456', id: 'wamid.C', timestamp: '1760000002', type: 'interactive', interactive: { button_reply: { title: 'Yes' } } }],
    statuses: [{ id: 'wamid.D', status: 'failed', recipient_id: '97455123456', errors: [{ code: 131047, title: 'Re-engagement', message: 'window' }] }, { id: 'x', status: 'weird' }] } }] }] }
  const r = parseMetaWebhook(body)
  assert.equal(r.messages.length, 3); assert.equal(r.messages[0].text, 'Hello villa'); assert.equal(r.messages[0].name, 'Ali'); assert.equal(r.messages[0].phoneNumberId, '111')
  assert.equal(r.messages[1].text, '[image] plan'); assert.equal(r.messages[2].text, 'Yes')
  assert.equal(r.statuses.length, 1); assert.equal(r.statuses[0].code, 131047)
  assert.deepEqual(parseMetaWebhook({ object: 'page' }), { messages: [], statuses: [] }); assert.deepEqual(parseMetaWebhook(null), { messages: [], statuses: [] })
})
ok('Meta : signature du webhook', () => {
  const raw = '{"a":1}', secret = 's3cret'
  const sig = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')
  assert.equal(verifySignature(raw, sig, secret), true)
  assert.equal(verifySignature(raw + ' ', sig, secret), false)
  assert.equal(verifySignature(raw, sig, 'other'), false)
  assert.equal(verifySignature(raw, null, secret), false); assert.equal(verifySignature(raw, sig, undefined), false); assert.equal(verifySignature(raw, 'sha256=abc', secret), false)
})
ok('Meta : fenetre de 24 h, modeles, repli', () => {
  const now = Date.UTC(2026, 10, 8, 12)
  assert.equal(windowState(new Date(now - 23 * 3600000).toISOString(), now).open, true)
  assert.equal(windowState(new Date(now - 25 * 3600000).toISOString(), now).open, false)
  assert.equal(windowState(null, now).open, false)
  assert.equal(templateVars('Hi {{1}}, viewing {{2}} at {{3}}'), 3); assert.equal(renderTemplate('Hi {{1}}, see {{2}}', ['Ali', 'villa']), 'Hi Ali, see villa')
  assert.equal(isTechnicalFailure(500, null), true); assert.equal(isTechnicalFailure(401, 190), true); assert.equal(isTechnicalFailure(0, null), true)
  assert.equal(isTechnicalFailure(400, 131047), false) // regle de fenetre : jamais de repli
  assert.equal(isTechnicalFailure(400, 132001), false)
})
function l_(i: number) { return (['en', 'fr', 'ar'] as const)[i] }
console.log(`\n${n} groupes de tests OK`)
