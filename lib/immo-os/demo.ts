import type { Data, Lead, Deal, Message } from './types'
import { uid, scoreLead } from './helpers'

const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString()

// Donnees d'exemple (Qatar). Les ids sont des UUID : le meme jeu peut etre insere tel quel en base.
export function makeDemo(): Data {
  const o = ['Khalid Al Thani', 'Noor Al Mannai', 'Youssef Haddad', 'Fatima Al Kuwari', 'Omar Al Naimi'].map((name, i) => ({
    id: uid(), name, phone: `+9745${i}123456`, email: `${name.split(' ')[0].toLowerCase()}@mail.qa`, notes: null, created_at: daysAgo(60 - i * 5),
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
  ] as Data['visits']
  return { owners: o, properties, clients, leads, deals, messages, ads: [], visits }
}
