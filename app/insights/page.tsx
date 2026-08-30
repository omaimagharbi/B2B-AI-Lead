// Articles ecrits par Omaima - liste vide en attente du contenu reel.
// Format attendu pour chaque entree : titre, resume (2-3 phrases), et le
// texte complet (ou un lien si publie ailleurs). Remplacer ce tableau une
// fois les articles fournis.
const articles: { titre: string; resume: string; date: string }[] = []

export default function InsightsPage() {
  return (
    <main className="min-h-screen bg-white text-ink font-sans antialiased">
      <div className="max-w-[900px] mx-auto px-6 py-16">
        <nav className="flex items-center justify-between mb-14">
          <a href="/" className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full relative"
              style={{ background: 'conic-gradient(#1F6F78, #F0CC7A, #0F2540, #1F6F78)' }}
            >
              <div className="absolute inset-[6px] bg-white rounded-full" />
            </div>
            <div className="font-serif font-semibold text-[19px] tracking-tight">
              Pilo<span className="text-teal font-semibold">Brain</span>
            </div>
          </a>
          <a href="/" className="text-sm text-[#4B5768] hover:text-ink">
            ← Retour à l'accueil
          </a>
        </nav>

        <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Insights</span>
        <h1 className="font-serif text-[32px] md:text-[40px] font-medium mt-3 mb-5 text-navy-deep">
          Articles &amp; réflexions
        </h1>
        <p className="text-[#5B6675] text-[16.5px] leading-relaxed max-w-[640px] mb-12">
          Retours d&apos;expérience terrain sur la commercialisation, la formation et la prospection.
        </p>

        {articles.length === 0 ? (
          <p className="text-[#8892A0] text-sm italic">
            Aucun article pour le moment.
          </p>
        ) : (
          <div className="space-y-8">
            {articles.map((a) => (
              <article key={a.titre} className="border-b border-slate-100 pb-8">
                <span className="text-[12px] text-[#8892A0]">{a.date}</span>
                <h2 className="font-serif text-[21px] font-semibold mt-1 mb-2 text-navy-deep">{a.titre}</h2>
                <p className="text-sm leading-relaxed text-[#5B6675]">{a.resume}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
