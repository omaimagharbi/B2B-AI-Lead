// =====================================================================
// SPRINT 3 - Vocabulaire dynamique par secteur (point 15 de la roadmap).
//
// Objectif : sortir le texte specifique a un metier (Formation vs
// Comptable vs Service) du code de l'interface, pour qu'ajouter un
// nouveau secteur plus tard = ajouter une entree ici, pas modifier
// app/dashboard/page.tsx.
//
// Meme pattern que lib/templates.ts et lib/professions.ts (deja dans le
// projet) : un dictionnaire cote code, indexe par le slug de la verticale.
// Le comportement pour 'cabinet-formation' reste identique a avant
// (memes textes), donc aucun changement visible pour ce secteur.
//
// Pour ajouter un secteur plus tard (ex: cabinet-comptable) : ajouter une
// entree ici avec les bons textes, rien d'autre a toucher dans le code
// de l'interface tant que ce vocabulaire suffit.
//
// Retour terrain : ce vocabulaire (et les etapes du pipeline plus bas)
// n'etait disponible qu'en francais, meme quand l'utilisateur choisissait
// anglais/arabe ailleurs dans le dashboard - ces dictionnaires sont donc
// maintenant indexes par langue EN PLUS du secteur.
// =====================================================================

import type { Langue } from './i18n'

export type VocabulaireVertical = {
  // Onglet et section catalogue
  labelCatalogue: string // ex: "Catalogue", "Prestations"
  introCatalogue: string // texte d'intro de l'onglet Catalogue
  placeholderNomOffre: string // placeholder du champ "nom de l'offre"

  // Utilise dans les rapports/communications quand on parle de ce que le
  // cabinet vend
  labelOffreSingulier: string // "formation", "mission", "prestation"
  labelOffrePluriel: string // "formations", "missions", "prestations"

  // Utilise pour designer le decideur qu'on cible (texte generique, en
  // plus des exemples deja geres par lib/professions.ts)
  labelDecideur: string // "DRH", "décideur", "client potentiel"
}

const VOCABULAIRE_PAR_DEFAUT: Record<Langue, VocabulaireVertical> = {
  fr: {
    labelCatalogue: 'Catalogue',
    introCatalogue:
      "Tes vraies formations/services. Tant que le catalogue est vide, l'IA continue de " +
      "proposer des packs génériques dans les diagnostics. Dès qu'il y a des offres ici, " +
      'elle pioche dedans en priorité.',
    placeholderNomOffre: 'Nom de la formation/service',
    labelOffreSingulier: 'formation',
    labelOffrePluriel: 'formations',
    labelDecideur: 'décideur',
  },
  en: {
    labelCatalogue: 'Catalogue',
    introCatalogue:
      "Your real training courses/services. As long as the catalogue is empty, the AI keeps " +
      "suggesting generic packages in diagnostics. As soon as there are offers here, " +
      'it draws from them first.',
    placeholderNomOffre: 'Training/service name',
    labelOffreSingulier: 'training course',
    labelOffrePluriel: 'training courses',
    labelDecideur: 'decision-maker',
  },
  ar: {
    labelCatalogue: 'الكتالوج',
    introCatalogue:
      'برامجك/خدماتك الحقيقية. طالما الكتالوج فارغ، يستمر الذكاء الاصطناعي في اقتراح باقات عامة ' +
      'في التشخيصات. بمجرد وجود عروض هنا، يعتمد عليها أولاً.',
    placeholderNomOffre: 'اسم البرنامج/الخدمة',
    labelOffreSingulier: 'برنامج تدريبي',
    labelOffrePluriel: 'برامج تدريبية',
    labelDecideur: 'صاحب القرار',
  },
}

