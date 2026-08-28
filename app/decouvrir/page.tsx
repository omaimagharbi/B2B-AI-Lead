export default function DecouvrirPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white font-sans antialiased">
      <div className="max-w-[900px] mx-auto px-6 py-16">
        <nav className="flex items-center justify-between mb-14">
          <a href="/" className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full relative"
              style={{ background: 'conic-gradient(#1F6F78, #F0CC7A, #0F2540, #1F6F78)' }}
            >
              <div className="absolute inset-[6px] bg-slate-950 rounded-full" />
            </div>
            <div className="font-serif font-semibold text-[19px] tracking-tight">
              Pilo<span className="text-teal font-semibold">Brain</span>
            </div>
          </a>
          <a
            href="/secteurs"
            className="text-sm px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90"
          >
            Commencer →
          </a>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold mb-4">
          Comment PiloBrain remplace des heures de prospection manuelle
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-14 max-w-[680px]">
          PiloBrain n'est pas un annuaire de contacts ni un CRM de plus. C'est une plateforme qui trouve,
          qualifie et relance vos prospects à votre place — pour que votre équipe passe son temps à
          conclure, pas à chercher.
        </p>

        <div className="space-y-10">
          <section className="flex gap-5">
            <div className="w-10 h-10 rounded-full bg-teal/20 border border-teal flex items-center justify-center text-teal font-bold shrink-0">
              1
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Vous définissez votre cible</h2>
              <p className="text-slate-400 leading-relaxed">
                Secteur, taille d'entreprise, poste des décideurs, zone géographique — vous réglez vos
                critères une fois, la plateforme s'en souvient.
              </p>
            </div>
          </section>

          <section className="flex gap-5">
            <div className="w-10 h-10 rounded-full bg-teal/20 border border-teal flex items-center justify-center text-teal font-bold shrink-0">
              2
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">La plateforme trouve et contacte vos prospects</h2>
              <p className="text-slate-400 leading-relaxed">
                Sourcing automatique ou import de votre propre liste, premier message envoyé
                automatiquement par email ou WhatsApp selon la zone du prospect.
              </p>
            </div>
          </section>

          <section className="flex gap-5">
            <div className="w-10 h-10 rounded-full bg-teal/20 border border-teal flex items-center justify-center text-teal font-bold shrink-0">
              3
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">L'IA détecte l'intérêt et prépare le diagnostic</h2>
              <p className="text-slate-400 leading-relaxed">
                Dès qu'un prospect répond positivement, vous êtes notifié et un diagnostic personnalisé
                (score de chaleur, besoin sous-jacent, plan d'action) est généré pour vous — vous
                validez avant l'envoi, l'IA ne décide jamais seule à votre place.
              </p>
            </div>
          </section>

          <section className="flex gap-5">
            <div className="w-10 h-10 rounded-full bg-teal/20 border border-teal flex items-center justify-center text-teal font-bold shrink-0">
              4
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Vous pilotez, la plateforme relance</h2>
              <p className="text-slate-400 leading-relaxed">
                Pipeline visuel, calendrier de rendez-vous, relances automatiques si un prospect ne
                répond pas — rien ne tombe dans l'oubli.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-16 rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
          <p className="text-lg font-semibold mb-4">Prêt à voir ça sur vos propres prospects ?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/secteurs"
              className="text-sm px-5 py-2.5 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90"
            >
              Choisir mon secteur →
            </a>
            <a
              href="/demo"
              className="text-sm px-5 py-2.5 rounded-lg border border-slate-600 hover:border-slate-400"
            >
              Voir la démo
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
