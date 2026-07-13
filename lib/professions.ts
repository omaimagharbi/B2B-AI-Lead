// Professions ciblees en mode "Entreprise", selon le vertical
export const PROFESSIONS_PAR_VERTICAL: Record<string, string[]> = {
  'cabinet-formation': [
    'DRH',
    'Responsable Formation',
    'Directeur des Ressources Humaines',
    'Responsable RH',
    'Directeur Général',
  ],
  'startup-saas': [
    'CTO',
    'VP Engineering',
    'Lead Developer',
    'Directeur Technique',
    'Product Manager',
  ],
  'pme-services': [
    'Gérant',
    'Directeur Général',
    'Fondateur',
    'Responsable Administratif et Financier',
  ],
}

// Profils cibles en mode "Particulier" (vertical Cabinet de Formation uniquement)
export const PROFILS_PARTICULIER = [
  'Personne en reconversion professionnelle',
  'Jeune diplômé en recherche d\'emploi',
  'Demandeur d\'emploi',
  'Cadre en évolution de carrière',
  'Entrepreneur individuel / Freelance',
  'Autre',
]

export function professionsDisponibles(verticalSlug: string, modeCiblage: string): string[] {
  if (modeCiblage === 'particulier') return PROFILS_PARTICULIER
  return PROFESSIONS_PAR_VERTICAL[verticalSlug] ?? []
}
