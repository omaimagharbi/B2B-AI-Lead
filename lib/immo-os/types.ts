// Real Estate OS : types, constantes et schema (liste blanche des champs par entite).
// Partage entre le navigateur (formulaires) et les routes API (validation).

export type Listing = 'sale' | 'rent'
export type PropType =
  | 'apartment' | 'villa' | 'townhouse' | 'office' | 'shop' | 'land'
  | 'penthouse' | 'duplex' | 'compound' | 'building' | 'showroom' | 'warehouse' | 'farm' | 'labour_camp'
  | 'hotel' | 'industrial' | 'mixed_use'
export type Tenure = 'freehold' | 'usufruct'
export type ZoneLevel = 'municipality' | 'zone' | 'project'
export type PropStatus = 'available' | 'reserved' | 'sold' | 'rented'
export type LeadStatus = 'new' | 'qualified' | 'viewing' | 'negotiation' | 'won' | 'lost'
export type LeadSource = 'whatsapp' | 'website' | 'referral' | 'portal' | 'walk_in' | 'prospecting'
export type ClientKind = 'buyer' | 'seller' | 'tenant' | 'investor'
export type DealStatus = 'negotiation' | 'offer' | 'contract' | 'closed' | 'cancelled'

// Lot 5 : consentement et "ne plus contacter" (migration 78) sur leads, clients et proprietaires
export type Compliance = {
  do_not_contact?: boolean; do_not_contact_at?: string | null; do_not_contact_reason?: string | null
  consent_at?: string | null; consent_source?: string | null; consent_version?: string | null
}
export type Owner = Compliance & {
  id: string; name: string; phone?: string | null; email?: string | null; notes?: string | null
  responsible?: string | null; last_contact?: string | null; created_at: string
}
export type Hierarchy = { id: string; member_id: string; is_lead: boolean; reports_to?: string | null; created_at: string }
export type Activity = { id: string; actor_id?: string | null; actor_name: string; actor_role?: string | null; action: string; entity?: string | null; record_id?: string | null; label?: string | null; details?: Record<string, any> | null; created_at: string }
export type Assignment = { id: string; lead_id: string; lead_name?: string | null; from_agent?: string | null; to_agent?: string | null; by_name?: string | null; reason?: string | null; created_at: string }
export type Zone = { id: string; level: ZoneLevel; name: string; name_ar?: string | null; parent_id?: string | null; created_at: string }
export type Property = {
  id: string; title: string; type: PropType; listing: Listing; status: PropStatus; area?: string | null
  price: number; beds: number; baths: number; size_m2: number; owner_id?: string | null
  image_url?: string | null; photos?: string[] | null; description?: string | null; featured: boolean
  commission_pct?: number | null; tenure?: Tenure | null; usufruct_years?: number | null; zone_id?: string | null; unit_no?: string | null; created_at: string
}
export type RClient = Compliance & {
  id: string; name: string; phone?: string | null; email?: string | null; nationality?: string | null
  kind: ClientKind; budget: number; preferred_areas?: string | null; notes?: string | null; agent?: string | null; beds_wanted?: number | null; created_at: string
}
export type Lead = Compliance & {
  id: string; name: string; phone?: string | null; email?: string | null; interest?: string | null
  property_id?: string | null; budget: number; status: LeadStatus; source: LeadSource
  agent?: string | null; score: number; notes?: string | null; last_contact: string; beds_wanted?: number | null; created_at: string
}
export type Deal = {
  id: string; title: string; property_id?: string | null; party_name?: string | null; kind: Listing
  value: number; commission_pct: number; status: DealStatus; agent?: string | null
  closed_at?: string | null; created_at: string
}
export type Message = {
  id: string; contact_name: string; contact_phone?: string | null; direction: 'in' | 'out'
  body: string; unread: boolean; created_at: string
  media_url?: string | null; media_type?: 'image' | 'document' | 'audio' | 'video' | null; media_name?: string | null // lot 6b
  channel?: 'greenapi' | 'meta'; wa_status?: string | null; wa_error?: string | null // lot 6a : canal et statut de livraison (Meta)
  property_id?: string | null; property_auto?: boolean // lot 4 : bien dont parle le message (detecte automatiquement ou choisi a la main)
}
// Lot 4
export type OutcomeCode = 'callback' | 'viewing_booked' | 'offer_made' | 'info_sent' | 'no_answer' | 'not_interested' | 'wrong_number' | 'other'
export type Outcome = { id: string; contact_name: string; contact_phone?: string | null; outcome: OutcomeCode; note?: string | null; agent?: string | null; created_at: string }
export type Send = { id: string; property_id?: string | null; property_title?: string | null; contact_name: string; contact_phone?: string | null; agent?: string | null; channel?: string | null; created_at: string }
export type StageEvent = { id: string; kind: 'lead' | 'deal'; record_id: string; record_name?: string | null; from_status?: string | null; to_status: string; by_name?: string | null; auto?: string[] | null; created_at: string }
export type Ad = {
  id: string; property_id?: string | null; channel: string; language: string; tone?: string | null
  content: string; status: 'draft' | 'published'; created_at: string
}

