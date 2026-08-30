export default function FormationPage() {
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

        {/*
          Page en attente de contenu : Omaima a indique vouloir y placer un
          programme de formation lie a la commercialisation. Structure prete
          a recevoir titre / modules / prix / CTA d'inscription - il suffit
          de remplacer le texte ci-dessous.
        */}
        <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Formation</span>
        <h1 className="font-serif text-[32px] md:text-[40px] font-medium mt-3 mb-5 text-navy-deep">
          Programme de formation à la commercialisation
        </h1>
        <p className="text-[#5B6675] text-[16.5px] leading-relaxed max-w-[640px] mb-12">
          [Contenu à venir — décris ici le programme : pour qui, ce qu'on y apprend, durée, format
          (présentiel/en ligne), et ce qui le rend différent d'une formation commerciale classique.]
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {['Module 1', 'Module 2', 'Module 3'].map((m) => (
            <div key={m} className="border border-slate-100 rounded-2xl p-6">
              <h3 className="font-serif text-[17px] font-semibold mb-2 text-navy-deep">{m}</h3>
              <p className="text-sm text-[#5B6675]">[Titre et description du module à préciser]</p>
            </div>
          ))}
        </div>

        <a
          href="/decouvrir"
          className="inline-block text-sm px-[18px] py-[10px] rounded-lg bg-navy text-white font-semibold hover:bg-navy-deep"
        >
          En savoir plus →
        </a>
      </div>
    </main>
  )
}