export const VOCABULAIRE_PAR_VERTICAL: Record<string, Record<Langue, VocabulaireVertical>> = {
  'cabinet-formation': VOCABULAIRE_PAR_DEFAUT,
  'startup-saas': {
    fr: {
      labelCatalogue: 'Offres',
      introCatalogue:
        "Tes vraies offres/services techniques. Tant que le catalogue est vide, l'IA continue " +
        "de proposer des packs génériques dans les diagnostics. Dès qu'il y a des offres ici, " +
        'elle pioche dedans en priorité.',
      placeholderNomOffre: "Nom de l'offre/du service",
      labelOffreSingulier: 'offre',
      labelOffrePluriel: 'offres',
      labelDecideur: 'décideur technique',
    },
    en: {
      labelCatalogue: 'Offers',
      introCatalogue:
        "Your real technical offers/services. As long as the catalogue is empty, the AI keeps " +
        "suggesting generic packages in diagnostics. As soon as there are offers here, " +
        'it draws from them first.',
      placeholderNomOffre: 'Offer/service name',
      labelOffreSingulier: 'offer',
      labelOffrePluriel: 'offers',
      labelDecideur: 'technical decision-maker',
    },
    ar: {
      labelCatalogue: 'العروض',
      introCatalogue:
        'عروضك/خدماتك التقنية الحقيقية. طالما الكتالوج فارغ، يستمر الذكاء الاصطناعي في اقتراح ' +
        'باقات عامة في التشخيصات. بمجرد وجود عروض هنا، يعتمد عليها أولاً.',
      placeholderNomOffre: 'اسم العرض/الخدمة',
      labelOffreSingulier: 'عرض',
      labelOffrePluriel: 'عروض',
      labelDecideur: 'صاحب القرار التقني',
    },
  },
  'pme-services': {
    fr: {
      labelCatalogue: 'Prestations',
      introCatalogue:
        "Tes vraies prestations. Tant que le catalogue est vide, l'IA continue de proposer " +
        "des packs génériques dans les diagnostics. Dès qu'il y a des offres ici, elle pioche " +
        'dedans en priorité.',
      placeholderNomOffre: 'Nom de la prestation',
      labelOffreSingulier: 'prestation',
      labelOffrePluriel: 'prestations',
      labelDecideur: 'dirigeant',
    },
    en: {
      labelCatalogue: 'Services',
      introCatalogue:
        "Your real services. As long as the catalogue is empty, the AI keeps suggesting " +
        "generic packages in diagnostics. As soon as there are offers here, it draws from " +
        'them first.',
      placeholderNomOffre: 'Service name',
      labelOffreSingulier: 'service',
      labelOffrePluriel: 'services',
      labelDecideur: 'executive',
    },
    ar: {
      labelCatalogue: 'الخدمات',
      introCatalogue:
        'خدماتك الحقيقية. طالما الكتالوج فارغ، يستمر الذكاء الاصطناعي في اقتراح باقات عامة في ' +
        'التشخيصات. بمجرد وجود عروض هنا، يعتمد عليها أولاً.',
      placeholderNomOffre: 'اسم الخدمة',
      labelOffreSingulier: 'خدمة',
      labelOffrePluriel: 'خدمات',
      labelDecideur: 'مدير تنفيذي',
    },
  },
  'investisseur-incubateur': {
    fr: {
      labelCatalogue: "Critères d'investissement",
      introCatalogue:
        "Ta thèse d'investissement : ticket moyen, secteurs recherchés, maturité des projets " +
        "visés. Utilise ce catalogue comme une liste de critères plutôt que d'offres à vendre — " +
        'chaque ligne peut représenter un secteur ou un type de deal que tu recherches.',
      placeholderNomOffre: 'Ex: SaaS B2B en amorçage',
      labelOffreSingulier: "critère d'investissement",
      labelOffrePluriel: "critères d'investissement",
      labelDecideur: 'fondateur',
    },
    en: {
      labelCatalogue: 'Investment criteria',
      introCatalogue:
        'Your investment thesis: average ticket size, target industries, project maturity. ' +
        'Use this catalogue as a list of criteria rather than offers to sell — each line can ' +
        'represent an industry or deal type you are looking for.',
      placeholderNomOffre: 'E.g.: Early-stage B2B SaaS',
      labelOffreSingulier: 'investment criterion',
      labelOffrePluriel: 'investment criteria',
      labelDecideur: 'founder',
    },
    ar: {
      labelCatalogue: 'معايير الاستثمار',
      introCatalogue:
        'أطروحتك الاستثمارية: متوسط حجم الاستثمار، القطاعات المستهدفة، نضج المشاريع. استخدم هذا ' +
        'الكتالوج كقائمة معايير بدلاً من عروض للبيع — يمكن أن يمثل كل سطر قطاعًا أو نوع صفقة تبحث عنها.',
      placeholderNomOffre: 'مثال: SaaS B2B في مرحلة التأسيس',
      labelOffreSingulier: 'معيار استثمار',
      labelOffrePluriel: 'معايير استثمار',
      labelDecideur: 'مؤسس',
    },
  },
  immobilier: {
    fr: {
      labelCatalogue: 'Biens & Mandats',
      introCatalogue:
        'Tes vrais biens en mandat (vente/location) ou tes offres de service (chasse immobilière, ' +
        "gestion locative...). Tant que c'est vide, l'IA propose des exemples génériques dans les " +
        "diagnostics. Dès qu'il y a des biens/offres ici, elle pioche dedans en priorité.",
      placeholderNomOffre: 'Ex: T3 centre-ville - mandat exclusif',
      labelOffreSingulier: 'bien/mandat',
      labelOffrePluriel: 'biens/mandats',
      labelDecideur: 'acheteur/vendeur',
    },
    en: {
      labelCatalogue: 'Listings & Mandates',
      introCatalogue:
        'Your real listings under mandate (sale/rental) or service offers (property search, ' +
        "rental management...). As long as it's empty, the AI suggests generic examples in " +
        'diagnostics. As soon as there are listings/offers here, it draws from them first.',
      placeholderNomOffre: 'E.g.: 2-bed downtown - exclusive mandate',
      labelOffreSingulier: 'listing/mandate',
      labelOffrePluriel: 'listings/mandates',
      labelDecideur: 'buyer/seller',
    },
    ar: {
      labelCatalogue: 'العقارات والتفويضات',
      introCatalogue:
        'عقاراتك الحقيقية قيد التفويض (بيع/إيجار) أو عروض خدماتك (البحث العقاري، إدارة الإيجارات...). ' +
        'طالما فارغ، يقترح الذكاء الاصطناعي أمثلة عامة في التشخيصات. بمجرد وجود عقارات/عروض هنا، يعتمد عليها أولاً.',
      placeholderNomOffre: 'مثال: شقة 3 غرف وسط المدينة - تفويض حصري',
      labelOffreSingulier: 'عقار/تفويض',
      labelOffrePluriel: 'عقارات/تفويضات',
      labelDecideur: 'مشترٍ/بائع',
    },
  },
}

