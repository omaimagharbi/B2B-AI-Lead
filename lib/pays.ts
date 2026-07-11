export const PAYS_DISPONIBLES = [
  { code: 'TN', nom: 'Tunisie' },
  { code: 'FR', nom: 'France' },
  { code: 'BE', nom: 'Belgique' },
  { code: 'CA', nom: 'Canada' },
  { code: 'MA', nom: 'Maroc' },
  { code: 'DZ', nom: 'Algérie' },
  { code: 'CI', nom: "Côte d'Ivoire" },
] as const

export type CodePays = (typeof PAYS_DISPONIBLES)[number]['code']

// Canal de contact prefere selon le pays (utilise par l'outreach automatique)
export function canalParPays(countryCode: string): 'whatsapp' | 'email' {
  return countryCode === 'TN' ? 'whatsapp' : 'email'
}

export function nomPays(code: string): string {
  return PAYS_DISPONIBLES.find((p) => p.code === code)?.nom ?? code
}
