const profils = [
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
    description:
      "Chasse de mandats automatisée — expertise comptable, avocats d'affaires, conformité.",
    tag: 'Conformité',
    dotColor: '#8892A0',
    active: false,
  },
  {
    titre: 'Logistique, Transit & Services Généraux',
    description:
      'Transitaires, maintenance industrielle, facility management, événementiel B2B.',
    tag: 'Logistique',
    dotColor: '#8892A0',
    active: false,
  },
]

const valeurs = [
  {
    emoji: '⚓',
    titre: 'Résilience',
    definition: "La capacité à traverser l'épreuve sans s'éteindre.",
    pourquoi: "C'est notre valeur signature — la force de rebond que nous transmettons à travers chaque diagnostic et chaque accompagnement.",
  },
  {
    emoji: '🍃',
    titre: 'Authenticité',
    definition: 'Être vrai, sans masque, dans l\'accompagnement.',
    pourquoi: 'Nos cabinets partenaires choisissent une approche humaine avant une méthode. L\'authenticité crée une confiance immédiate et casse le jargon corporate impersonnel.',
  },
  {
    emoji: '⚖️',
    titre: 'Responsabilité',
    definition: 'Assumer ses choix et leurs conséquences.',
    pourquoi: 'Elle prouve que nous assumons nos engagements, et pousse chaque cabinet à rester acteur de sa propre trajectoire commerciale.',
  },
  {
    emoji: '🎯',
    titre: 'Impact',
    definition: 'Des résultats concrets, mesurables et durables.',
    pourquoi: "Nous ne sommes pas là pour échanger, mais pour générer une vraie valeur ajoutée et une performance commerciale visible.",
  },
  {
    emoji: '🚀',
    titre: 'Transformation',
    definition: 'Faire évoluer une situation, une personne, une organisation.',
    pourquoi: "C'est notre promesse : un véritable avant/après dans la façon dont nos cabinets partenaires prospectent.",
  },
  {
    emoji: '🌱',
    titre: 'Engagement Humain',
    definition: "S'investir réellement dans la réussite de l'autre.",
    pourquoi: 'Nos partenariats ne sont pas de simples transactions — c\'est un engagement de fond dans la réussite de chaque cabinet.',
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
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-ink font-sans antialiased">
      <div className="max-w-[1180px] mx-auto px-7">
        {/* NAVBAR */}
        <nav className="flex items-center justify-between py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full relative"
              style={{ background: 'conic-gradient(#1F6F78, #F0CC7A, #0F2540, #1F6F78)' }}
            >
              <div className="absolute inset-[6px] bg-white rounded-full" />
            </div>
            <div className="font-serif font-semibold text-[19px] tracking-tight">
              Pilo<span className="text-teal font-semibold">Brain</span>
            </div>
          </div>
          <div className="hidden md:flex gap-7 text-[14.5px] text-[#4B5768]">
            <a href="/" className="hover:text-ink">Accueil</a>
            <a href="#a-propos" className="hover:text-ink">À propos</a>
            <a href="/formation" className="hover:text-ink">Formation</a>
            <a href="/insights" className="hover:text-ink">Insights</a>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-[13px] text-[#7C8794] border border-slate-300 rounded-lg px-2.5 py-1.5 hidden sm:inline-block">
              FR
            </span>
            <a
              href="/auth?mode=connexion"
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
            >
              Se connecter
            </a>
            <a
              href="/secteurs"
              className="text-sm px-4 py-2 rounded-lg border-none bg-navy text-white font-semibold hover:bg-navy-deep"
            >
              S&apos;inscrire
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="grid grid-cols-1 md:grid-cols-[1.05fr_.95fr] gap-14 items-center py-16 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 text-[12.5px] tracking-wide uppercase text-teal bg-teal-light px-3 py-1.5 rounded-full font-bold">
              ● Commercialisation assistée par IA
            </span>
            <h1 className="font-serif italic font-medium text-[32px] md:text-[44px] leading-[1.14] mt-5 mb-5 text-navy-deep">
              Le diagnostic commercial <span className="not-italic text-teal font-semibold">d&apos;un expert</span>,
              <br />
              à la vitesse d&apos;une IA.
            </h1>
            <p className="text-[16.5px] leading-relaxed text-[#4B5768] max-w-[480px] mb-7">
              PiloBrain automatise le ciblage, la qualification et le suivi de vos prospects — en
              Tunisie comme à l&apos;international — pour que votre équipe passe son temps à conclure,
              pas à chercher.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="/decouvrir"
                className="text-sm px-[18px] py-[10px] rounded-lg bg-navy text-white font-semibold hover:bg-navy-deep"
              >
                Découvrir PiloBrain →
              </a>
              <a
                href="/demo"
                className="text-sm px-4 py-[9px] rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
              >
                Voir une démo
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
            <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Pour qui</span>
            <h2 className="font-serif text-[26px] md:text-[30px] font-medium mt-3 mb-2.5 text-navy-deep">
              Un moteur, six métiers
            </h2>
            <p className="text-[#5B6675] text-[15.5px] leading-relaxed">
              PiloBrain s&apos;adapte au vocabulaire et à la méthodologie de votre secteur —
              vous gardez le même outil, vos prospects voient un diagnostic qui parle leur langue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {profils.map((profil) => (
              <div
                key={profil.titre}
                className="relative border border-slate-100 rounded-2xl p-6 bg-white transition hover:border-slate-300"
              >
                {!profil.active && (
                  <span className="absolute top-5 right-5 text-[10.5px] font-bold uppercase tracking-wide text-[#8892A0] bg-slate-100 px-2 py-1 rounded-full">
                    Bientôt
                  </span>
                )}
                <div
                  className="w-[11px] h-[11px] rounded-[3px] mb-4"
                  style={{ background: profil.dotColor }}
                />
                <h3 className="font-serif text-[19px] font-semibold mb-2 text-navy-deep">
                  {profil.titre}
                </h3>
                <p className="text-sm leading-relaxed text-[#5B6675]">{profil.description}</p>
                <span className="inline-block mt-3.5 text-[11.5px] font-bold uppercase tracking-wide text-[#8892A0]">
                  {profil.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* NOS VALEURS */}
        <section className="py-14 md:py-[70px] border-t border-slate-100">
          <div className="max-w-[560px] mb-11">
            <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Nos valeurs</span>
            <h2 className="font-serif text-[26px] md:text-[30px] font-medium mt-3 mb-2.5 text-navy-deep">
              Ce qui guide chaque accompagnement
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {valeurs.map((v) => (
              <div
                key={v.titre}
                className="border border-slate-100 rounded-2xl p-6 bg-white transition hover:border-slate-300"
              >
                <h3 className="font-serif text-[17px] font-semibold mb-1.5 text-navy-deep">
                  {v.emoji} {v.titre}
                </h3>
                <p className="text-sm text-[#4B5768] mb-2 italic">{v.definition}</p>
                <p className="text-sm leading-relaxed text-[#5B6675]">{v.pourquoi}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <div className="max-w-[1180px] mx-auto px-7">
        <footer className="bg-navy-deep text-[#EAF0F5] rounded-[28px] my-10 px-6 py-12 md:px-12 md:py-16">
          <div className="text-center max-w-[640px] mx-auto">
            <h2 className="font-serif italic font-medium text-[26px] md:text-[32px] mb-4">
              Prêt à propulser vos revenus ?
            </h2>
            <p className="text-[#9FB0C2] text-[15px] leading-relaxed mb-7">
              Un diagnostic généré en quelques minutes, validé par votre expertise avant chaque envoi.
            </p>
            <a
              href="/secteurs"
              className="inline-block bg-white text-navy-deep border-none px-[22px] py-3 rounded-[9px] font-bold text-[14.5px] hover:bg-slate-100"
            >
              On s&apos;occupe de tout →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-14 pt-10 border-t border-white/10 text-[13.5px] text-[#B9C6D4]">
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">Plateforme</b>
              <ul className="space-y-2">
                <li><a href="/" className="hover:text-white">Accueil</a></li>
                <li><a href="#a-propos" className="hover:text-white">À propos de nous</a></li>
                <li><a href="/formation" className="hover:text-white">Formation</a></li>
                <li><a href="/insights" className="hover:text-white">Insights</a></li>
              </ul>
            </div>
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">Secteurs</b>
              <ul className="space-y-2">
                {profils.map((p) => (
                  <li key={p.titre} className="flex items-center gap-2">
                    <span
                      className="w-[6px] h-[6px] rounded-full shrink-0"
                      style={{ background: p.active ? '#4ADE80' : '#5B6675' }}
                    />
                    {p.titre}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <b className="block text-white text-[14.5px] mb-3 font-serif font-semibold">Ressources</b>
              <ul className="space-y-2">
                <li>
                  <a href="/politique-confidentialite" className="hover:text-white">
                    Politique de confidentialité
                  </a>
                </li>
                <li>
                  <a href="/cgu" className="hover:text-white">
                    Conditions d&apos;utilisation
                  </a>
                </li>
                <li>
                  <a href="/mentions-legales" className="hover:text-white">
                    Mentions légales
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-[12.5px] text-[#7488A0] pt-5 border-t border-white/10">
            <span>
              © {new Date().getFullYear()} PiloBrain — Tous droits réservés — De l&apos;épreuve à l&apos;élan
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
