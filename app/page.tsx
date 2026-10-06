'use client'

import { useEffect, useState } from 'react'
import { traduire, type Langue } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'

type Profil = { titre: string; description: string; tag: string; dotColor: string; active: boolean }
type Valeur = { emoji: string; titre: string; definition: string; pourquoi: string }

// Contenu long (marketing) directement en dictionnaire par langue, sur le
// meme principe que lib/vocabulaire.ts - lib/i18n.ts reste reserve aux
// libelles courts d'interface.
const PROFILS: Record<Langue, Profil[]> = {
  fr: [
    {
      titre: 'Cabinet de Formation & Consulting',
      description:
        'Ciblage de DRH et responsables formation, diagnostic bâti sur la méthodologie ADDIE, suivi des conventions signées.',
      tag: 'Formation',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'Startups & Éditeurs SaaS',
      description:
        'Qualification des prospects techniques, argumentaire adapté aux décideurs produit, pipeline commercial dédié.',
      tag: 'Tech',
      dotColor: '#F0CC7A',
      active: true,
    },
    {
      titre: 'PME de Services',
      description:
        'Prospection de missions et prestations, diagnostic orienté cadrage de besoin plutôt que catalogue produit.',
      tag: 'Services',
      dotColor: '#0F2540',
      active: true,
    },
    {
      titre: 'Écosystème Entrepreneurial',
      description:
        'Sourcing de dealflow qualifié : fondateurs et startups prêts à être contactés par les investisseurs et incubateurs.',
      tag: 'Investissement',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'Cabinet Comptable, Juridique & Fiscal',
      description: "Chasse de mandats automatisée — expertise comptable, avocats d'affaires, conformité.",
      tag: 'Conformité',
      dotColor: '#8892A0',
      active: false,
    },
    {
      titre: 'Logistique, Transit & Services Généraux',
      description: 'Transitaires, maintenance industrielle, facility management, événementiel B2B.',
      tag: 'Logistique',
      dotColor: '#8892A0',
      active: false,
    },
  ],
  en: [
    {
      titre: 'Training & Consulting Firms',
      description:
        'Targeting HR directors and training managers, diagnostic built on the ADDIE methodology, tracking of signed agreements.',
      tag: 'Training',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'Startups & SaaS Vendors',
      description:
        'Qualifying technical prospects, messaging tailored to product decision-makers, dedicated sales pipeline.',
      tag: 'Tech',
      dotColor: '#F0CC7A',
      active: true,
    },
    {
      titre: 'Service SMEs',
      description:
        'Prospecting for assignments and services, diagnostic focused on scoping the need rather than a product catalogue.',
      tag: 'Services',
      dotColor: '#0F2540',
      active: true,
    },
    {
      titre: 'Startup Ecosystem',
      description:
        'Qualified dealflow sourcing: founders and startups ready to be contacted by investors and incubators.',
      tag: 'Investment',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'Accounting, Legal & Tax Firms',
      description: 'Automated mandate hunting — accounting expertise, business lawyers, compliance.',
      tag: 'Compliance',
      dotColor: '#8892A0',
      active: false,
    },
    {
      titre: 'Logistics, Freight & General Services',
      description: 'Freight forwarders, industrial maintenance, facility management, B2B events.',
      tag: 'Logistics',
      dotColor: '#8892A0',
      active: false,
    },
  ],
  ar: [
    {
      titre: 'مكاتب التدريب والاستشارات',
      description: 'استهداف مديري الموارد البشرية ومسؤولي التدريب، تشخيص مبني على منهجية ADDIE، متابعة الاتفاقيات الموقعة.',
      tag: 'تدريب',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'الشركات الناشئة وناشرو SaaS',
      description: 'تأهيل العملاء المحتملين التقنيين، خطاب موجّه لصناع القرار المنتجي، مسار مبيعات مخصص.',
      tag: 'تقنية',
      dotColor: '#F0CC7A',
      active: true,
    },
    {
      titre: 'المؤسسات الصغيرة والمتوسطة الخدمية',
      description: 'التنقيب عن المهام والخدمات، تشخيص يركز على تأطير الحاجة بدلاً من كتالوج المنتجات.',
      tag: 'خدمات',
      dotColor: '#0F2540',
      active: true,
    },
    {
      titre: 'المنظومة الريادية',
      description: 'مصادر صفقات مؤهلة: مؤسسون وشركات ناشئة جاهزون للتواصل من طرف المستثمرين والحاضنات.',
      tag: 'استثمار',
      dotColor: '#1F6F78',
      active: true,
    },
    {
      titre: 'مكاتب المحاسبة والقانون والضرائب',
      description: 'صيد تلقائي للمهام — خبرة محاسبية، محامو أعمال، امتثال.',
      tag: 'امتثال',
      dotColor: '#8892A0',
      active: false,
    },
    {
      titre: 'اللوجستيات والنقل والخدمات العامة',
      description: 'وكلاء الشحن، الصيانة الصناعية، إدارة المرافق، فعاليات B2B.',
      tag: 'لوجستيات',
      dotColor: '#8892A0',
      active: false,
    },
  ],
}