export type VisitStatus = 'scheduled' | 'done' | 'cancelled' | 'no_show'
export type VisitCategory = 'viewing' | 'meeting' | 'signing' | 'call' | 'followup' | 'team' | 'other'
export type Visit = {
  id: string; category?: VisitCategory | null; property_id?: string | null; lead_id?: string | null; contact_name: string; contact_phone?: string | null
  agent?: string | null; starts_at: string; duration_min: number; status: VisitStatus; notes?: string | null
  calendar_event_id?: string | null; created_at: string
}

export type Entity = 'hierarchy' | 'zones' | 'owners' | 'properties' | 'clients' | 'leads' | 'deals' | 'messages' | 'ads' | 'visits' | 'outcomes' | 'sends' | 'stages'

export const ENTITIES: Record<Entity, { table: string; fields: string[] }> = {
  hierarchy: { table: 're_hierarchy', fields: ['member_id', 'is_lead', 'reports_to'] },
  zones: { table: 're_zones', fields: ['level', 'name', 'name_ar', 'parent_id'] },
  owners: { table: 're_owners', fields: ['name', 'phone', 'email', 'notes', 'responsible', 'last_contact', 'do_not_contact'] },
  properties: {
    table: 're_properties',
    fields: ['title', 'type', 'listing', 'status', 'area', 'price', 'beds', 'baths', 'size_m2', 'owner_id', 'image_url', 'photos', 'description', 'featured', 'tenure', 'usufruct_years', 'zone_id', 'unit_no', 'commission_pct'],
  },
  clients: { table: 're_clients', fields: ['name', 'phone', 'email', 'nationality', 'kind', 'budget', 'preferred_areas', 'notes', 'agent', 'beds_wanted', 'do_not_contact'] },
  leads: {
    table: 're_leads',
    fields: ['name', 'phone', 'email', 'interest', 'property_id', 'budget', 'status', 'source', 'agent', 'score', 'notes', 'last_contact', 'beds_wanted', 'do_not_contact'],
  },
  deals: { table: 're_deals', fields: ['title', 'property_id', 'party_name', 'kind', 'value', 'commission_pct', 'status', 'agent', 'closed_at'] },
  messages: { table: 're_messages', fields: ['contact_name', 'contact_phone', 'direction', 'body', 'unread', 'property_id', 'property_auto'] },
  ads: { table: 're_ads', fields: ['property_id', 'channel', 'language', 'tone', 'content', 'status'] },
  visits: { table: 're_visits', fields: ['property_id', 'lead_id', 'contact_name', 'contact_phone', 'agent', 'starts_at', 'duration_min', 'status', 'notes', 'category'] },
  outcomes: { table: 're_outcomes', fields: ['contact_name', 'contact_phone', 'outcome', 'note', 'agent'] },
  // sends et stages sont ecrits par le serveur uniquement (api/whatsapp.ts, api/deal-steps.ts) : lecture seule depuis le navigateur
  sends: { table: 're_sends', fields: ['property_id', 'property_title', 'contact_name', 'contact_phone', 'agent', 'channel'] },
  stages: { table: 're_stages', fields: ['kind', 'record_id', 'record_name', 'from_status', 'to_status', 'by_name', 'auto'] },
}
export const SERVER_ONLY_ENTITIES: Entity[] = ['sends', 'stages']
export const ENTITY_KEYS = Object.keys(ENTITIES) as Entity[]

