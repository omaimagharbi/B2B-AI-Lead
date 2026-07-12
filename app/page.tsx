import Link from 'next/link'

const cartes = [
  {
    slug: 'cabinet-formation',
    titre: 'Cabinet de Formation & Conseil',
    description: 'Recevez des prospects qualifiés, prêts à signer, sans effort de prospection.',
    active: true,
  },
  {
    slug: 'startup-saas',
    titre: 'Startup Tech & SaaS',
    description: 'Recevez des audits techniques qualifiés directement dans votre pipeline.',
    active: true,
  },
  {
    slug: 'pme-services',
    titre: 'PME de Services & Entreprises',
    description: 'Recevez des audits organisationnels qualifiés directement dans votre pipeline.',
    active: true,
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-4xl w-full text-center space-y-4 mb-12">
        <h1 className="text-3xl md:text-5xl font-bold">
          Des prospects qualifiés, livrés automatiquement
        </h1>
        <p className="text-slate-400 text-lg">
          Choisissez votre secteur pour commencer
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {cartes.map((carte) =>
          carte.active ? (
            <Link
              key={carte.slug}
              href={`/auth?vertical=${carte.slug}`}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-6 hover:border-accent hover:bg-slate-800 transition space-y-3 cursor-pointer"
            >
              <h2 className="text-xl font-semibold">{carte.titre}</h2>
              <p className="text-slate-400">{carte.description}</p>
              <span className="inline-block text-accent font-semibold">Commencer →</span>
            </Link>
          ) : (
            <div
              key={carte.slug}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3 opacity-50 cursor-not-allowed"
            >
              <h2 className="text-xl font-semibold">{carte.titre}</h2>
              <p className="text-slate-500">{carte.description}</p>
              <span className="inline-block text-slate-600 font-semibold text-sm">
                Bientôt disponible
              </span>
            </div>
          )
        )}
      </div>

      <footer className="mt-16 text-center text-slate-600 text-xs space-x-4">
        <a href="/mentions-legales" className="hover:text-slate-400 underline">
          Mentions légales
        </a>
        <a href="/cgu" className="hover:text-slate-400 underline">
          CGU
        </a>
        <a href="/politique-confidentialite" className="hover:text-slate-400 underline">
          Politique de confidentialité
        </a>
      </footer>
    </main>
  )
}
