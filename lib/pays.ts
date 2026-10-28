export const PAYS_DISPONIBLES = [
  { code: 'DZ', nom: 'Algérie' },
  { code: 'DE', nom: 'Allemagne' },
  { code: 'SA', nom: 'Arabie Saoudite' },
  { code: 'BE', nom: 'Belgique' },
  { code: 'CA', nom: 'Canada' },
  { code: 'CI', nom: "Côte d'Ivoire" },
  { code: 'AE', nom: 'Émirats Arabes Unis' },
  { code: 'ES', nom: 'Espagne' },
  { code: 'US', nom: 'États-Unis' },
  { code: 'FR', nom: 'France' },
  { code: 'IT', nom: 'Italie' },
  { code: 'LU', nom: 'Luxembourg' },
  { code: 'MA', nom: 'Maroc' },
  { code: 'NL', nom: 'Pays-Bas' },
  { code: 'QA', nom: 'Qatar' },
  { code: 'GB', nom: 'Royaume-Uni' },
  { code: 'SN', nom: 'Sénégal' },
  { code: 'CH', nom: 'Suisse' },
  { code: 'TN', nom: 'Tunisie' },
].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export type CodePays = string
export type Zone = 'tunisie' | 'golfe' | 'reste'

// Regroupement en 3 zones (version light validee pour le Sprint 2 : pas les
// 4 zones fines des notes d'origine, juste ce qui change vraiment le
// comportement commercial aujourd'hui).
const PAYS_GOLFE = new Set(['SA', 'AE', 'QA'])

export function zonePourPays(countryCode: string | null | undefined): Zone {
  if (!countryCode) return 'reste'
  if (countryCode === 'TN') return 'tunisie'
  if (PAYS_GOLFE.has(countryCode)) return 'golfe'
  return 'reste'
}

// Canal de contact prefere selon le pays (utilise par l'outreach automatique).
// Seuls whatsapp/email sont automatisables aujourd'hui (LinkedIn reste manuel,
// bouton "Preparer LinkedIn" existant) : le Golfe utilise massivement WhatsApp
// Business meme en pro, donc on le garde sur whatsapp plutot que email.
export function canalParPays(countryCode: string): 'whatsapp' | 'email' {
  const zone = zonePourPays(countryCode)
  return zone === 'reste' ? 'email' : 'whatsapp'
}

// Devise suggeree pour le diagnostic/catalogue selon la zone du prospect.
export function deviseParZone(zone: Zone): 'TND' | 'USD' | 'EUR' {
  if (zone === 'tunisie') return 'TND'
  if (zone === 'golfe') return 'USD'
  return 'EUR'
}

// Fuseau horaire IANA associe a chaque pays gere par la plateforme, pour le
// calcul des creneaux de reservation (voir lib/google-calendar.ts). Un seul
// fuseau par pays (les pays a fuseaux multiples comme US/Canada n'ont
// qu'une valeur representative - limite acceptee, le cabinet peut choisir
// un autre fuseau de la liste si le sien differe).
export const TIMEZONES_DISPONIBLES: { zone: string; label: string }[] = [
  { zone: 'Africa/Tunis', label: 'Tunisie (UTC+1)' },
  { zone: 'Africa/Algiers', label: 'Algérie (UTC+1)' },
  { zone: 'Africa/Casablanca', label: 'Maroc (UTC+1)' },
  { zone: 'Asia/Dubai', label: 'Émirats Arabes Unis (UTC+4)' },
  { zone: 'Asia/Riyadh', label: 'Arabie Saoudite (UTC+3)' },
  { zone: 'Asia/Qatar', label: 'Qatar (UTC+3)' },
  { zone: 'Europe/Paris', label: 'France (UTC+1/+2)' },
  { zone: 'Europe/Brussels', label: 'Belgique (UTC+1/+2)' },
  { zone: 'Europe/Madrid', label: 'Espagne (UTC+1/+2)' },
  { zone: 'Europe/Rome', label: 'Italie (UTC+1/+2)' },
  { zone: 'Europe/Luxembourg', label: 'Luxembourg (UTC+1/+2)' },
  { zone: 'Europe/Amsterdam', label: 'Pays-Bas (UTC+1/+2)' },
  { zone: 'Europe/London', label: 'Royaume-Uni (UTC+0/+1)' },
  { zone: 'Europe/Zurich', label: 'Suisse (UTC+1/+2)' },
  { zone: 'Europe/Berlin', label: 'Allemagne (UTC+1/+2)' },
  { zone: 'America/Toronto', label: 'Canada - Est (UTC-5/-4)' },
  { zone: 'America/Winnipeg', label: 'Canada - Centre (UTC-6/-5)' },
  { zone: 'America/Edmonton', label: 'Canada - Rocheuses (UTC-7/-6)' },
  { zone: 'America/Vancouver', label: 'Canada - Pacifique (UTC-8/-7)' },
  { zone: 'America/New_York', label: 'États-Unis - Est (UTC-5/-4)' },
  { zone: 'America/Chicago', label: 'États-Unis - Centre (UTC-6/-5)' },
  { zone: 'America/Denver', label: 'États-Unis - Rocheuses (UTC-7/-6)' },
  { zone: 'America/Los_Angeles', label: 'États-Unis - Pacifique (UTC-8/-7)' },
  { zone: 'Africa/Abidjan', label: "Côte d'Ivoire (UTC+0)" },
  { zone: 'Africa/Dakar', label: 'Sénégal (UTC+0)' },
]

// Argument de vente a injecter dans le prompt IA du diagnostic, adapte a la
// zone du prospect (regle simple, pas d'IA generative pour ce choix).
export function argumentVenteParZone(zone: Zone): string {
  if (zone === 'tunisie') {
    return "Argument de vente a privilegier : le financement via la TFP (Taxe de Formation " +
      "Professionnelle) et les ristournes de l'Etat tunisien, si pertinent pour ce type de prestation."
  }
  if (zone === 'golfe') {
    return 'Argument de vente a privilegier : la performance, l\'innovation et l\'alignement avec ' +
      "les standards internationaux. Le prospect est dans une zone a fort pouvoir d'achat, ne " +
      'sous-vends pas la valeur.'
  }
  return "Argument de vente a privilegier : le rapport expertise/prix competitif et la capacite " +
    "d'accompagnement a distance (ou proximite geographique selon le pays), face a des prestataires locaux plus chers."
}

// Convertit un code pays ISO2 (ex: 'TN') en emoji drapeau (🇹🇳), sans table
// de correspondance a maintenir : chaque lettre devient son "indicateur
// regional" Unicode correspondant.
export function drapeauPays(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6 // indicateur regional 'A'
  const points = code
    .toUpperCase()
    .split('')
    .map((lettre) => base + (lettre.charCodeAt(0) - 65))
  return String.fromCodePoint(...points)
}

export function nomPays(code: string): string {
  return PAYS_DISPONIBLES.find((p) => p.code === code)?.nom ?? code
}