export type Data = {
  demoTeam?: { id: string; name: string; role: string; photo: string | null; phone: string | null }[]
  activity?: Activity[]; assignments?: Assignment[] // mode demo seulement (en reel : lus via ?r=activity / ?r=assignments)
  hierarchy: Hierarchy[]; zones: Zone[]; owners: Owner[]; properties: Property[]; clients: RClient[]; leads: Lead[]
  deals: Deal[]; messages: Message[]; ads: Ad[]; visits: Visit[]; outcomes: Outcome[]; sends: Send[]; stages: StageEvent[]
}
export const EMPTY_DATA: Data = { hierarchy: [], zones: [], owners: [], properties: [], clients: [], leads: [], deals: [], messages: [], ads: [], visits: [], outcomes: [], sends: [], stages: [] }

// Lot 4 : resultat du contact enregistre sur une conversation
export const OUTCOMES: { v: OutcomeCode; color: string }[] = [
  { v: 'callback', color: '#2563EB' }, { v: 'viewing_booked', color: '#16A34A' }, { v: 'offer_made', color: '#7C3AED' }, { v: 'info_sent', color: '#0891B2' },
  { v: 'no_answer', color: '#64748B' }, { v: 'not_interested', color: '#EF4444' }, { v: 'wrong_number', color: '#B45309' }, { v: 'other', color: '#475569' },
]

export const AREAS = ['The Pearl', 'Lusail', 'West Bay', 'West Bay Lagoon', 'Al Sadd', 'Al Dafna', 'Al Khor', 'Al Rayyan', 'Msheireb', 'Old Airport']
export const PROP_TYPES: { v: PropType; l: string }[] = [
  { v: 'apartment', l: 'Apartment' }, { v: 'villa', l: 'Villa' }, { v: 'townhouse', l: 'Townhouse' },
  { v: 'office', l: 'Office' }, { v: 'shop', l: 'Shop' }, { v: 'land', l: 'Land' },
  { v: 'penthouse', l: 'Penthouse' }, { v: 'duplex', l: 'Duplex' }, { v: 'compound', l: 'Compound' }, { v: 'building', l: 'Building' },
  { v: 'showroom', l: 'Showroom' }, { v: 'warehouse', l: 'Warehouse' }, { v: 'farm', l: 'Farm' }, { v: 'labour_camp', l: 'Labour camp' },
  { v: 'hotel', l: 'Hotel / hospitality' }, { v: 'industrial', l: 'Industrial' }, { v: 'mixed_use', l: 'Mixed use' },
]
export const TENURES: Tenure[] = ['freehold', 'usufruct']
export const MAX_PHOTOS = 12
// Niveaux de la hierarchie configurable : municipalite > zone > projet (l'unite = le bien)
export const ZONE_LEVELS: ZoneLevel[] = ['municipality', 'zone', 'project']
export const PARENT_LEVEL: Record<ZoneLevel, ZoneLevel | null> = { municipality: null, zone: 'municipality', project: 'zone' }
// Les 8 municipalites du Qatar et leurs zones usuelles (modele propose en un clic dans Parametres)
export const DEFAULT_MUNICIPALITIES: { name: string; name_ar: string; zones: { name: string; name_ar: string }[] }[] = [
  { name: 'Doha', name_ar: 'الدوحة', zones: [
    { name: 'The Pearl', name_ar: 'اللؤلؤة' }, { name: 'West Bay', name_ar: 'الخليج الغربي' }, { name: 'West Bay Lagoon', name_ar: 'لاجون الخليج الغربي' },
    { name: 'Al Sadd', name_ar: 'السد' }, { name: 'Al Dafna', name_ar: 'الدفنة' }, { name: 'Msheireb', name_ar: 'مشيرب' }, { name: 'Old Airport', name_ar: 'المطار القديم' } ] },
  { name: 'Al Daayen', name_ar: 'الضعاين', zones: [{ name: 'Lusail', name_ar: 'لوسيل' }] },
  { name: 'Al Rayyan', name_ar: 'الريان', zones: [{ name: 'Al Rayyan', name_ar: 'الريان' }] },
  { name: 'Al Khor', name_ar: 'الخور والذخيرة', zones: [{ name: 'Al Khor', name_ar: 'الخور' }] },
  { name: 'Al Wakrah', name_ar: 'الوكرة', zones: [] },
  { name: 'Umm Salal', name_ar: 'أم صلال', zones: [] },
  { name: 'Al Shamal', name_ar: 'الشمال', zones: [] },
  { name: 'Al Shahaniya', name_ar: 'الشحانية', zones: [] },
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
  { v: 'team', l: 'Team meeting', color: '#BE185D', bg: '#FCE7F3' },
  { v: 'other', l: 'Other', color: '#475569', bg: '#E2E8F0' },
]
