'use client'

import Link from 'next/link'
import { useState } from 'react'

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
  {
    slug: 'investisseur-incubateur',
    titre: 'Écosystème Entrepreneurial',
    description: "Sourcez du dealflow qualifié : fondateurs et startups prêts à être contactés.",
    active: true,
  },
  {
    slug: 'comptable-fiscal',
    titre: 'Cabinet Comptable, Juridique & Fiscal',
    description: 'Automatisez la chasse de mandats — expertise comptable, avocats d\'affaires, conformité.',
    active: false,
  },
  {
    slug: 'services-generaux',
    titre: 'Logistique, Transit & Services Généraux',
    description: 'Transitaires, maintenance industrielle, facility management, événementiel B2B.',
    active: false,
  },
]

export default function Home() {
  const [carteBeta, setCarteBeta] = useState<{ slug: string; titre: string } | null>(null)
  const [email, setEmail] = useState('')
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [telephone, setTelephone] = useState('')
  const [sousSecteur, setSousSecteur] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [confirme, setConfirme] = useState(false)

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
            <button
              key={carte.slug}
              onClick={() => setCarteBeta({ slug: carte.slug, titre: carte.titre })}
              className="text-left rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3 opacity-70 hover:opacity-100 hover:border-slate-600 transition cursor-pointer"
            >
              <h2 className="text-xl font-semibold">{carte.titre}</h2>
              <p className="text-slate-500">{carte.description}</p>
              <span className="inline-block text-slate-400 font-semibold text-sm">
                🔒 Accès en bêta privée →
              </span>
            </button>
          )
        )}
      </div>

      {carteBeta && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50"
          onClick={fermerModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4"
          >
            {!confirme ? (
              <>
                <h2 className="text-lg font-semibold">🚀 Merci pour votre intérêt !</h2>
                <p className="text-sm text-slate-400">
                  Notre moteur de commercialisation pour <strong>{carteBeta.titre}</strong> est
                  actuellement accessible uniquement en bêta privée. Laissez-nous votre email et
                  votre secteur exact — notre équipe vous contacte sous 24h pour configurer votre
                  accès sur-mesure.
                </p>
                <input
                  placeholder="Nom de votre entreprise"
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Votre numéro de téléphone"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  placeholder="Votre secteur exact (optionnel)"
                  value={sousSecteur}
                  onChange={(e) => setSousSecteur(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={envoyerDemandeBeta}
                    disabled={envoiEnCours || !formulaireValide}
                    className="flex-1 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                  >
                    {envoiEnCours ? 'Envoi...' : 'Demander un accès'}
                  </button>
                  <button
                    onClick={fermerModal}
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">✅ Demande envoyée</h2>
                <p className="text-sm text-slate-400">
                  Votre demande a été placée en priorité haute. Notre équipe vous contacte sous
                  24 heures.
                </p>
                <button
                  onClick={fermerModal}
                  className="w-full py-2 rounded-lg bg-slate-800 text-slate-200"
                >
                  Fermer
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
