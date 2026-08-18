'use client'

import { useState } from 'react'

const cartes = [
  {
    slug: 'cabinet-formation',
    titre: 'Formation & Conseil RH',
    description: 'Recevez des prospects qualifiés, prêts à signer, sans effort de prospection.',
    dotColor: '#1F6F78',
    active: true,
    sousSecteurs: [
      'Cabinet de Formation Professionnelle',
      'Organisme de Coaching Exécutif & Dirigeants',
      'Cabinet de Recrutement & Chasseur de Têtes',
      'Centre de Reconversion & École Privée',
    ],
  },
  {
    slug: 'startup-saas',
    titre: 'Startups & Éditeurs de Logiciels',
    description: 'Recevez des audits techniques qualifiés directement dans votre pipeline.',
    dotColor: '#F0CC7A',
    active: true,
    sousSecteurs: [
      'Éditeur de Logiciel SaaS (B2B / B2C)',
      'Start-up Tech / DeepTech / FinTech',
      'Plateforme Digitale / Marketplace B2B',
    ],
  },
  {
    slug: 'pme-services',
    titre: 'PME & Entreprises de Croissance',
    description: 'Recevez des audits organisationnels qualifiés directement dans votre pipeline.',
    dotColor: '#0F2540',
    active: true,
    sousSecteurs: [
      'Constructeur & Fournisseur Industriel B2B',
      'Entreprise de Distribution & Grossiste',
      'Société de Services Traditionnels B2B',
    ],
  },
  {
    slug: 'investisseur-incubateur',
    titre: 'Écosystème Entrepreneurial',
    description: "Sourcez du dealflow qualifié : fondateurs et startups prêts à être contactés.",
    dotColor: '#1F6F78',
    active: true,
    sousSecteurs: [
      'Fonds de Capital-Risque (VC / Venture Capital)',
      'Réseau de Business Angels',
      'Incubateur & Accélérateur de Startups',
      'Cabinet de Conseil en Levée de Fonds',
    ],
  },
  {
    slug: 'comptable-fiscal',
    titre: 'Cabinet Comptable, Juridique & Fiscal',
    description: 'Automatisez la chasse de mandats — expertise comptable, avocats d\'affaires, conformité.',
    dotColor: '#8892A0',
    active: false,
    sousSecteurs: [
      'Expertise Comptable',
      "Avocats d'Affaires",
      'Conseil Fiscal',
      'Cabinet de Conformité',
    ],
  },
  {
    slug: 'services-generaux',
    titre: 'Logistique, Transit & Services Généraux',
    description: 'Transitaires, maintenance industrielle, facility management, événementiel B2B.',
    dotColor: '#8892A0',
    active: false,
    sousSecteurs: [
      'Transitaire / Transit',
      'Maintenance Industrielle',
      'Facility Management',
      'Événementiel B2B',
    ],
  },
]

