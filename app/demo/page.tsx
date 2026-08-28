export default function DemoPage() {
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

        <h1 className="text-3xl md:text-4xl font-extrabold mb-4">Démo — 2 minutes pour tout comprendre</h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-[680px]">
          Un aperçu rapide du parcours complet, du ciblage jusqu'au rendez-vous décroché.
        </p>

        {/*
          EMPLACEMENT POUR LA VRAIE VIDÉO :
          Remplace le bloc ci-dessous par un vrai lecteur une fois la vidéo
          enregistrée (Loom, YouTube non répertorié, ou fichier .mp4 uploadé
          quelque part). Exemple avec une vidéo YouTube :

          <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/TON_ID_VIDEO"
              title="Démo PiloBrain"
              allowFullScreen
            />
          </div>

          Ou avec un fichier vidéo direct :
          <video controls className="w-full rounded-2xl border border-slate-700">
            <source src="/demo-pilobrain.mp4" type="video/mp4" />
          </video>
        */}
        <div className="aspect-video rounded-2xl border border-dashed border-slate-700 bg-slate-900 flex flex-col items-center justify-center gap-3 mb-14">
          <span className="text-5xl">🎬</span>
          <p className="text-slate-400 text-sm max-w-sm text-center px-4">
            Vidéo de démonstration à venir. En attendant, voici le parcours détaillé ci-dessous.
          </p>
        </div>

        <div className="space-y-8">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-xs text-accent font-semibold uppercase mb-2">Étape 1 · Ciblage</p>
            <h2 className="text-lg font-bold mb-2">Vous réglez qui vous voulez toucher</h2>
            <p className="text-slate-400 text-sm">
              Secteur, taille d'entreprise, poste des décideurs, zone géographique (Tunisie, Golfe,
              international) — quelques clics suffisent.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-xs text-accent font-semibold uppercase mb-2">Étape 2 · Premier contact</p>
            <h2 className="text-lg font-bold mb-2">Le premier message part automatiquement</h2>
            <p className="text-slate-400 text-sm">
              Par email ou WhatsApp selon la zone du prospect — vous gardez la main sur le texte envoyé.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-xs text-accent font-semibold uppercase mb-2">Étape 3 · Diagnostic IA</p>
            <h2 className="text-lg font-bold mb-2">
              Score de chaleur, besoin sous-jacent, plan d'action — généré pour vous
            </h2>
            <p className="text-slate-400 text-sm">
              Dès qu'un prospect répond positivement, l'IA prépare un diagnostic complet que vous
              relisez et validez avant envoi.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <p className="text-xs text-accent font-semibold uppercase mb-2">Étape 4 · Pipeline & Calendrier</p>
            <h2 className="text-lg font-bold mb-2">Vous suivez, la plateforme relance</h2>
            <p className="text-slate-400 text-sm">
              Kanban visuel par étape, relances automatiques si silence, rendez-vous bloqués directement
              dans votre calendrier.
            </p>
          </div>
        </div>

        <div className="mt-14 text-center">
          <a
            href="/secteurs"
            className="inline-block text-sm px-5 py-2.5 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90"
          >
            Essayer maintenant →
          </a>
        </div>
      </div>
    </main>
  )
}
