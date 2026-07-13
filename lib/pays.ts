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

// Canal de contact prefere selon le pays (utilise par l'outreach automatique)
export function canalParPays(countryCode: string): 'whatsapp' | 'email' {
  return countryCode === 'TN' ? 'whatsapp' : 'email'
}

export function nomPays(code: string): string {
  return PAYS_DISPONIBLES.find((p) => p.code === code)?.nom ?? code
}
