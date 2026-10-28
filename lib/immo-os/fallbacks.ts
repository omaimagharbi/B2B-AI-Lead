import type { Data, Property } from './types'
import { qar } from './helpers'

// Textes de secours (sans IA) : utilises si aucune cle Gemini/Anthropic n'est configuree ou si le service est indisponible.
export function fallbackAd(p: Property, channel: string, language: string): string {
  const price = p.listing === 'rent' ? `${qar(p.price)} / month` : qar(p.price)
  const facts = [p.beds ? `${p.beds} bedrooms` : null, p.baths ? `${p.baths} bathrooms` : null, p.size_m2 ? `${p.size_m2} m²` : null].filter(Boolean).join(' · ')
  const tag = p.listing === 'rent' ? 'FOR RENT' : 'FOR SALE'
  if (language === 'fr')
    return `${p.listing === 'rent' ? 'À LOUER' : 'À VENDRE'} - ${p.title}, ${p.area}\n${facts}\nPrix : ${price}\nContactez-nous pour organiser une visite.${channel === 'instagram' ? '\n#Qatar #Immobilier #Doha' : ''}`
  if (language === 'ar')
    return `${p.listing === 'rent' ? 'للإيجار' : 'للبيع'} - ${p.title}، ${p.area}\n${facts}\nالسعر: ${price}\nتواصل معنا لحجز موعد معاينة.`
  return `${tag} | ${p.title}, ${p.area}\n${facts}\nPrice: ${price}\nBook a private viewing today.${channel === 'instagram' ? '\n#Qatar #Doha #RealEstate' : ''}`
}
export const fallbackReply = (name: string) =>
  `Hello ${name.split(' ')[0]}, thank you for your message. I will send you the details shortly. Would Thursday afternoon work for a viewing?`
export function fallbackMarket(d: Data): string {
  const av = d.properties.filter((p) => p.status === 'available' && p.listing === 'sale')
  const avg = av.length ? av.reduce((s, p) => s + p.price, 0) / av.length : 0
  const byArea: Record<string, number> = {}
  d.properties.forEach((p) => p.area && (byArea[p.area] = (byArea[p.area] || 0) + 1))
  const top = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a).join(', ')
  return `Average asking price (sales): ${qar(avg)}.\nMost listed areas: ${top || '-'}.\nOpen leads: ${d.leads.filter((l) => !['won', 'lost'].includes(l.status)).length}.\n(AI is not configured - add GEMINI_API_KEY or ANTHROPIC_API_KEY for a full analysis.)`
}
export function fallbackReport(d: Data): string {
  const closed = d.deals.filter((x) => x.status === 'closed')
  const rev = closed.reduce((s, x) => s + (x.value * x.commission_pct) / 100, 0)
  return `Closed deals: ${closed.length}. Commission earned: ${qar(rev)}.\nProperties: ${d.properties.length} (${d.properties.filter((p) => p.status === 'available').length} available).\nLeads: ${d.leads.length}.\n(AI is not configured - add GEMINI_API_KEY or ANTHROPIC_API_KEY for a full written report.)`
}
