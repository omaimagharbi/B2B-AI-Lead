import { digits } from './inbound-pure'

// Validation pure du formulaire public de capture de leads (aucune dependance base).
export type CaptureInput = { agency: string; name: string; phone: string; email: string | null; message: string | null; budget: number; propertyId: string | null; honeypot: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Numero a 8 chiffres sans indicatif -> on ajoute l'indicatif par defaut (Qatar = 974) pour que WhatsApp puisse repondre.
export function normalizePhone(raw: string, defaultDial = '974'): string | null {
  const t = raw.trim()
  const d = digits(t)
  if (d.length < 8 || d.length > 15) return null
  if (t.startsWith('+')) return `+${d}`
  if (d.startsWith('00')) return `+${d.slice(2)}`
  if (d.length === 8) return `+${defaultDial}${d}`
  return `+${d}`
}

export function validateCapture(b: any, defaultDial = '974'): { ok: true; value: CaptureInput } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Invalid request' }
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const agency = str(b.agency, 64)
  if (!UUID.test(agency)) return { ok: false, error: 'Unknown agency' }
  const name = str(b.name, 120).replace(/\s+/g, ' ')
  if (name.length < 2) return { ok: false, error: 'Please enter your name' }
  const phone = normalizePhone(str(b.phone, 30), defaultDial)
  if (!phone) return { ok: false, error: 'Please enter a valid phone number' }
  const emailRaw = str(b.email, 160)
  if (emailRaw && !EMAIL.test(emailRaw)) return { ok: false, error: 'Please enter a valid email address' }
  const budget = Number(b.budget)
  const propertyId = UUID.test(str(b.propertyId, 64)) ? str(b.propertyId, 64) : null
  return {
    ok: true,
    value: {
      agency, name, phone, email: emailRaw || null, message: str(b.message, 1000) || null,
      budget: Number.isFinite(budget) && budget > 0 && budget < 1e11 ? Math.round(budget) : 0,
      propertyId, honeypot: str(b.website, 200).length > 0,
    },
  }
}
