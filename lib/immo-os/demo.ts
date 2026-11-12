import type { Data, Lead, Deal, Message, Zone, StageEvent, Payment } from './types'
import { DEFAULT_MUNICIPALITIES } from './types'
import { uid, scoreLead } from './helpers'

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString()

// Donnees d'exemple (Qatar). Les ids sont des UUID : le meme jeu peut etre insere tel quel en base.
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
export function makeDemo(): Data {
  // Hierarchie de demonstration : municipalite > zone > projet (les biens sont les unites)
  const zones: Zone[] = []
  const muni: Record<string, string> = {}
  const zoneId: Record<string, string> = {}
  for (const m of DEFAULT_MUNICIPALITIES) {
    const mz: Zone = { id: uid(), level: 'municipality', name: m.name, name_ar: m.name_ar, parent_id: null, created_at: daysAgo(90) }
    zones.push(mz); muni[m.name] = mz.id
    for (const z of m.zones) { const zz: Zone = { id: uid(), level: 'zone', name: z.name, name_ar: z.name_ar, parent_id: mz.id, created_at: daysAgo(90) }; zones.push(zz); zoneId[z.name] = zz.id }
  }
  const project = (name: string, zone: string): string => { const r: Zone = { id: uid(), level: 'project', name, name_ar: null, parent_id: zoneId[zone], created_at: daysAgo(80) }; zones.push(r); return r.id }
  const projectId: Record<string, string> = { 'Porto Arabia': project('Porto Arabia', 'The Pearl'), 'Marina District': project('Marina District', 'Lusail'), 'Fox Hills': project('Fox Hills', 'Lusail') }
  const o = ['Khalid Al Thani', 'Noor Al Mannai', 'Youssef Haddad', 'Fatima Al Kuwari', 'Omar Al Naimi'].map((name, i) => ({
    id: uid(), name, phone: `+9745${i}123456`, email: `${name.split(' ')[0].toLowerCase()}@mail.qa`, notes: null, responsible: ['Ahmed Al Saadi', 'Sara Khalid', 'Laila Hassan', null, 'Mohamed Ali'][i] as string | null, last_contact: i === 3 ? null : daysAgo([2, 9, 20, 0, 45][i]), created_at: daysAgo(60 - i * 5),
  }))
  const P = (title: string, type: any, listing: any, area: string, price: number, beds: number, baths: number, size: number, oi: number, featured = false, status: any = 'available') => ({
    id: uid(), title, type, listing, status, area, price, beds, baths, size_m2: size, owner_id: o[oi].id,
    image_url: null, description: `${title} in ${area}. Well-maintained, close to amenities.`, featured, created_at: daysAgo(Math.floor(Math.random() * 330) + 1),
  })
  const properties = [
    P('Luxury Villa', 'villa', 'sale', 'The Pearl', 3_200_000, 5, 6, 450, 0, true),
    P('Seafront Apartment', 'apartment', 'sale', 'Lusail', 1_800_000, 2, 3, 120, 1, true),
    P('Family Villa', 'villa', 'rent', 'West Bay Lagoon', 22_000, 4, 5, 420, 2, true),
    P('Modern Townhouse', 'townhouse', 'sale', 'Al Khor', 1_600_000, 3, 3, 300, 3),
    P('Corner Office', 'office', 'sale', 'West Bay', 1_600_000, 1, 2, 200, 4, true),
    P('City View Apartment', 'apartment', 'sale', 'Al Sadd', 950_000, 2, 2, 105, 1),
    P('Studio Apartment', 'apartment', 'rent', 'The Pearl', 6_500, 1, 1, 55, 0),
    P('Premium Villa', 'villa', 'sale', 'Al Dafna', 5_400_000, 6, 7, 620, 2),
    P('Retail Shop', 'shop', 'rent', 'Msheireb', 18_000, 0, 1, 90, 4),
    P('Garden Apartment', 'apartment', 'sale', 'Lusail', 1_250_000, 3, 3, 160, 3),
    P('Sold Villa', 'villa', 'sale', 'The Pearl', 4_500_000, 5, 6, 480, 0, false, 'sold'),
  ]
  // Regime de propriete, unites rattachees a la hierarchie, photos (vides en demo : l'illustration est utilisee)
  const placement: Record<string, { zone: string; tenure: 'freehold' | 'usufruct' | null; years?: number; unit?: string }> = {
    'Luxury Villa': { zone: 'Porto Arabia', tenure: 'freehold', unit: 'V-12' }, 'Seafront Apartment': { zone: 'Marina District', tenure: 'freehold', unit: 'A-804' },
    'Family Villa': { zone: 'West Bay Lagoon', tenure: 'usufruct', years: 99 }, 'Modern Townhouse': { zone: 'Al Khor', tenure: 'freehold' },
    'Corner Office': { zone: 'West Bay', tenure: 'usufruct', years: 50, unit: 'Floor 14' }, 'City View Apartment': { zone: 'Al Sadd', tenure: null },
    'Studio Apartment': { zone: 'Porto Arabia', tenure: 'freehold', unit: 'S-310' }, 'Premium Villa': { zone: 'Al Dafna', tenure: 'freehold' },
    'Retail Shop': { zone: 'Msheireb', tenure: null }, 'Garden Apartment': { zone: 'Fox Hills', tenure: 'usufruct', years: 99, unit: 'G-02' }, 'Sold Villa': { zone: 'The Pearl', tenure: 'freehold' },
  }
  properties.forEach((p: any) => {
    const pl = placement[p.title]
    p.photos = []
    if (!pl) return
    p.zone_id = projectId[pl.zone] ?? zoneId[pl.zone] ?? null
    p.tenure = pl.tenure
    p.usufruct_years = pl.tenure === 'usufruct' ? pl.years ?? 99 : null
    p.unit_no = pl.unit ?? null
  })
  const clients = [
    ['Mohammed Al Thani', 'buyer', 3_000_000, 'Lusail, The Pearl'], ['Sara Khalid', 'investor', 2_000_000, 'The Pearl'],
    ['John Smith', 'tenant', 15_000, 'West Bay'], ['Laila Hassan', 'buyer', 1_200_000, 'Al Dafna'], ['Khalid Al Thani', 'seller', 0, 'Lusail'],
  ].map(([name, kind, budget, areas], i) => ({
    id: uid(), name: name as string, phone: `+9745${i}765432`, email: null, nationality: i % 2 ? 'British' : 'Qatari',
    kind: kind as any, budget: budget as number, preferred_areas: areas as string, notes: null, agent: ['Ahmed Al Saadi', 'Sara Khalid'][i % 2], created_at: daysAgo(50 - i * 6),
  }))
  const L = (name: string, interest: string, pi: number | null, budget: number, status: any, source: any, agent: string, d: number, h = 0): Lead => {
    const l = { id: uid(), name, phone: `+9745${Math.floor(Math.random() * 9000000 + 1000000)}`, email: null, interest, property_id: pi === null ? null : properties[pi].id, budget, status, source, agent, score: 50, notes: null, last_contact: daysAgo(d, h), created_at: daysAgo(d + 5) } as Lead
    l.score = scoreLead(l, properties)
    return l
  }
  const leads = [
    L('Mohammed Al Thani', 'Villa - Lusail', 0, 3_000_000, 'negotiation', 'whatsapp', 'Ahmed Al Saadi', 0, 2),
    L('Sara Khalid', 'Apartment - The Pearl', 1, 2_000_000, 'qualified', 'website', 'Sara Khalid', 0, 4),
    L('John Smith', 'Office - West Bay', 4, 1_500_000, 'viewing', 'portal', 'John Smith', 1),
    L('Laila Hassan', 'Villa - Al Dafna', 7, 1_200_000, 'new', 'whatsapp', 'Laila Hassan', 1, 3),
    L('Khalid Al Thani', 'Townhouse - Lusail', 3, 950_000, 'negotiation', 'referral', 'Mohamed Ali', 2),
    L('Rania Mansour', 'Apartment - Al Sadd', 5, 900_000, 'new', 'website', 'Ahmed Al Saadi', 0, 1),
    L('David Miller', 'Villa rental - West Bay Lagoon', 2, 25_000, 'viewing', 'whatsapp', 'John Smith', 2),
    L('Aisha Al Naimi', 'Apartment - Lusail', 9, 1_300_000, 'qualified', 'referral', 'Sara Khalid', 3),
    L('Peter Novak', 'Studio - The Pearl', 6, 7_000, 'won', 'portal', 'Laila Hassan', 12),
    L('Hassan Ibrahim', 'Shop - Msheireb', 8, 20_000, 'lost', 'walk_in', 'Mohamed Ali', 20),
  ]
  const D = (title: string, pi: number, party: string, kind: any, value: number, status: any, agent: string, d: number): Deal => ({
    id: uid(), title, property_id: properties[pi].id, party_name: party, kind, value, commission_pct: kind === 'sale' ? 2 : 8, status, agent,
    closed_at: status === 'closed' ? daysAgo(d) : null, created_at: daysAgo(d + 10),
  })
  const deals = [
    D('Villa - The Pearl', 10, 'Omar Fahad', 'sale', 4_500_000, 'closed', 'Ahmed Al Saadi', 8),
    D('Studio - The Pearl', 6, 'Peter Novak', 'rent', 78_000, 'closed', 'Laila Hassan', 12),
    D('Apartment - Lusail', 1, 'Sara Khalid', 'sale', 1_800_000, 'offer', 'Sara Khalid', 3),
    D('Villa - Lusail', 0, 'Mohammed Al Thani', 'sale', 3_100_000, 'contract', 'Ahmed Al Saadi', 2),
    D('Townhouse - Al Khor', 3, 'Khalid Al Thani', 'sale', 1_550_000, 'negotiation', 'Mohamed Ali', 1),
    D('Apartment - Al Sadd', 5, 'Rania Mansour', 'sale', 940_000, 'closed', 'John Smith', 35),
    D('Office - West Bay', 4, 'John Smith', 'sale', 1_600_000, 'closed', 'John Smith', 60),
  ]
  const M = (n: string, p: string, dir: 'in' | 'out', body: string, unread: boolean, d: number, h: number): Message => ({
    id: uid(), contact_name: n, contact_phone: p, direction: dir, body, unread, created_at: daysAgo(d, h),
  })
  const messages = [
    M('Mohammed Al Thani', leads[0].phone!, 'in', "Hi, I'm interested in the villa in Lusail.", false, 0, 5),
    M('Mohammed Al Thani', leads[0].phone!, 'out', 'Hello Mohammed! The villa is available. Would you like a viewing this week?', false, 0, 4),
    M('Mohammed Al Thani', leads[0].phone!, 'in', 'Yes, Thursday afternoon works. Can you also send the floor plan?', true, 0, 2),
    M('Sara Khalid', leads[1].phone!, 'in', 'Can you send more photos?', true, 0, 3),
    M('John Smith', leads[2].phone!, 'in', 'Is the office available for rent?', true, 1, 2),
    M('Laila Hassan', leads[3].phone!, 'in', 'Thank you for your help!', false, 1, 6),
    M('Khalid Al Thani', leads[4].phone!, 'in', 'When can we schedule a viewing?', true, 2, 1),
  ]
  const at = (d: number, h: number) => { const x = new Date(Date.now() + d * 86400000); x.setHours(h, 0, 0, 0); return x.toISOString() }
  const visits = [
    { id: uid(), property_id: properties[0].id, lead_id: leads[0].id, contact_name: leads[0].name, contact_phone: leads[0].phone, agent: leads[0].agent, starts_at: at(1, 16), duration_min: 45, category: 'viewing', status: 'scheduled', notes: 'Wants the floor plan', calendar_event_id: null, created_at: daysAgo(1) },
    { id: uid(), property_id: properties[4].id, lead_id: leads[2].id, contact_name: leads[2].name, contact_phone: leads[2].phone, agent: leads[2].agent, starts_at: at(2, 11), duration_min: 30, category: 'meeting', status: 'scheduled', notes: null, calendar_event_id: null, created_at: daysAgo(1) },
    { id: uid(), property_id: properties[2].id, lead_id: leads[6].id, contact_name: leads[6].name, contact_phone: leads[6].phone, agent: leads[6].agent, starts_at: at(-2, 10), duration_min: 45, category: 'viewing', status: 'done', notes: 'Liked the garden', calendar_event_id: null, created_at: daysAgo(4) },
    { id: uid(), property_id: null, lead_id: null, contact_name: 'Weekly sales meeting', contact_phone: null, agent: 'Ahmed Al Saadi', starts_at: at(3, 9), duration_min: 60, category: 'team', status: 'scheduled', notes: 'Pipeline review with the whole team', calendar_event_id: null, created_at: daysAgo(1) },
  ] as Data['visits']
  // Equipe de demonstration (ids alignes sur le roster du store : demo-m0..m4) : Ahmed = directeur, Sara = chef d'equipe
  const hierarchy = [
    { id: uid(), member_id: 'demo-m1', is_lead: true, reports_to: 'demo-m0', created_at: daysAgo(30) },
    { id: uid(), member_id: 'demo-m3', is_lead: false, reports_to: 'demo-m1', created_at: daysAgo(30) },
    { id: uid(), member_id: 'demo-m4', is_lead: false, reports_to: 'demo-m1', created_at: daysAgo(30) },
    { id: uid(), member_id: 'demo-m2', is_lead: false, reports_to: 'demo-m0', created_at: daysAgo(30) },
  ]
  // Leads orphelins de demonstration : agent parti (absent de l'equipe)
  leads.slice(-2).forEach((l: any) => { l.agent = 'Youssef Nasser'; if (['won', 'lost'].includes(l.status)) l.status = 'qualified' })
  const activity = [
    { id: uid(), actor_id: 'demo-m1', actor_name: 'Sara Khalid', actor_role: 'membre', action: 'update', entity: 'leads', record_id: null, label: leads[0]?.name ?? 'Lead', details: { fields: ['status', 'notes'] }, created_at: hoursAgo(3) },
    { id: uid(), actor_id: 'demo-m3', actor_name: 'Laila Hassan', actor_role: 'membre', action: 'create', entity: 'clients', record_id: null, label: 'Fatima Al Kuwari', details: {}, created_at: hoursAgo(26) },
    { id: uid(), actor_id: 'demo-m0', actor_name: 'Ahmed Al Saadi', actor_role: 'directeur_commercial', action: 'update', entity: 'properties', record_id: null, label: 'Luxury Villa', details: { fields: ['price', 'photos'] }, created_at: hoursAgo(50) },
  ]
  // Lot 4 : exemples de resultat du contact, de biens envoyes et d'historique d'etapes
  const outcomes = [{ id: uid(), contact_name: leads[0].name, contact_phone: leads[0].phone, outcome: 'viewing_booked' as const, note: 'Thursday 4 pm', agent: leads[0].agent, created_at: daysAgo(0, 3) }]
  const sends = [{ id: uid(), property_id: properties[0].id, property_title: properties[0].title, contact_name: leads[0].name, contact_phone: leads[0].phone, agent: leads[0].agent, channel: 'whatsapp', created_at: daysAgo(1, 2) }]
  const stages: StageEvent[] = deals.map((x): StageEvent => ({ id: uid(), kind: 'deal', record_id: x.id, record_name: x.title, from_status: null, to_status: 'negotiation', by_name: x.agent, auto: [], created_at: x.created_at })).concat(
    deals.filter((x) => x.status !== 'negotiation').map((x): StageEvent => ({ id: uid(), kind: 'deal', record_id: x.id, record_name: x.title, from_status: 'negotiation', to_status: x.status, by_name: x.agent, auto: [], created_at: daysAgo(1) })))
  // Lot 9 : exemples de paiements en ligne (un acompte encaisse, une commission en attente)
  const closedDeal = deals.find((x) => x.status === 'closed') ?? deals[0]
  const openDeal = deals.find((x) => x.status !== 'closed' && x.status !== 'cancelled') ?? deals[0]
  const payments: Payment[] = [
    { id: uid(), deal_id: closedDeal.id, contact_name: closedDeal.party_name ?? closedDeal.title, contact_phone: null, agent: closedDeal.agent ?? null, kind: 'deposit', amount: Math.round((closedDeal.value || 100000) * 0.05), currency: 'QAR', description: 'Reservation deposit', status: 'paid', pay_url: 'https://pay.example.demo/paid', paid_at: daysAgo(3), created_at: daysAgo(4), created_by: closedDeal.agent ?? null },
    { id: uid(), deal_id: openDeal.id, contact_name: openDeal.party_name ?? openDeal.title, contact_phone: null, agent: openDeal.agent ?? null, kind: 'deposit', amount: Math.round((openDeal.value || 100000) * 0.05), currency: 'QAR', description: 'Reservation deposit', status: 'pending', pay_url: 'https://pay.example.demo/pending', paid_at: null, created_at: daysAgo(0, 2), created_by: openDeal.agent ?? null },
  ]
  return { hierarchy, activity, assignments: [], zones, owners: o, properties, clients, leads, deals, messages, ads: [], visits, outcomes, sends, stages, payments }
}
