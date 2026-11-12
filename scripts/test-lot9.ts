// Tests du lot 9 (paiement en ligne) : npx tsx scripts/test-lot9.ts
import assert from 'node:assert/strict'
import { parseAmount, validateCreate, readConfig, buildInvoiceBody, interpretStatus, summarize, paidForDeal, newRef, isValidRef, siteUrlOk, isFinal } from '../lib/immo-os/payments'
import { filterForViewer, canWrite } from '../lib/immo-os/permissions'
import { translate, I18N_KEYS, translateServerError, SERVER_ERRORS } from '../lib/immo-os/i18n'
import { randomBytes } from 'node:crypto'

let n = 0
const test = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name) }

test('montants : valides, plafonnes, arrondis', () => {
  assert.equal(parseAmount('1,500.456'), 1500.46); assert.equal(parseAmount(250), 250)
  for (const bad of [0, -5, '', 'abc', NaN, Infinity, 10_000_001, null, undefined, {}]) assert.equal(parseAmount(bad as any), null, String(bad))
})
test('validation de creation', () => {
  assert.equal(validateCreate({ kind: 'deposit', amount: 0 }).ok, false)
  assert.equal(validateCreate({ kind: 'bitcoin', amount: 10 }).ok, false)
  const r = validateCreate({ kind: 'commission', amount: '90 000', deal_id: ' d1 ', description: '  x  ' })
  assert.ok(r.ok && r.v.amount === 90000 && r.v.deal_id === 'd1' && r.v.description === 'x')
})
test('configuration MyFatoorah : cle absente = desactive ; test par defaut ; live = serveur Qatar', () => {
  assert.equal(readConfig({}), null)
  assert.equal(readConfig({ MYFATOORAH_API_KEY: 'k' })?.baseUrl, 'https://apitest.myfatoorah.com')
  assert.equal(readConfig({ MYFATOORAH_API_KEY: 'k', MYFATOORAH_ENV: 'live' })?.baseUrl, 'https://api-qa.myfatoorah.com')
  assert.equal(readConfig({ MYFATOORAH_API_KEY: 'k', MYFATOORAH_BASE_URL: 'http://evil.test' }), null) // http refuse
  assert.equal(readConfig({ MYFATOORAH_API_KEY: 'k', MYFATOORAH_WEBHOOK_SECRET: ' s ' })?.webhookSecret, 's')
})
test('corps SendPayment : QAR, lien, reference, retour', () => {
  const b: any = buildInvoiceBody({ name: 'Youssef', amount: 150000, ref: 'abcdefghijklmnopqrstuvwx', siteUrl: 'https://app.pilobrain.com/', lang: 'fr' })
  assert.equal(b.DisplayCurrencyIso, 'QAR'); assert.equal(b.NotificationOption, 'LNK'); assert.equal(b.InvoiceValue, 150000)
  assert.equal(b.CustomerReference, 'abcdefghijklmnopqrstuvwx'); assert.ok(b.CallBackUrl.startsWith('https://app.pilobrain.com/api/immo?r=payments&cb=1&ref=')); assert.ok(b.ErrorUrl.endsWith('&err=1'))
  assert.equal(b.Language, 'en') // MyFatoorah : en ou ar seulement
})
test('adresse publique : https obligatoire, pas de localhost', () => {
  assert.ok(siteUrlOk('https://x.com')); assert.ok(!siteUrlOk('http://x.com')); assert.ok(!siteUrlOk('https://localhost:3000')); assert.ok(!siteUrlOk(undefined))
})
test('references : 24 caracteres aleatoires, uniques', () => {
  const a = newRef((k) => randomBytes(k)); const b = newRef((k) => randomBytes(k))
  assert.ok(isValidRef(a) && a !== b); assert.ok(!isValidRef('../etc/passwd')); assert.ok(!isValidRef(123))
})
const row = { ref: 'abcdefghijklmnopqrstuvwx', amount: 150000, invoice_id: '777' }
test('statut : paye uniquement si reference, facture ET montant concordent', () => {
  const ok = interpretStatus({ InvoiceId: 777, InvoiceStatus: 'Paid', InvoiceValue: 150000, CustomerReference: row.ref, InvoiceTransactions: [{ PaymentId: '1000200', TransactionStatus: 'Succss' }] }, row)
  assert.deepEqual([ok.status, ok.paymentId], ['paid', '1000200'])
  assert.equal(interpretStatus({ InvoiceId: 777, InvoiceStatus: 'Paid', InvoiceValue: 1, CustomerReference: row.ref }, row).reason, 'amount_mismatch') // montant different : refuse
  assert.equal(interpretStatus({ InvoiceId: 777, InvoiceStatus: 'Paid', InvoiceValue: 150000, CustomerReference: 'otherrefotherrefotherref1' }, row).reason, 'ref_mismatch')
  assert.equal(interpretStatus({ InvoiceId: 999, InvoiceStatus: 'Paid', InvoiceValue: 150000, CustomerReference: row.ref }, row).reason, 'invoice_mismatch')
  assert.equal(interpretStatus(null, row).status, null)
  assert.equal(interpretStatus({ InvoiceId: 777, InvoiceStatus: 'Paid', InvoiceValue: 150000.004, CustomerReference: row.ref }, row).status, 'paid') // tolerance 0,01
})
test('statut : en attente, annule, expire, inconnu', () => {
  const d = (s: string) => interpretStatus({ InvoiceId: 777, InvoiceStatus: s, InvoiceValue: 150000, CustomerReference: row.ref }, row).status
  assert.equal(d('Pending'), 'pending'); assert.equal(d('Canceled'), 'cancelled'); assert.equal(d('Expired'), 'expired'); assert.equal(d('Weird'), null)
  assert.ok(isFinal('paid') && isFinal('cancelled') && !isFinal('pending') && !isFinal('failed'))
})
test('totaux rapports et total par deal', () => {
  const rows: any[] = [
    { deal_id: 'a', amount: 100, status: 'paid', kind: 'deposit' }, { deal_id: 'a', amount: 50, status: 'pending', kind: 'commission' },
    { deal_id: 'b', amount: 25.5, status: 'paid', kind: 'deposit' }, { deal_id: 'a', amount: 999, status: 'failed', kind: 'rent' },
  ]
  const s = summarize(rows)
  assert.deepEqual([s.paid, s.pending, s.paidCount, s.pendingCount, s.byKind.deposit], [125.5, 50, 2, 1, 125.5])
  assert.equal(paidForDeal(rows, 'a'), 100)
})
test('droits : un agent ne voit que les paiements de SES deals ; personne n ecrit depuis le navigateur', () => {
  const data: any = { payments: [{ id: '1', agent: 'Sara' }, { id: '2', agent: 'Ali' }], leads: [], clients: [], deals: [], visits: [], messages: [], owners: [] }
  assert.deepEqual(filterForViewer(data, { role: 'membre', name: 'sara' }).payments.map((p: any) => p.id), ['1'])
  assert.equal(filterForViewer(data, { role: 'directeur_commercial', name: 'x' }).payments.length, 2)
  assert.equal(canWrite('payments', 'create', { role: 'proprietaire', name: 'x' }), true) // le serveur passe par SERVER_ONLY_ENTITIES
  assert.equal(canWrite('payments', 'create', { role: 'membre', name: 'x' }), false)
})
test('textes EN/FR/AR : toutes les cles pay.* existent dans les 3 langues', () => {
  const keys = I18N_KEYS.filter((k) => k.startsWith('pay.'))
  assert.ok(keys.length >= 50)
  for (const k of keys) for (const l of ['en', 'fr', 'ar'] as const) assert.ok(translate(l, k) && translate(l, k) !== k, `${k}/${l}`)
  assert.notEqual(translate('fr', 'pay.btn'), translate('en', 'pay.btn'))
})
test('messages d erreur du serveur traduits (O38) : exacts, dynamiques, inconnus laisses tels quels', () => {
  assert.equal(translateServerError('fr', 'Forbidden'), 'Accès refusé')
  assert.equal(translateServerError('en', 'Forbidden'), 'Forbidden')
  assert.match(translateServerError('ar', 'Monthly AI limit reached (50/50). Contact PiloBrain to increase it.'), /50/)
  assert.equal(translateServerError('fr', 'Something unexpected'), 'Something unexpected')
  for (const k of Object.values(SERVER_ERRORS)) for (const l of ['en', 'fr', 'ar'] as const) assert.ok(translate(l, k) !== k, k + '/' + l)
  assert.ok(Object.keys(SERVER_ERRORS).length >= 60)
})
console.log(`\n${n} groupes de tests OK`)
