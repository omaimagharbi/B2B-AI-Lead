// Sous-secteurs proposes par carte/vertical - meme liste que la homepage
// (app/secteurs/page.tsx) au moment de l'inscription. Centralise ici pour
// que l'admin puisse proposer le meme choix quand elle corrige/precise le
// secteur_activite d'un cabinet existant, au lieu de retaper une liste a la
// main ou de laisser un champ libre.
//
// IMPORTANT : la VALEUR stockee en base (clients.secteur_activite) reste
// TOUJOURS le libelle francais ci-dessous, quelle que soit la langue
// affichee au visiteur - pour rester compatible avec les cabinets deja
// inscrits (dont ce champ contient deja ce texte francais) et pour que
// l'admin (outil interne, reste en francais) continue de filtrer/afficher
// correctement. Seul l'AFFICHAGE cote page publique /secteurs est traduit,
// via traduireSousSecteur() plus bas - la valeur soumise au formulaire ne
// change jamais.
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
  immobilier: [
    'Agence Immobilière (Vente & Location)',
    'Promoteur Immobilier / Construction Neuve',
    'Agent Immobilier Indépendant',
    'Syndic de Copropriété',
    'Gestion Locative / Property Management',
  ],
}

// Traductions d'AFFICHAGE uniquement (voir avertissement ci-dessus), cle sur
// le libelle francais canonique.
const TRADUCTIONS_SOUS_SECTEURS: Record<'en' | 'ar', Record<string, string>> = {
  en: {
    'Cabinet de Formation Professionnelle': 'Professional Training Firm',
    'Organisme de Coaching Exécutif & Dirigeants': 'Executive & Leadership Coaching Organization',
    'Cabinet de Recrutement & Chasseur de Têtes': 'Recruitment Agency & Headhunter',
    'Centre de Reconversion & École Privée': 'Career Transition Center & Private School',
    'Éditeur de Logiciel SaaS (B2B / B2C)': 'SaaS Software Vendor (B2B / B2C)',
    'Start-up Tech / DeepTech / FinTech': 'Tech / DeepTech / FinTech Startup',
    'Plateforme Digitale / Marketplace B2B': 'Digital Platform / B2B Marketplace',
    'Constructeur & Fournisseur Industriel B2B': 'Industrial Manufacturer & B2B Supplier',
    'Entreprise de Distribution & Grossiste': 'Distribution Company & Wholesaler',
    'Société de Services Traditionnels B2B': 'Traditional B2B Services Company',
    'Fonds de Capital-Risque (VC / Venture Capital)': 'Venture Capital Fund (VC)',
    'Réseau de Business Angels': 'Business Angels Network',
    'Incubateur & Accélérateur de Startups': 'Startup Incubator & Accelerator',
    'Cabinet de Conseil en Levée de Fonds': 'Fundraising Consulting Firm',
    'Expertise Comptable': 'Accounting Firm',
    "Avocats d'Affaires": 'Business Lawyers',
    'Conseil Fiscal': 'Tax Advisory',
    'Cabinet de Conformité': 'Compliance Firm',
    'Transitaire / Transit': 'Freight Forwarder',
    'Maintenance Industrielle': 'Industrial Maintenance',
    'Facility Management': 'Facility Management',
    'Événementiel B2B': 'B2B Events',
    'Agence Immobilière (Vente & Location)': 'Real Estate Agency (Sales & Rental)',
    'Promoteur Immobilier / Construction Neuve': 'Real Estate Developer / New Construction',
    'Agent Immobilier Indépendant': 'Independent Real Estate Agent',
    'Syndic de Copropriété': 'Homeowners Association Manager',
    'Gestion Locative / Property Management': 'Rental / Property Management',
  },
  ar: {
    'Cabinet de Formation Professionnelle': 'مكتب تدريب مهني',
    'Organisme de Coaching Exécutif & Dirigeants': 'مؤسسة تدريب تنفيذي للقيادات',
    'Cabinet de Recrutement & Chasseur de Têtes': 'مكتب توظيف واستقطاب الكفاءات',
    'Centre de Reconversion & École Privée': 'مركز إعادة التأهيل المهني ومدرسة خاصة',
    'Éditeur de Logiciel SaaS (B2B / B2C)': 'ناشر برمجيات SaaS (بين الشركات / للأفراد)',
    'Start-up Tech / DeepTech / FinTech': 'شركة ناشئة تقنية / DeepTech / FinTech',
    'Plateforme Digitale / Marketplace B2B': 'منصة رقمية / سوق إلكتروني بين الشركات',
    'Constructeur & Fournisseur Industriel B2B': 'مُصنّع ومورّد صناعي بين الشركات',
    'Entreprise de Distribution & Grossiste': 'شركة توزيع وتجارة جملة',
    'Société de Services Traditionnels B2B': 'شركة خدمات تقليدية بين الشركات',
    'Fonds de Capital-Risque (VC / Venture Capital)': 'صندوق رأس مال مغامر',
    'Réseau de Business Angels': 'شبكة مستثمرين أفراد',
    'Incubateur & Accélérateur de Startups': 'حاضنة ومسرّع للشركات الناشئة',
    'Cabinet de Conseil en Levée de Fonds': 'مكتب استشارات جمع التمويل',
    'Expertise Comptable': 'خبرة محاسبية',
    "Avocats d'Affaires": 'محامو أعمال',
    'Conseil Fiscal': 'استشارات ضريبية',
    'Cabinet de Conformité': 'مكتب امتثال',
    'Transitaire / Transit': 'وكيل شحن',
    'Maintenance Industrielle': 'صيانة صناعية',
    'Facility Management': 'إدارة المرافق',
    'Événementiel B2B': 'تنظيم فعاليات بين الشركات',
    'Agence Immobilière (Vente & Location)': 'وكالة عقارية (بيع وإيجار)',
    'Promoteur Immobilier / Construction Neuve': 'مطور عقاري / بناء جديد',
    'Agent Immobilier Indépendant': 'وكيل عقاري مستقل',
    'Syndic de Copropriété': 'مسيّر ملكية مشتركة',
    'Gestion Locative / Property Management': 'إدارة الإيجارات / إدارة الممتلكات',
  },
}

export function traduireSousSecteur(libelleFrancais: string, langue: 'fr' | 'en' | 'ar'): string {
  if (langue === 'fr') return libelleFrancais
  return TRADUCTIONS_SOUS_SECTEURS[langue][libelleFrancais] ?? libelleFrancais
}
