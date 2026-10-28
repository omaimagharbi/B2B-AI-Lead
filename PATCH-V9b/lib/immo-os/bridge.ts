import { normalizePhone } from './capture-pure'
import { sameNumber } from './inbound-pure'

export type Target = { id: string; nom: string; entreprise_ou_objectif: string | null; poste_ou_budget: string | null; telephone: string | null; email: string | null; country: string | null; statut?: string | null }
export type ExistingLead = { phone: string | null; origin_target_id: string | null }

export function targetToLead(t: Target, defaultDial = '974') {
  const phone = t.telephone ? normalizePhone(t.telephone, defaultDial) : null
  const interest = [t.poste_ou_budget, t.entreprise_ou_objectif].filter(Boolean).join(' - ').slice(0, 200)
  return {
    name: t.nom.trim().slice(0, 120), phone, email: t.email?.trim() || null, interest: interest || 'B2B prospecting',
    budget: 0, status: 'new', source: 'prospecting', score: 45, notes: 'Imported from B2B prospecting', origin_target_id: t.id,
  }
}

// Ne cree jamais de doublon : meme prospect deja importe (origin_target_id) ou meme numero qu'un lead existant.
export function planImport(targets: Target[], existing: ExistingLead[], defaultDial = '974') {
  const seenOrigin = new Set(existing.map((l) => l.origin_target_id).filter(Boolean) as string[])
  const phones = existing.map((l) => l.phone)
  const toInsert: ReturnType<typeof targetToLead>[] = []
  const skipped: { id: string; reason: 'already_imported' | 'duplicate_phone' | 'no_name' }[] = []
  for (const t of targets) {
    if (!t.nom?.trim()) { skipped.push({ id: t.id, reason: 'no_name' }); continue }
    if (seenOrigin.has(t.id)) { skipped.push({ id: t.id, reason: 'already_imported' }); continue }
    const lead = targetToLead(t, defaultDial)
    if (lead.phone && phones.some((p) => sameNumber(p, lead.phone))) { skipped.push({ id: t.id, reason: 'duplicate_phone' }); continue }
    toInsert.push(lead)
    seenOrigin.add(t.id)
    if (lead.phone) phones.push(lead.phone)
  }
  return { toInsert, skipped }
}
