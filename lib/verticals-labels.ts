// Libelles lisibles des secteurs/verticals, partages entre l'admin (creation
// de cabinet, filtres) et le dashboard (badge secteur sur les cibles/
// diagnostics d'un cabinet multi-secteurs). Une seule source pour eviter que
// les deux copies divergent.
export const VERTICALS_LABELS: { slug: string; label: string }[] = [
  { slug: 'cabinet-formation', label: 'Cabinet de Formation & Conseil' },
  { slug: 'startup-saas', label: 'Startup Tech & SaaS' },
  { slug: 'pme-services', label: 'PME de Services & Entreprises' },
  { slug: 'investisseur-incubateur', label: 'Écosystème Entrepreneurial' },
  { slug: 'comptable-fiscal', label: 'Cabinet Comptable, Juridique & Fiscal' },
  { slug: 'services-generaux', label: 'Logistique, Transit & Services Généraux' },
  { slug: 'immobilier', label: 'Immobilier (Agences, Promoteurs, Gestion Locative)' },
]

export function labelPourSlugVertical(slug: string | null | undefined): string {
  if (!slug) return slug ?? ''
  return VERTICALS_LABELS.find((v) => v.slug === slug)?.label ?? slug
}
