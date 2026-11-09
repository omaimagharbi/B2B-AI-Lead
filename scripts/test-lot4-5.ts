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
import { parseSearch, refineQuery } from '../lib/immo-os/helpers'
import { riskReasons } from '../lib/immo-os/metrics'
import { guard, wantsHuman, validateReply, readConfig, qualify, leadPatchFromQual, DEFAULT_AGENT_CONFIG } from '../lib/immo-os/ai-agent'
import { scoreConversation, dispatchSuggestions, negotiationBrief } from '../lib/immo-os/ai-tools'
import { sniffChatFile, isOwnMediaUrl, inboundMime } from '../lib/immo-os/media'

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
ok('Fichiers : types, taille, URL de l\'agence', () => {
  assert.equal(sniffChatFile(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))?.type, 'document')
  assert.equal(sniffChatFile(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.type, 'image')
  assert.equal(sniffChatFile(new Uint8Array([0x4d, 0x5a, 0x90, 0x00])), null) // executable refuse
  const base = 'https://p.supabase.co', cid = 'cccc'
  assert.equal(isOwnMediaUrl(`${base}/storage/v1/object/public/immo-chat/${cid}/out/a.jpg`, base, cid), true)
  assert.equal(isOwnMediaUrl(`${base}/storage/v1/object/public/immo-photos/${cid}/a.jpg`, base, cid), true)
  assert.equal(isOwnMediaUrl(`${base}/storage/v1/object/public/immo-chat/other/out/a.jpg`, base, cid), false)
  assert.equal(isOwnMediaUrl('https://evil.com/a.jpg', base, cid), false)
  assert.equal(isOwnMediaUrl(`${base}/storage/v1/object/public/immo-chat/${cid}/../x.jpg`, base, cid), false)
  assert.equal(inboundMime('audio/ogg; codecs=opus')?.type, 'audio'); assert.equal(inboundMime('application/x-msdownload'), null)
})
ok('n°36 recherche EN / FR / AR', () => {
  const en = parseSearch('villa in Lusail under 3m with 4 beds')
  assert.deepEqual([en.type, en.area, en.maxPrice, en.minBeds], ['villa', 'Lusail', 3_000_000, 4])
  const fr = parseSearch('Je cherche une villa à Lusail pour moins de 3 millions avec 4 chambres')
  assert.deepEqual([fr.type, fr.area, fr.maxPrice, fr.minBeds], ['villa', 'Lusail', 3_000_000, 4])
  const ar = parseSearch('أريد فيلا في لوسيل أقل من 3 مليون 4 غرف')
  assert.deepEqual([ar.type, ar.area, ar.maxPrice, ar.minBeds], ['villa', 'Lusail', 3_000_000, 4])
  const ar2 = parseSearch('شقة للايجار في اللؤلؤة غرفتين بميزانية ٧٠٠٠٠')
  assert.deepEqual([ar2.type, ar2.listing, ar2.area, ar2.minBeds, ar2.maxPrice], ['apartment', 'rent', 'The Pearl', 2, 70000])
  const fr2 = parseSearch('appartement à louer à West Bay Lagoon, 2 chambres, max 15k')
  assert.deepEqual([fr2.type, fr2.listing, fr2.area, fr2.minBeds, fr2.maxPrice], ['apartment', 'rent', 'West Bay Lagoon', 2, 15000])
  assert.equal(parseSearch('bureau à vendre à Lusail').type, 'office'); assert.equal(parseSearch('أرض في لوسيل').type, 'land'); assert.equal(parseSearch('hello').type, undefined)
  const f = refineQuery(en, 'moins cher'); assert.equal(f.maxPrice, 2_400_000); assert.equal(f.area, 'Lusail')
  assert.equal(refineQuery(en, 'et à The Pearl').area, 'The Pearl')
})
ok('n°94 leads a risque : etape bloquee et score en baisse', () => {
  const now = Date.UTC(2026, 10, 8), d = (n: number) => new Date(now - n * 86400000).toISOString()
  const lead: any = { id: 'L', name: 'A', status: 'qualified', score: 90, budget: 0, source: 'whatsapp', agent: 'S', created_at: d(30), last_contact: d(1) }
  const r = riskReasons(lead, now, ['S'], { props: [], stages: [{ id: 's', kind: 'lead', record_id: 'L', from_status: 'new', to_status: 'qualified', created_at: d(10) } as any] })
  assert.ok(r.includes('stage_stuck')); assert.ok(r.includes('score_drop'))
  assert.deepEqual(riskReasons({ ...lead, score: 40 }, now, ['S'], { props: [], stages: [{ id: 's', kind: 'lead', record_id: 'L', to_status: 'qualified', created_at: d(2) } as any] }), [])
})
ok('n°39/85 agent IA : garde-fous', () => {
  const cfg = { ...DEFAULT_AGENT_CONFIG, auto_reply: true }
  const base = { config: cfg, optedOut: false, isOwner: false, text: 'Hi, do you have a villa in Lusail?', autoRepliesToday: 0, humanRepliedRecently: false }
  assert.deepEqual(guard(base), { ok: true })
  assert.deepEqual(guard({ ...base, config: DEFAULT_AGENT_CONFIG }), { ok: false, reason: 'disabled' }) // desactive par defaut
  assert.equal((guard({ ...base, optedOut: true }) as any).reason, 'opted_out'); assert.equal((guard({ ...base, isOwner: true }) as any).reason, 'owner')
  assert.equal((guard({ ...base, text: '[image]' }) as any).reason, 'media'); assert.equal((guard({ ...base, humanRepliedRecently: true }) as any).reason, 'human_active')
  assert.equal((guard({ ...base, autoRepliesToday: 3 }) as any).reason, 'limit')
  for (const t of ['Can I get a discount?', 'je veux parler à un humain', 'أريد خصم على السعر', 'I will call my lawyer', 'rappelez-moi svp']) assert.equal(wantsHuman(t), true, t)
  assert.equal(wantsHuman('Is the villa still available?'), false)
  assert.equal(readConfig({ auto_reply: 'yes', max_replies: 99 }).auto_reply, false); assert.equal(readConfig({ max_replies: 4 }).max_replies, 4)
})
ok('n°39/85 agent IA : controle de la reponse et qualification', () => {
  const ok1 = validateReply('We have a villa in Lusail for QAR 3,000,000 (REF-1A2B3C4D). An agent will follow up.', { allowedPrices: [3000000], clientText: 'villa' })
  assert.equal(ok1.ok, true)
  for (const bad of ['Call +974 5512 3456', 'See https://x.com/a', 'Contact the owner Ali', 'It costs 2,500,000 only', 'mail me a@b.com', '']) assert.equal(validateReply(bad, { allowedPrices: [3000000], clientText: '' }).ok, false, bad)
  assert.equal(validateReply('Your budget of 3000000 works', { allowedPrices: [], clientText: 'budget 3000000' }).ok, true)
  const q = qualify(['I want a villa in Lusail', 'budget under 3m'])
  assert.deepEqual([q.qual.type, q.qual.area, q.qual.budget], ['villa', 'Lusail', 3_000_000]); assert.deepEqual(q.missing, ['listing', 'beds'])
  assert.deepEqual(leadPatchFromQual({ budget: 0, beds_wanted: null, interest: '' } as any, q.qual), { budget: 3_000_000, interest: 'villa - Lusail' })
  assert.deepEqual(leadPatchFromQual({ budget: 500, beds_wanted: 2, interest: 'x' } as any, q.qual), {}) // n'ecrase pas la saisie de l'agent
})
ok('n°29/84 qualite, n°87 dispatch et negociation', () => {
  const t0 = Date.UTC(2026, 10, 8, 9), at = (m: number) => new Date(t0 + m * 60000).toISOString()
  const good = scoreConversation([{ direction: 'in', body: 'hello', created_at: at(0) }, { direction: 'out', body: 'Hello! Would you like to book a viewing this week?', created_at: at(5) }], t0 + 3600000)
  assert.ok(good.score >= 85, String(good.score)); assert.deepEqual(good.flags, [])
  const bad = scoreConversation([{ direction: 'in', body: 'price?', created_at: at(0) }, { direction: 'out', body: 'ok', created_at: at(600) }, { direction: 'in', body: 'hello?', created_at: at(700) }], t0 + 3 * 86400000)
  assert.ok(bad.score < 40, String(bad.score)); assert.ok(bad.flags.includes('slow') && bad.flags.includes('unanswered') && bad.flags.includes('too_short'))
  assert.equal(scoreConversation([]).score, 0)
  const L = (agent: string, status: string, interest: string) => ({ agent, status, interest, property_id: null } as any)
  const d = dispatchSuggestions({ interest: 'villa Lusail', property_id: null, name: 'x' } as any, { leads: [L('A', 'new', 'villa Lusail'), L('A', 'new', 'x'), L('A', 'new', 'x'), L('B', 'new', 'villa Lusail')], deals: [], clients: [], properties: [] }, ['A', 'B', 'C'])
  assert.deepEqual(d.map((x) => x.agent), ['B', 'C', 'A']) // B connait la zone (102), C est libre (100), A est charge (90)
  const prop: any = { id: 'p', price: 3_000_000, size_m2: 300, area: 'Lusail', type: 'villa', listing: 'sale' }
  const comps: any[] = [prop, { id: 'q', price: 3_300_000, size_m2: 300, area: 'Lusail', type: 'villa', listing: 'sale' }]
  const nb = negotiationBrief({ value: 2_700_000, status: 'offer', created_at: new Date(t0 - 5 * 86400000).toISOString() } as any, prop, comps, null, t0)
  assert.equal(nb.gapPct, 10); assert.equal(nb.counterMin, 2_820_000); assert.equal(nb.counterMax, 2_910_000); assert.equal(nb.medianPerM2, 11000); assert.equal(nb.daysInStage, 5)
})
function l_(i: number) { return (['en', 'fr', 'ar'] as const)[i] }
console.log(`\n${n} groupes de tests OK`)
