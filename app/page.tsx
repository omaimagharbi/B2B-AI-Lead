const profils = [
  {
    titre: 'Cabinet de Formation & Consulting',
    description:
      'Ciblage de DRH et responsables formation, diagnostic bâti sur la méthodologie ADDIE, suivi des conventions signées.',
    tag: 'Formation',
    dotColor: '#1F6F78',
  },
  {
    titre: 'Startups & Éditeurs SaaS',
    description:
      'Qualification des prospects techniques, argumentaire adapté aux décideurs produit, pipeline commercial dédié.',
    tag: 'Tech',
    dotColor: '#F0CC7A',
  },
  {
    titre: 'PME de Services',
    description:
      'Prospection de missions et prestations, diagnostic orienté cadrage de besoin plutôt que catalogue produit.',
    tag: 'Services',
    dotColor: '#0F2540',
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
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-[13px] text-[#7C8794] border border-slate-300 rounded-lg px-2.5 py-1.5 hidden sm:inline-block">
              FR
            </span>
            <a
              href="/auth"
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
            >
              Se connecter
            </a>
            <a
              href="/secteurs"
              className="text-sm px-4.5 py-2.5 rounded-lg border-none bg-navy text-white font-semibold hover:bg-navy-deep"
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
                href="/secteurs"
                className="text-sm px-[18px] py-[10px] rounded-lg bg-navy text-white font-semibold hover:bg-navy-deep"
              >
                Découvrir PiloBrain →
              </a>
              <a
                href="/auth"
                className="text-sm px-4 py-[9px] rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
              >
                Voir une démo
              </a>
            </div>
            <div className="mt-8 text-[13px] text-[#8892A0] flex gap-2 items-center">
              <span className="text-ink font-bold">Conçu par une experte terrain</span> — certifiée PMP, 12 ans d&apos;expérience commerciale &amp; formation
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
              Un moteur, trois métiers
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
                className="border border-slate-100 rounded-2xl p-6 bg-white transition hover:border-slate-300"
              >
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
      </div>

      {/* FOOTER */}
      <div className="max-w-[1180px] mx-auto px-7">
        <footer className="bg-navy-deep text-[#EAF0F5] rounded-[28px] my-10 px-6 py-12 md:px-12 md:py-16">
          <div className="text-center max-w-[640px] mx-auto">
            <h2 className="font-serif italic font-medium text-[26px] md:text-[32px] mb-4">
              Prêt à structurer votre prospection ?
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 my-14 pt-10 border-t border-white/10">
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">Formation &amp; Consulting</b>
              Ciblage DRH, diagnostic ADDIE, suivi de conventions.
            </div>
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">Startups &amp; SaaS</b>
              Qualification technique et pipeline dédié.
            </div>
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">PME de Services</b>
              Cadrage de besoin et suivi de missions.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-[12.5px] text-[#7488A0] pt-5 border-t border-white/10">
            <span>© PiloBrain — De l&apos;épreuve à l&apos;élan</span>
            <span className="space-x-4">
              <a href="/mentions-legales" className="hover:text-white underline">
                Mentions légales
              </a>
              <a href="/cgu" className="hover:text-white underline">
                CGU
              </a>
              <a href="/politique-confidentialite" className="hover:text-white underline">
                Politique de confidentialité
              </a>
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
