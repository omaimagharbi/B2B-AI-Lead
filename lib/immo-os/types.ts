// Real Estate OS : types, constantes et schema (liste blanche des champs par entite).
// Partage entre le navigateur (formulaires) et les routes API (validation).

export type Listing = 'sale' | 'rent'
export type PropType = 'apartment' | 'villa' | 'townhouse' | 'office' | 'shop' | 'land'
export type PropStatus = 'available' | 'reserved' | 'sold' | 'rented'
export type LeadStatus = 'new' | 'qualified' | 'viewing' | 'negotiation' | 'won' | 'lost'
export type LeadSource = 'whatsapp' | 'website' | 'referral' | 'portal' | 'walk_in' | 'prospecting'
export type ClientKind = 'buyer' | 'seller' | 'tenant' | 'investor'
export type DealStatus = 'negotiation' | 'offer' | 'contract' | 'closed' | 'cancelled'

export type Owner = { id: string; name: string; phone?: string | null; email?: string | null; notes?: string | null; created_at: string }
export type Property = {
  id: string; title: string; type: PropType; listing: Listing; status: PropStatus; area?: string | null
  price: number; beds: number; baths: number; size_m2: number; owner_id?: string | null
  image_url?: string | null; description?: string | null; featured: boolean; created_at: string
}
export type RClient = {
  id: string; name: string; phone?: string | null; email?: string | null; nationality?: string | null
  kind: ClientKind; budget: number; preferred_areas?: string | null; notes?: string | null; agent?: string | null; created_at: string
}
export type Lead = {
  id: string; name: string; phone?: string | null; email?: string | null; interest?: string | null
  property_id?: string | null; budget: number; status: LeadStatus; source: LeadSource
  agent?: string | null; score: number; notes?: string | null; last_contact: string; created_at: string
}
export type Deal = {
  id: string; title: string; property_id?: string | null; party_name?: string | null; kind: Listing
  value: number; commission_pct: number; status: DealStatus; agent?: string | null
  closed_at?: string | null; created_at: string
}
export type Message = {
  id: string; contact_name: string; contact_phone?: string | null; direction: 'in' | 'out'
  body: string; unread: boolean; created_at: string
}
export type Ad = {
  id: string; property_id?: string | null; channel: string; language: string; tone?: string | null
  content: string; status: 'draft' | 'published'; created_at: string
}

export type VisitStatus = 'scheduled' | 'done' | 'cancelled' | 'no_show'
export type VisitCategory = 'viewing' | 'meeting' | 'signing' | 'call' | 'followup' | 'other'
export type Visit = {
  id: string; category?: VisitCategory | null; property_id?: string | null; lead_id?: string | null; contact_name: string; contact_phone?: string | null
  agent?: string | null; starts_at: string; duration_min: number; status: VisitStatus; notes?: string | null
  calendar_event_id?: string | null; created_at: string
}

export type Entity = 'owners' | 'properties' | 'clients' | 'leads' | 'deals' | 'messages' | 'ads' | 'visits'

export const ENTITIES: Record<Entity, { table: string; fields: string[] }> = {
  owners: { table: 're_owners', fields: ['name', 'phone', 'email', 'notes'] },
  properties: {
    table: 're_properties',
    fields: ['title', 'type', 'listing', 'status', 'area', 'price', 'beds', 'baths', 'size_m2', 'owner_id', 'image_url', 'description', 'featured'],
  },
  clients: { table: 're_clients', fields: ['name', 'phone', 'email', 'nationality', 'kind', 'budget', 'preferred_areas', 'notes', 'agent'] },
  leads: {
    table: 're_leads',
    fields: ['name', 'phone', 'email', 'interest', 'property_id', 'budget', 'status', 'source', 'agent', 'score', 'notes', 'last_contact'],
  },
  deals: { table: 're_deals', fields: ['title', 'property_id', 'party_name', 'kind', 'value', 'commission_pct', 'status', 'agent', 'closed_at'] },
  messages: { table: 're_messages', fields: ['contact_name', 'contact_phone', 'direction', 'body', 'unread'] },
  ads: { table: 're_ads', fields: ['property_id', 'channel', 'language', 'tone', 'content', 'status'] },
  visits: { table: 're_visits', fields: ['property_id', 'lead_id', 'contact_name', 'contact_phone', 'agent', 'starts_at', 'duration_min', 'status', 'notes', 'category'] },
}
export const ENTITY_KEYS = Object.keys(ENTITIES) as Entity[]