export default function Secteurs() {
  const [carteOuverte, setCarteOuverte] = useState<string | null>(null)
  const [carteBeta, setCarteBeta] = useState<{ slug: string; titre: string } | null>(null)
  const [email, setEmail] = useState('')
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [telephone, setTelephone] = useState('')
  const [sousSecteur, setSousSecteur] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confirme, setConfirme] = useState(false)

  const choisirSousSecteurBeta = (carte: (typeof cartes)[number], choix: string) => {
    setCarteOuverte(null)
    setSousSecteur(choix)
    setCarteBeta({ slug: carte.slug, titre: carte.titre })
  }

  const formulaireValide = email.trim() && nomEntreprise.trim() && telephone.trim()

  const envoyerDemandeBeta = async () => {
    if (!carteBeta || !formulaireValide) return
    setEnvoiEnCours(true)
    try {
      await fetch('/api/beta/demande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nom_entreprise: nomEntreprise,
          telephone,
          carte_slug: carteBeta.slug,
          sous_secteur: sousSecteur || null,
        }),
      })
      setConfirme(true)
    } finally {
      setEnvoiEnCours(false)
    }
  }

  const fermerModal = () => {
    setCarteBeta(null)
    setEmail('')
    setNomEntreprise('')
    setTelephone('')
    setSousSecteur('')
    setConfirme(false)
  }

  return (
    <main className="min-h-screen bg-white text-ink font-sans antialiased">
      <div className="max-w-[1180px] mx-auto px-7">
        {/* NAVBAR simplifiée */}
        <nav className="flex items-center justify-between py-5 border-b border-slate-100">
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
          <a
            href="/auth"
            className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
          >
            Se connecter
          </a>
        </nav>

        {/* EN-TÊTE */}
        <section className="py-14 md:py-16">
          <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Étape 1</span>
          <h1 className="font-serif text-[26px] md:text-[32px] font-medium mt-3 mb-2.5 text-navy-deep">
            Choisissez votre secteur
          </h1>
          <p className="text-[#5B6675] text-[15.5px] leading-relaxed max-w-[560px]">
            PiloBrain s&apos;adapte au vocabulaire et à la méthodologie de votre secteur —
            sélectionnez le vôtre pour continuer.
          </p>
        </section>

        {/* GRILLE DE SECTEURS */}
        <section className="pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {cartes.map((carte) => {
              const ouverte = carteOuverte === carte.slug
              return (
                <div
                  key={carte.slug}
                  onClick={() => !ouverte && setCarteOuverte(carte.slug)}
                  className={`rounded-2xl border p-6 bg-white transition ${
                    carte.active
                      ? ouverte
                        ? 'border-teal cursor-default'
                        : 'border-slate-100 hover:border-slate-300 cursor-pointer'
                      : ouverte
                      ? 'border-slate-300 cursor-default'
                      : 'border-slate-100 opacity-80 hover:opacity-100 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <div
                    className="w-[11px] h-[11px] rounded-[3px] mb-4"
                    style={{ background: carte.dotColor }}
                  />
                  <h3 className="font-serif text-[19px] font-semibold mb-2 text-navy-deep">
                    {carte.titre}
                  </h3>
                  <p className="text-sm leading-relaxed text-[#5B6675]">{carte.description}</p>

                  {!ouverte ? (
                    <span
                      className={`inline-block mt-3.5 text-[11.5px] font-bold uppercase tracking-wide ${
                        carte.active ? 'text-teal' : 'text-[#8892A0]'
                      }`}
                    >
                      {carte.active ? 'Commencer →' : '🔒 Accès en bêta privée →'}
                    </span>
                  ) : (
                    <select
                      autoFocus
                      defaultValue=""
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (!e.target.value) return
                        if (carte.active) {
                          window.location.href = `/auth?vertical=${carte.slug}&sous_secteur=${encodeURIComponent(
                            e.target.value
                          )}`
                        } else {
                          choisirSousSecteurBeta(carte, e.target.value)
                        }
                      }}
                      className="w-full mt-3.5 rounded-lg bg-white border border-slate-300 p-2 text-sm text-ink focus:border-teal focus:outline-none"
                    >
                      <option value="" disabled>
                        Précisez votre métier exact...
                      </option>
                      {carte.sousSecteurs.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {carteBeta && (
        <div
          className="fixed inset-0 bg-navy-deep/70 flex items-center justify-center px-4 z-50"
          onClick={fermerModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-2xl"
          >
            {!confirme ? (
              <>
                <h2 className="font-serif text-lg font-semibold text-navy-deep">
                  🚀 Merci pour votre intérêt !
                </h2>
                <p className="text-sm text-[#5B6675]">
                  Notre moteur de commercialisation pour <strong className="text-ink">{carteBeta.titre}</strong> est
                  actuellement accessible uniquement en bêta privée. Laissez-nous votre email et
                  votre secteur exact — notre équipe vous contacte sous 24h pour configurer votre
                  accès sur-mesure.
                </p>
                <input
                  placeholder="Nom de votre entreprise"
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-sm focus:border-teal focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-sm focus:border-teal focus:outline-none"
                />
                <input
                  type="tel"
                  placeholder="Votre numéro de téléphone"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-sm focus:border-teal focus:outline-none"
                />
                <input
                  placeholder="Votre secteur exact (optionnel)"
                  value={sousSecteur}
                  onChange={(e) => setSousSecteur(e.target.value)}
                  className="w-full rounded-lg bg-white border border-slate-300 p-2 text-sm focus:border-teal focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={envoyerDemandeBeta}
                    disabled={envoiEnCours || !formulaireValide}
                    className="flex-1 py-2 rounded-lg bg-navy text-white font-semibold disabled:opacity-50 hover:bg-navy-deep"
                  >
                    {envoiEnCours ? 'Envoi...' : 'Demander un accès'}
                  </button>
                  <button
                    onClick={fermerModal}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-[#5B6675]"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-serif text-lg font-semibold text-navy-deep">✅ Demande envoyée</h2>
                <p className="text-sm text-[#5B6675]">
                  Votre demande a été placée en priorité haute. Notre équipe vous contacte sous
                  24 heures.
                </p>
                <button
                  onClick={fermerModal}
                  className="w-full py-2 rounded-lg bg-slate-100 text-ink hover:bg-slate-200"
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