export function vocabulairePourVertical(
  verticalSlug: string | null | undefined,
  langue: Langue = 'fr'
): VocabulaireVertical {
  const parVerticale = verticalSlug ? VOCABULAIRE_PAR_VERTICAL[verticalSlug] : undefined
  const dict = parVerticale ?? VOCABULAIRE_PAR_DEFAUT
  return dict[langue] ?? dict.fr
}

// Retour terrain : les colonnes du pipeline (Kanban) ne bougent jamais
// automatiquement - il faut glisser la carte soi-meme - et l'equipe ne
// savait pas toujours ce que "faire avancer" une carte signifie
// concretement a chaque etape. Une phrase d'aide par etape, affichee au
// survol d'un icone ⓘ a cote du titre de colonne (voir dashboard/page.tsx).
// Cle sur la valeur 'etape' (stable entre verticals et langues), pas sur
// le libelle affiche.
const DESCRIPTIONS_ETAPES_PAR_LANGUE: Record<Langue, Record<string, string>> = {
  fr: {
    contacte: 'Le premier message est parti. On attend une réponse.',
    discussion_engagee: 'Le prospect a répondu et échange avec vous - la conversation est ouverte.',
    qualifie: "Besoin et légitimité confirmés : ça vaut le coup d'investir du temps commercial dessus.",
    proposition: 'Une offre chiffrée (devis, pack, proposition) a été envoyée au prospect.',
    rdv_planifie: 'Un rendez-vous ou appel est fixé avec le prospect.',
    negociation: 'Les conditions (prix, périmètre, délais) sont en cours de discussion.',
    gagne: 'Le contrat est signé - cette cible est un client.',
    a_recontacter: 'Pas prêt maintenant, mais à relancer plus tard.',
    perdu: "Le prospect a décliné ou n'ira pas plus loin.",
  },
  en: {
    contacte: 'The first message has been sent. Waiting for a reply.',
    discussion_engagee: 'The prospect replied and is in conversation with you - the discussion is open.',
    qualifie: 'Need and legitimacy confirmed: worth investing sales time on this one.',
    proposition: 'A priced offer (quote, package, proposal) has been sent to the prospect.',
    rdv_planifie: 'A meeting or call is scheduled with the prospect.',
    negociation: 'Terms (price, scope, timeline) are being discussed.',
    gagne: 'The contract is signed - this target is now a client.',
    a_recontacter: 'Not ready now, but to follow up later.',
    perdu: 'The prospect declined or will not go any further.',
  },
  ar: {
    contacte: 'تم إرسال أول رسالة. في انتظار الرد.',
    discussion_engagee: 'رد العميل المحتمل ويتحاور معك - النقاش مفتوح.',
    qualifie: 'تم تأكيد الحاجة والشرعية: يستحق استثمار وقت تجاري في هذا العميل.',
    proposition: 'تم إرسال عرض مسعّر (عرض سعر، باقة، اقتراح) إلى العميل المحتمل.',
    rdv_planifie: 'تم تحديد موعد أو مكالمة مع العميل المحتمل.',
    negociation: 'الشروط (السعر، النطاق، الآجال) قيد النقاش.',
    gagne: 'تم توقيع العقد - هذا الهدف أصبح عميلاً.',
    a_recontacter: 'ليس جاهزًا الآن، لكن يجب المتابعة لاحقًا.',
    perdu: 'رفض العميل المحتمل أو لن يذهب أبعد من ذلك.',
  },
}