export type Data = {
  owners: Owner[]; properties: Property[]; clients: RClient[]; leads: Lead[]
  deals: Deal[]; messages: Message[]; ads: Ad[]; visits: Visit[]
}
export const EMPTY_DATA: Data = { owners: [], properties: [], clients: [], leads: [], deals: [], messages: [], ads: [], visits: [] }

export const AREAS = ['The Pearl', 'Lusail', 'West Bay', 'West Bay Lagoon', 'Al Sadd', 'Al Dafna', 'Al Khor', 'Al Rayyan', 'Msheireb', 'Old Airport']
export const PROP_TYPES: { v: PropType; l: string }[] = [
  { v: 'apartment', l: 'Apartment' }, { v: 'villa', l: 'Villa' }, { v: 'townhouse', l: 'Townhouse' },
  { v: 'office', l: 'Office' }, { v: 'shop', l: 'Shop' }, { v: 'land', l: 'Land' },
]
export const LEAD_COLUMNS: { v: LeadStatus; l: string; color: string }[] = [
  { v: 'new', l: 'New', color: '#3B82F6' },
  { v: 'qualified', l: 'Qualified', color: '#10B981' },
  { v: 'viewing', l: 'Viewing', color: '#8B5CF6' },
  { v: 'negotiation', l: 'Negotiation', color: '#F59E0B' },
  { v: 'won', l: 'Won', color: '#16A34A' },
  { v: 'lost', l: 'Lost', color: '#EF4444' },
]
export const SOURCES: { v: LeadSource; l: string }[] = [
  { v: 'whatsapp', l: 'WhatsApp' }, { v: 'website', l: 'Website' }, { v: 'referral', l: 'Referral' },
  { v: 'portal', l: 'Property portal' }, { v: 'walk_in', l: 'Walk-in' }, { v: 'prospecting', l: 'B2B prospecting' },
]
export const CLIENT_KINDS: { v: ClientKind; l: string }[] = [
  { v: 'buyer', l: 'Buyer' }, { v: 'seller', l: 'Seller' }, { v: 'tenant', l: 'Tenant' }, { v: 'investor', l: 'Investor' },
]
export const DEAL_STATUSES: { v: DealStatus; l: string; color: string }[] = [
  { v: 'negotiation', l: 'Negotiation', color: '#F59E0B' },
  { v: 'offer', l: 'Offer', color: '#3B82F6' },
  { v: 'contract', l: 'Contract', color: '#8B5CF6' },
  { v: 'closed', l: 'Closed', color: '#16A34A' },
  { v: 'cancelled', l: 'Cancelled', color: '#EF4444' },
]
export const CHANNELS = ['instagram', 'facebook', 'whatsapp', 'property_portal', 'linkedin', 'email']
export const AGENTS_DEFAULT = ['Ahmed Al Saadi', 'Sara Khalid', 'John Smith', 'Laila Hassan', 'Mohamed Ali']

export const VISIT_STATUSES: { v: VisitStatus; l: string; color: string }[] = [
  { v: 'scheduled', l: 'Scheduled', color: '#2563EB' }, { v: 'done', l: 'Done', color: '#16A34A' },
  { v: 'cancelled', l: 'Cancelled', color: '#64748B' }, { v: 'no_show', l: 'No-show', color: '#EF4444' },
]

// Categories d'agenda (couleurs type Google Calendar). Le texte est fonce sur fond clair pour rester lisible.
export const VISIT_CATEGORIES: { v: VisitCategory; l: string; color: string; bg: string }[] = [
  { v: 'viewing', l: 'Viewing', color: '#1D4ED8', bg: '#DBEAFE' },
  { v: 'meeting', l: 'Client meeting', color: '#6D28D9', bg: '#EDE9FE' },
  { v: 'signing', l: 'Contract signing', color: '#15803D', bg: '#DCFCE7' },
  { v: 'call', l: 'Call', color: '#B45309', bg: '#FEF3C7' },
  { v: 'followup', l: 'Follow-up', color: '#0F766E', bg: '#CCFBF1' },
  { v: 'other', l: 'Other', color: '#475569', bg: '#E2E8F0' },
]
