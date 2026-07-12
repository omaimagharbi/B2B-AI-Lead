export default function MentionsLegales() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6 text-slate-300">
        <h1 className="text-3xl font-bold text-white">Mentions légales</h1>
        <p className="text-amber-400 text-sm border border-amber-700 bg-amber-950/30 rounded-lg p-3">
          ⚠️ À compléter avec tes vraies informations légales (nom exact de l'entité, forme
          juridique si applicable, adresse, numéro d'identification fiscale/RNE, hébergeur).
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Éditeur du site</h2>
          <p>[Nom / raison sociale] — [Adresse] — [Contact]</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Hébergement</h2>
          <p>Vercel Inc. — 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
        </section>
      </div>
    </main>
  )
}