export function descriptionEtape(etape: string, langue: Langue = 'fr'): string | undefined {
  return DESCRIPTIONS_ETAPES_PAR_LANGUE[langue]?.[etape] ?? DESCRIPTIONS_ETAPES_PAR_LANGUE.fr[etape]
}

// Etapes du pipeline (Kanban), adaptees au vocabulaire metier de chaque
// secteur ET a la langue choisie. Les valeurs 'etape' restent identiques
// partout (colonnes reelles en base sur targets.etape_pipeline) : seul le
// libelle affiche change.
export type EtapePipeline = { etape: string; label: string }

const ETAPES_PAR_DEFAUT: Record<Langue, EtapePipeline[]> = {
  fr: [
    { etape: 'contacte', label: '📨 Contacté' },
    { etape: 'discussion_engagee', label: '💬 Discussion Engagée' },
    { etape: 'qualifie', label: '✅ Qualifié' },
    { etape: 'proposition', label: '📄 Proposition envoyée' },
    { etape: 'rdv_planifie', label: '📅 Rendez-vous Planifié' },
    { etape: 'negociation', label: '🤝 Négociation' },
    { etape: 'gagne', label: '🏆 Gagné' },
    { etape: 'a_recontacter', label: '⏳ À recontacter plus tard' },
    { etape: 'perdu', label: '❌ Perdu' },
  ],
  en: [
    { etape: 'contacte', label: '📨 Contacted' },
    { etape: 'discussion_engagee', label: '💬 Discussion Ongoing' },
    { etape: 'qualifie', label: '✅ Qualified' },
    { etape: 'proposition', label: '📄 Proposal Sent' },
    { etape: 'rdv_planifie', label: '📅 Meeting Scheduled' },
    { etape: 'negociation', label: '🤝 Negotiation' },
    { etape: 'gagne', label: '🏆 Won' },
    { etape: 'a_recontacter', label: '⏳ Follow Up Later' },
    { etape: 'perdu', label: '❌ Lost' },
  ],
  ar: [
    { etape: 'contacte', label: '📨 تم الاتصال' },
    { etape: 'discussion_engagee', label: '💬 نقاش جارٍ' },
    { etape: 'qualifie', label: '✅ مؤهَّل' },
    { etape: 'proposition', label: '📄 تم إرسال العرض' },
    { etape: 'rdv_planifie', label: '📅 موعد مُحدَّد' },
    { etape: 'negociation', label: '🤝 تفاوض' },
    { etape: 'gagne', label: '🏆 مكتسب' },
    { etape: 'a_recontacter', label: '⏳ متابعة لاحقًا' },
    { etape: 'perdu', label: '❌ خسارة' },
  ],
}

