export default function PolitiqueConfidentialite() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6 text-slate-300">
        <h1 className="text-3xl font-bold text-white">Politique de confidentialité</h1>
        <p className="text-amber-400 text-sm border border-amber-700 bg-amber-950/30 rounded-lg p-3">
          ⚠️ Ceci est un brouillon générique, à faire relire et adapter par un juriste avant
          publication réelle, notamment pour la conformité RGPD (France/Belgique/UE) et la loi
          tunisienne sur la protection des données personnelles.
        </p>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">1. Données collectées</h2>
          <p>
            Nous collectons des informations professionnelles publiques (nom, poste, entreprise,
            coordonnées professionnelles) dans le cadre de notre activité de mise en relation
            commerciale B2B, ainsi que les informations que vous nous transmettez volontairement
            lors de l'utilisation de notre outil de diagnostic.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">2. Finalité du traitement</h2>
          <p>
            Ces données sont utilisées exclusivement pour vous proposer un accompagnement
            professionnel personnalisé de la part du cabinet partenaire concerné.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">3. Vos droits</h2>
          <p>
            Conformément à la réglementation applicable, vous disposez d'un droit d'accès, de
            rectification et de suppression de vos données. Vous pouvez vous désinscrire à tout
            moment via le lien présent dans chaque message reçu.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">4. Contact</h2>
          <p>Pour toute question relative à vos données : [à compléter avec votre email de contact]</p>
        </section>
      </div>
    </main>
  )
}