const VALEURS: Record<Langue, Valeur[]> = {
  fr: [
    {
      emoji: '⚓',
      titre: 'Résilience',
      definition: "La capacité à traverser l'épreuve sans s'éteindre.",
      pourquoi:
        "C'est notre valeur signature — la force de rebond que nous transmettons à travers chaque diagnostic et chaque accompagnement.",
    },
    {
      emoji: '🍃',
      titre: 'Authenticité',
      definition: "Être vrai, sans masque, dans l'accompagnement.",
      pourquoi:
        "Nos cabinets partenaires choisissent une approche humaine avant une méthode. L'authenticité crée une confiance immédiate et casse le jargon corporate impersonnel.",
    },
    {
      emoji: '⚖️',
      titre: 'Responsabilité',
      definition: 'Assumer ses choix et leurs conséquences.',
      pourquoi:
        'Elle prouve que nous assumons nos engagements, et pousse chaque cabinet à rester acteur de sa propre trajectoire commerciale.',
    },
    {
      emoji: '🎯',
      titre: 'Impact',
      definition: 'Des résultats concrets, mesurables et durables.',
      pourquoi:
        "Nous ne sommes pas là pour échanger, mais pour générer une vraie valeur ajoutée et une performance commerciale visible.",
    },
    {
      emoji: '🚀',
      titre: 'Transformation',
      definition: 'Faire évoluer une situation, une personne, une organisation.',
      pourquoi:
        "C'est notre promesse : un véritable avant/après dans la façon dont nos cabinets partenaires prospectent.",
    },
    {
      emoji: '🌱',
      titre: 'Engagement Humain',
      definition: "S'investir réellement dans la réussite de l'autre.",
      pourquoi:
        "Nos partenariats ne sont pas de simples transactions — c'est un engagement de fond dans la réussite de chaque cabinet.",
    },
    {
      emoji: '🛡️',
      titre: 'Éthique',
      definition: 'Respecter scrupuleusement la déontologie et la confidentialité des données.',
      pourquoi: 'Le signal fort envoyé à chaque cabinet et chaque prospect : un espace de travail protégé, sain et réglementé.',
    },
    {
      emoji: '💎',
      titre: 'Intégrité',
      definition: 'Agir de façon honnête, transparente et alignée avec ses principes.',
      pourquoi: 'Nous ne masquons jamais un diagnostic difficile — nous agissons avec une clarté totale, à chaque étape.',
    },
  ],
  en: [
    {
      emoji: '⚓',
      titre: 'Resilience',
      definition: 'The ability to get through hardship without burning out.',
      pourquoi:
        "It's our signature value — the bounce-back strength we bring to every diagnostic and every engagement.",
    },
    {
      emoji: '🍃',
      titre: 'Authenticity',
      definition: 'Being genuine, without a mask, in every engagement.',
      pourquoi:
        'Our partner firms choose a human approach before a method. Authenticity builds instant trust and cuts through impersonal corporate jargon.',
    },
    {
      emoji: '⚖️',
      titre: 'Accountability',
      definition: 'Owning your choices and their consequences.',
      pourquoi:
        'It shows we stand by our commitments, and pushes every firm to stay an active participant in its own sales journey.',
    },
    {
      emoji: '🎯',
      titre: 'Impact',
      definition: 'Concrete, measurable, lasting results.',
      pourquoi: "We're not here just to talk — we're here to generate real added value and visible sales performance.",
    },
    {
      emoji: '🚀',
      titre: 'Transformation',
      definition: 'Moving a situation, a person, an organization forward.',
      pourquoi: "It's our promise: a genuine before/after in how our partner firms prospect.",
    },
    {
      emoji: '🌱',
      titre: 'Human Commitment',
      definition: "Genuinely investing in the other person's success.",
      pourquoi: "Our partnerships aren't simple transactions — it's a deep commitment to each firm's success.",
    },
    {
      emoji: '🛡️',
      titre: 'Ethics',
      definition: 'Strictly respecting professional conduct and data confidentiality.',
      pourquoi: 'A strong signal to every firm and every prospect: a protected, sound, well-regulated workspace.',
    },
    {
      emoji: '💎',
      titre: 'Integrity',
      definition: 'Acting honestly, transparently, and in line with our principles.',
      pourquoi: 'We never hide a difficult diagnostic — we act with total clarity, every step of the way.',
    },
  ],
  ar: [
    {
      emoji: '⚓',
      titre: 'الصمود',
      definition: 'القدرة على تجاوز المحنة دون أن ننطفئ.',
      pourquoi: 'إنها قيمتنا المميزة — قوة النهوض التي ننقلها عبر كل تشخيص وكل مرافقة.',
    },
    {
      emoji: '🍃',
      titre: 'الأصالة',
      definition: 'أن نكون صادقين، دون قناع، في كل مرافقة.',
      pourquoi: 'تختار مكاتبنا الشريكة نهجًا إنسانيًا قبل المنهجية. الأصالة تخلق ثقة فورية وتكسر المصطلحات الرسمية غير الشخصية.',
    },
    {
      emoji: '⚖️',
      titre: 'المسؤولية',
      definition: 'تحمّل خياراتنا وعواقبها.',
      pourquoi: 'تثبت أننا نفي بالتزاماتنا، وتدفع كل مكتب ليبقى فاعلاً في مساره التجاري الخاص.',
    },
    {
      emoji: '🎯',
      titre: 'الأثر',
      definition: 'نتائج ملموسة وقابلة للقياس ودائمة.',
      pourquoi: 'لسنا هنا للحوار فقط، بل لتوليد قيمة مضافة حقيقية وأداء تجاري ملموس.',
    },
    {
      emoji: '🚀',
      titre: 'التحول',
      definition: 'دفع وضع، شخص، أو منظمة إلى الأمام.',
      pourquoi: 'إنه وعدنا: فرق حقيقي بين "قبل" و"بعد" في طريقة تنقيب مكاتبنا الشريكة.',
    },
    {
      emoji: '🌱',
      titre: 'الالتزام الإنساني',
      definition: 'الاستثمار الحقيقي في نجاح الآخر.',
      pourquoi: 'شراكاتنا ليست مجرد معاملات — إنها التزام عميق بنجاح كل مكتب.',
    },
    {
      emoji: '🛡️',
      titre: 'الأخلاقيات',
      definition: 'احترام صارم لأخلاقيات المهنة وسرية البيانات.',
      pourquoi: 'إشارة قوية لكل مكتب وكل عميل محتمل: مساحة عمل محمية وسليمة ومنظمة.',
    },
    {
      emoji: '💎',
      titre: 'النزاهة',
      definition: 'التصرف بصدق وشفافية وانسجام مع مبادئنا.',
      pourquoi: 'لا نُخفي أبدًا تشخيصًا صعبًا — نتصرف بوضوح تام، في كل خطوة.',
    },
  ],
}