const ETAPES_PAR_VERTICAL: Record<string, Record<Langue, EtapePipeline[]>> = {
  'investisseur-incubateur': {
    fr: [
      { etape: 'contacte', label: '📨 Approche envoyée' },
      { etape: 'discussion_engagee', label: '💬 Discussion Engagée' },
      { etape: 'qualifie', label: '🔁 Relance note de financement' },
      { etape: 'proposition', label: "🏛️ Comité d'investissement engagé" },
      { etape: 'rdv_planifie', label: '📅 Rendez-vous Planifié' },
      { etape: 'negociation', label: '🤝 Négociation des termes' },
      { etape: 'gagne', label: '💰 Contrat signé (Closing)' },
      { etape: 'a_recontacter', label: '⏳ À recontacter plus tard' },
      { etape: 'perdu', label: '❌ Perdu' },
    ],
    en: [
      { etape: 'contacte', label: '📨 Outreach Sent' },
      { etape: 'discussion_engagee', label: '💬 Discussion Ongoing' },
      { etape: 'qualifie', label: '🔁 Funding Memo Follow-up' },
      { etape: 'proposition', label: '🏛️ Investment Committee Engaged' },
      { etape: 'rdv_planifie', label: '📅 Meeting Scheduled' },
      { etape: 'negociation', label: '🤝 Terms Negotiation' },
      { etape: 'gagne', label: '💰 Deal Closed' },
      { etape: 'a_recontacter', label: '⏳ Follow Up Later' },
      { etape: 'perdu', label: '❌ Lost' },
    ],
    ar: [
      { etape: 'contacte', label: '📨 تم إرسال التواصل' },
      { etape: 'discussion_engagee', label: '💬 نقاش جارٍ' },
      { etape: 'qualifie', label: '🔁 متابعة مذكرة التمويل' },
      { etape: 'proposition', label: '🏛️ لجنة الاستثمار مُشارِكة' },
      { etape: 'rdv_planifie', label: '📅 موعد مُحدَّد' },
      { etape: 'negociation', label: '🤝 تفاوض على الشروط' },
      { etape: 'gagne', label: '💰 تم إغلاق الصفقة' },
      { etape: 'a_recontacter', label: '⏳ متابعة لاحقًا' },
      { etape: 'perdu', label: '❌ خسارة' },
    ],
  },
  immobilier: {
    fr: [
      { etape: 'contacte', label: '📨 Contacté' },
      { etape: 'discussion_engagee', label: '💬 Discussion Engagée' },
      { etape: 'qualifie', label: '✅ Qualifié (budget confirmé)' },
      { etape: 'proposition', label: '🏠 Visite planifiée' },
      { etape: 'rdv_planifie', label: '📝 Offre faite' },
      { etape: 'negociation', label: '🤝 Négociation' },
      { etape: 'gagne', label: '🔑 Compromis signé' },
      { etape: 'a_recontacter', label: '⏳ À recontacter plus tard' },
      { etape: 'perdu', label: '❌ Perdu' },
    ],
    en: [
      { etape: 'contacte', label: '📨 Contacted' },
      { etape: 'discussion_engagee', label: '💬 Discussion Ongoing' },
      { etape: 'qualifie', label: '✅ Qualified (budget confirmed)' },
      { etape: 'proposition', label: '🏠 Viewing Scheduled' },
      { etape: 'rdv_planifie', label: '📝 Offer Made' },
      { etape: 'negociation', label: '🤝 Negotiation' },
      { etape: 'gagne', label: '🔑 Agreement Signed' },
      { etape: 'a_recontacter', label: '⏳ Follow Up Later' },
      { etape: 'perdu', label: '❌ Lost' },
    ],
    ar: [
      { etape: 'contacte', label: '📨 تم الاتصال' },
      { etape: 'discussion_engagee', label: '💬 نقاش جارٍ' },
      { etape: 'qualifie', label: '✅ مؤهَّل (تأكيد الميزانية)' },
      { etape: 'proposition', label: '🏠 زيارة مُجدولة' },
      { etape: 'rdv_planifie', label: '📝 تم تقديم عرض' },
      { etape: 'negociation', label: '🤝 تفاوض' },
      { etape: 'gagne', label: '🔑 توقيع الاتفاقية' },
      { etape: 'a_recontacter', label: '⏳ متابعة لاحقًا' },
      { etape: 'perdu', label: '❌ خسارة' },
    ],
  },
}

export function etapesPipelinePourVertical(
  verticalSlug: string | null | undefined,
  langue: Langue = 'fr'
): EtapePipeline[] {
  const parVerticale = verticalSlug ? ETAPES_PAR_VERTICAL[verticalSlug] : undefined
  const dict = parVerticale ?? ETAPES_PAR_DEFAUT
  return dict[langue] ?? dict.fr
}
