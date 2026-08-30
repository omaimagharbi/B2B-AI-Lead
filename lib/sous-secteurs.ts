// Sous-secteurs proposes par carte/vertical - meme liste que la homepage
// (app/secteurs/page.tsx) au moment de l'inscription. Centralise ici pour
// que l'admin puisse proposer le meme choix quand elle corrige/precise le
// secteur_activite d'un cabinet existant, au lieu de retaper une liste a la
// main ou de laisser un champ libre.
export const SOUS_SECTEURS_PAR_VERTICAL: Record<string, string[]> = {
  'cabinet-formation': [
    'Cabinet de Formation Professionnelle',
    'Organisme de Coaching Exécutif & Dirigeants',
    'Cabinet de Recrutement & Chasseur de Têtes',
    'Centre de Reconversion & École Privée',
  ],
  'startup-saas': [
    'Éditeur de Logiciel SaaS (B2B / B2C)',
    'Start-up Tech / DeepTech / FinTech',
    'Plateforme Digitale / Marketplace B2B',
  ],
  'pme-services': [
    'Constructeur & Fournisseur Industriel B2B',
    'Entreprise de Distribution & Grossiste',
    'Société de Services Traditionnels B2B',
  ],
  'investisseur-incubateur': [
    'Fonds de Capital-Risque (VC / Venture Capital)',
    'Réseau de Business Angels',
    'Incubateur & Accélérateur de Startups',
    'Cabinet de Conseil en Levée de Fonds',
  ],
  'comptable-fiscal': [
    'Expertise Comptable',
    "Avocats d'Affaires",
    'Conseil Fiscal',
    'Cabinet de Conformité',
  ],
  'services-generaux': [
    'Transitaire / Transit',
    'Maintenance Industrielle',
    'Facility Management',
    'Événementiel B2B',
  ],
}
