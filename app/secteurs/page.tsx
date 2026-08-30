'use client'

import { useState } from 'react'
import { SOUS_SECTEURS_PAR_VERTICAL } from '@/lib/sous-secteurs'

const cartes = [
  {
    slug: 'cabinet-formation',
    titre: 'Formation & Conseil RH',
    description: 'Recevez des prospects qualifiés, prêts à signer, sans effort de prospection.',
    dotColor: '#1F6F78',
    active: true,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['cabinet-formation'],
  },
  {
    slug: 'startup-saas',
    titre: 'Startups & Éditeurs de Logiciels',
    description: 'Recevez des audits techniques qualifiés directement dans votre pipeline.',
    dotColor: '#F0CC7A',
    active: true,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['startup-saas'],
  },
  {
    slug: 'pme-services',
    titre: 'PME & Entreprises de Croissance',
    description: 'Recevez des audits organisationnels qualifiés directement dans votre pipeline.',
    dotColor: '#0F2540',
    active: true,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['pme-services'],
  },
  {
    slug: 'investisseur-incubateur',
    titre: 'Écosystème Entrepreneurial',
    description: "Sourcez du dealflow qualifié : fondateurs et startups prêts à être contactés.",
    dotColor: '#1F6F78',
    active: true,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['investisseur-incubateur'],
  },
  {
    slug: 'comptable-fiscal',
    titre: 'Cabinet Comptable, Juridique & Fiscal',
    description: 'Automatisez la chasse de mandats — expertise comptable, avocats d\'affaires, conformité.',
    dotColor: '#8892A0',
    active: false,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['comptable-fiscal'],
  },
  {
    slug: 'services-generaux',
    titre: 'Logistique, Transit & Services Généraux',
    description: 'Transitaires, maintenance industrielle, facility management, événementiel B2B.',
    dotColor: '#8892A0',
    active: false,
    sousSecteurs: SOUS_SECTEURS_PAR_VERTICAL['services-generaux'],
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
    <main className="min-h-screen bg-slate-950 text-white font-sans antialiased">
      <div className="max-w-[1180px] mx-auto px-7">
        {/* NAVBAR simplifiée */}
        <nav className="flex items-center justify-between py-5 border-b border-slate-800">
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
            href="/auth"
            className="text-sm px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white hover:border-slate-500"
          >
            Se connecter
          </a>
        </nav>

        {/* EN-TÊTE */}
        <section className="py-14 md:py-16 text-center">
          <h1 className="font-sans text-[28px] md:text-[38px] font-extrabold mt-3 mb-2.5">
            Des prospects qualifiés, livrés automatiquement
          </h1>
          <p className="text-slate-400 text-[15.5px] leading-relaxed">
            Choisissez votre secteur pour commencer
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
                  className={`rounded-2xl border p-6 transition ${
                    carte.active ? 'bg-slate-900' : 'bg-slate-800/70'
                  } ${
                    ouverte ? 'border-accent cursor-default' : 'border-slate-700 hover:border-slate-500 cursor-pointer'
                  }`}
                >
                  <h3 className="font-sans text-[19px] font-bold mb-2 text-white">{carte.titre}</h3>
                  <p className={`text-sm leading-relaxed ${carte.active ? 'text-slate-400' : 'text-slate-300'}`}>
                    {carte.description}
                  </p>

                  {!ouverte ? (
                    <span
                      className={`inline-block mt-3.5 text-[13px] font-semibold ${
                        carte.active ? 'text-accent' : 'text-amber-400'
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
                      className="w-full mt-3.5 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-accent focus:outline-none"
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
          onClick={fermerModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            {!confirme ? (
              <>
                <h2 className="font-sans text-lg font-bold text-white">🚀 Merci pour votre intérêt !</h2>
                <p className="text-sm text-slate-400">
                  Notre moteur de commercialisation pour <strong className="text-white">{carteBeta.titre}</strong> est
                  actuellement accessible uniquement en bêta privée. Laissez-nous votre email et
                  votre secteur exact — notre équipe vous contacte sous 24h pour configurer votre
                  accès sur-mesure.
                </p>
                <input
                  placeholder="Nom de votre entreprise"
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-accent focus:outline-none"
                />
                <input
                  type="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-accent focus:outline-none"
                />
                <input
                  type="tel"
                  placeholder="Votre numéro de téléphone"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-accent focus:outline-none"
                />
                <input
                  placeholder="Votre secteur exact (optionnel)"
                  value={sousSecteur}
                  onChange={(e) => setSousSecteur(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-white focus:border-accent focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={envoyerDemandeBeta}
                    disabled={envoiEnCours || !formulaireValide}
                    className="flex-1 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50 hover:opacity-90"
                  >
                    {envoiEnCours ? 'Envoi...' : 'Demander un accès'}
                  </button>
                  <button
                    onClick={fermerModal}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-sans text-lg font-bold text-white">✅ Demande envoyée</h2>
                <p className="text-sm text-slate-400">
                  Votre demande a été placée en priorité haute. Notre équipe vous contacte sous
                  24 heures.
                </p>
                <button
                  onClick={fermerModal}
                  className="w-full py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
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