function useLangueVisiteur() {
  const [langue, setLangue] = useState<Langue>('fr')
  useEffect(() => {
    const sauvegardee = window.localStorage.getItem('pilobrain_langue') as Langue | null
    if (sauvegardee === 'fr' || sauvegardee === 'en' || sauvegardee === 'ar') setLangue(sauvegardee)
  }, [])
  const changerLangue = (l: Langue) => {
    setLangue(l)
    window.localStorage.setItem('pilobrain_langue', l)
  }
  return { langue, changerLangue }
}

export default function Home() {
  const { langue, changerLangue } = useLangueVisiteur()
  const t = (cle: string) => traduire(langue, cle)
  const profils = PROFILS[langue]
  const valeurs = VALEURS[langue]

  return (
    <main
      className="min-h-screen bg-white dark:bg-[#014B43] text-ink dark:text-[#F9ECE5] font-sans antialiased transition-colors"
      dir={langue === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="max-w-[1180px] mx-auto px-7">
        {/* NAVBAR */}
        <nav className="flex items-center justify-between py-5 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full relative"
              style={{ background: 'conic-gradient(#1F6F78, #F0CC7A, #0F2540, #1F6F78)' }}
            >
              <div className="absolute inset-[6px] bg-white dark:bg-[#014B43] rounded-full" />
            </div>
            <div className="font-serif font-semibold text-[19px] tracking-tight">
              Pilo<span className="text-teal font-semibold">Brain</span>
            </div>
          </div>
          <div className="hidden md:flex gap-7 text-[14.5px] text-[#4B5768] dark:text-[#C9DAD5]">
            <a href="/" className="hover:text-ink dark:hover:text-white">{t('accueil_nav')}</a>
            <a href="#a-propos" className="hover:text-ink dark:hover:text-white">{t('a_propos_nav')}</a>
            <a href="/formation" className="hover:text-ink dark:hover:text-white">{t('formation_nav')}</a>
            <a href="/insights" className="hover:text-ink dark:hover:text-white">{t('insights_nav')}</a>
          </div>
          <div className="flex items-center gap-3.5">
            <ThemeToggle />
            <select
              value={langue}
              onChange={(e) => changerLangue(e.target.value as Langue)}
              className="text-[13px] text-[#7C8794] dark:text-[#C9DAD5] border border-slate-300 dark:border-white/15 rounded-lg px-2 py-1.5 bg-white dark:bg-white/5 hidden sm:inline-block"
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
              <option value="ar">AR</option>
            </select>
            <a
              href="/auth?mode=connexion"
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-ink dark:text-[#F9ECE5] hover:border-slate-400"
            >
              {t('se_connecter_nav')}
            </a>
            <a
              href="/secteurs"
              className="text-sm px-4 py-2 rounded-lg border-none bg-navy dark:bg-[#F9ECE5] text-white dark:text-[#014B43] font-semibold hover:bg-navy-deep dark:hover:bg-white"
            >
              {t('sinscrire_nav')}
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="grid grid-cols-1 md:grid-cols-[1.05fr_.95fr] gap-14 items-center py-16 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 text-[12.5px] tracking-wide uppercase text-teal bg-teal-light dark:bg-white/10 dark:text-[#6FCF9E] px-3 py-1.5 rounded-full font-bold">
              ● {t('hero_badge')}
            </span>
            <h1 className="font-serif italic font-medium text-[32px] md:text-[44px] leading-[1.14] mt-5 mb-5 text-navy-deep dark:text-[#F9ECE5]">
              {t('hero_titre_1')} <span className="not-italic text-teal font-semibold">{t('hero_titre_2')}</span>,
              <br />
              {t('hero_titre_3')}
            </h1>
            <p className="text-[16.5px] leading-relaxed text-[#4B5768] dark:text-[#C9DAD5] max-w-[480px] mb-7">{t('hero_description')}</p>
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="/decouvrir"
                className="text-sm px-[18px] py-[10px] rounded-lg bg-navy dark:bg-[#F9ECE5] text-white dark:text-[#014B43] font-semibold hover:bg-navy-deep dark:hover:bg-white"
              >
                {t('decouvrir_cta')}
              </a>
              <a
                href="/demo"
                className="text-sm px-4 py-[9px] rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-ink dark:text-[#F9ECE5] hover:border-slate-400"
              >
                {t('voir_demo_cta')}
              </a>
            </div>
          </div>

          <div className="relative h-[320px] md:h-[400px]">
            <div
              className="absolute inset-0 rounded-[20px] overflow-hidden"
              style={{ background: 'radial-gradient(circle at 30% 20%, #16344F 0%, #0A1A2E 60%)' }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" fill="none">
                <g stroke="#2E6F78" strokeWidth={1} opacity={0.55}>
                  <line x1="60" y1="90" x2="180" y2="150" />
                  <line x1="180" y1="150" x2="300" y2="100" />
                  <line x1="180" y1="150" x2="150" y2="270" />
                  <line x1="150" y1="270" x2="280" y2="300" />
                  <line x1="180" y1="150" x2="320" y2="230" />
                  <line x1="60" y1="90" x2="150" y2="270" />
                </g>
                <g fill="#F0CC7A">
                  <circle cx="60" cy="90" r="4" />
                  <circle cx="300" cy="100" r="4" />
                  <circle cx="280" cy="300" r="4" />
                </g>
                <g fill="#1F6F78">
                  <circle cx="150" cy="270" r="5" />
                  <circle cx="320" cy="230" r="4" />
                </g>
                <circle cx="180" cy="150" r="8" fill="#ffffff" />
              </svg>
              <div className="absolute top-[16%] left-[8%] bg-white rounded-xl px-[13px] py-[10px] shadow-lg text-[12.5px] font-bold flex items-center gap-2 text-navy-deep">
                <span className="w-2 h-2 rounded-full bg-[#22C58B]" /> Score 82/100
              </div>
              <div className="absolute bottom-[18%] right-[10%] bg-white rounded-xl px-[13px] py-[10px] shadow-lg text-[12.5px] font-bold flex items-center gap-2 text-navy-deep">
                <span className="w-2 h-2 rounded-full bg-gold" /> Golfe · USD
              </div>
            </div>
          </div>
        </section>

        {/* COMMENT NOUS AIDONS */}
        <section id="a-propos" className="py-14 md:py-[70px]">
          <div className="max-w-[560px] mb-11">
            <span className="text-[12.5px] tracking-widest uppercase text-teal dark:text-[#6FCF9E] font-bold">{t('pour_qui_label')}</span>
            <h2 className="font-serif text-[26px] md:text-[30px] font-medium mt-3 mb-2.5 text-navy-deep dark:text-[#F9ECE5]">
              {t('moteur_metiers_titre')}
            </h2>
            <p className="text-[#5B6675] dark:text-[#C9DAD5] text-[15.5px] leading-relaxed">{t('moteur_metiers_desc')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {profils.map((profil) => (
              <div
                key={profil.titre}
                className="relative border border-slate-100 dark:border-white/10 rounded-2xl p-6 bg-white dark:bg-white/[0.04] transition hover:border-slate-300 dark:hover:border-white/20"
              >
                {!profil.active && (
                  <span className="absolute top-5 right-5 text-[10.5px] font-bold uppercase tracking-wide text-[#8892A0] dark:text-[#9FBDB5] bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-full">
                    {t('bientot_badge')}
                  </span>
                )}
                <div className="w-[11px] h-[11px] rounded-[3px] mb-4" style={{ background: profil.dotColor }} />
                <h3 className="font-serif text-[19px] font-semibold mb-2 text-navy-deep dark:text-[#F9ECE5]">{profil.titre}</h3>
                <p className="text-sm leading-relaxed text-[#5B6675] dark:text-[#C9DAD5]">{profil.description}</p>
                <span className="inline-block mt-3.5 text-[11.5px] font-bold uppercase tracking-wide text-[#8892A0] dark:text-[#9FBDB5]">
                  {profil.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* NOS VALEURS */}
        <section className="py-14 md:py-[70px] border-t border-slate-100 dark:border-white/10">
          <div className="max-w-[560px] mb-11">
            <span className="text-[12.5px] tracking-widest uppercase text-teal dark:text-[#6FCF9E] font-bold">{t('nos_valeurs_label')}</span>
            <h2 className="font-serif text-[26px] md:text-[30px] font-medium mt-3 mb-2.5 text-navy-deep dark:text-[#F9ECE5]">
              {t('nos_valeurs_titre')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {valeurs.map((v) => (
              <div key={v.titre} className="border border-slate-100 dark:border-white/10 rounded-2xl p-6 bg-white dark:bg-white/[0.04] transition hover:border-slate-300 dark:hover:border-white/20">
                <h3 className="font-serif text-[17px] font-semibold mb-1.5 text-navy-deep dark:text-[#F9ECE5]">
                  {v.emoji} {v.titre}
                </h3>
                <p className="text-sm text-[#4B5768] dark:text-[#C9DAD5] mb-2 italic">{v.definition}</p>
                <p className="text-sm leading-relaxed text-[#5B6675] dark:text-[#C9DAD5]">{v.pourquoi}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <div className="max-w-[1180px] mx-auto px-7">
        <footer className="bg-navy-deep text-[#EAF0F5] rounded-[28px] my-10 px-6 py-12 md:px-12 md:py-16">
          <div className="text-center max-w-[640px] mx-auto">
            <h2 className="font-serif italic font-medium text-[26px] md:text-[32px] mb-4">{t('footer_titre')}</h2>
            <p className="text-[#9FB0C2] text-[15px] leading-relaxed mb-7">{t('footer_desc')}</p>
            <a
              href="/secteurs"
              className="inline-block bg-white text-navy-deep border-none px-[22px] py-3 rounded-[9px] font-bold text-[14.5px] hover:bg-slate-100"
            >
              {t('footer_cta')}
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-14 pt-10 border-t border-white/10 text-[13.5px] text-[#B9C6D4]">
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">{t('footer_plateforme')}</b>
              <ul className="space-y-2">
                <li><a href="/" className="hover:text-white">{t('accueil_nav')}</a></li>
                <li><a href="#a-propos" className="hover:text-white">{t('footer_a_propos')}</a></li>
                <li><a href="/formation" className="hover:text-white">{t('formation_nav')}</a></li>
                <li><a href="/insights" className="hover:text-white">{t('insights_nav')}</a></li>
              </ul>
            </div>
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">{t('footer_secteurs')}</b>
              <ul className="space-y-2">
                {profils.map((p) => (
                  <li key={p.titre} className="flex items-center gap-2">
                    <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: p.active ? '#4ADE80' : '#5B6675' }} />
                    {p.titre}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">{t('footer_ressources')}</b>
              <ul className="space-y-2">
                <li><a href="/politique-confidentialite" className="hover:text-white">{t('footer_confidentialite')}</a></li>
                <li><a href="/cgu" className="hover:text-white">{t('footer_cgu')}</a></li>
                <li><a href="/mentions-legales" className="hover:text-white">{t('footer_mentions')}</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-[12.5px] text-[#7488A0] pt-5 border-t border-white/10">
            <span>
              © {new Date().getFullYear()} PiloBrain — {t('footer_copyright')}
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
