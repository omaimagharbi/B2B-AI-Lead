'use client'

import { useState } from 'react'

const cartes = [
  {
    slug: 'cabinet-formation',
    titre: 'Formation & Conseil RH',
    description: 'Recevez des prospects qualifiés, prêts à signer, sans effort de prospection.',
    tag: 'Formation',
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
    tag: 'Tech',
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
    tag: 'Services',
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
    tag: 'Investisseurs',
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
    tag: 'Bêta privée',
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
    tag: 'Bêta privée',
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

export default function Home() {
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
        {/* NAVBAR */}
        <nav className="flex items-center justify-between py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className="w-[34px] h-[34px] rounded-full relative"
              style={{
                background: 'conic-gradient(#1F6F78, #F0CC7A, #0F2540, #1F6F78)',
              }}
            >
              <div className="absolute inset-[6px] bg-white rounded-full" />
            </div>
            <div className="font-serif font-semibold text-[19px] tracking-tight">
              Pilo<span className="text-teal font-semibold">Brain</span>
            </div>
          </div>
          <div className="hidden md:flex gap-7 text-[14.5px] text-[#4B5768]">
            <a href="#secteurs" className="hover:text-ink">Secteurs</a>
            <a href="#a-propos" className="hover:text-ink">À propos</a>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-[13px] text-[#7C8794] border border-slate-300 rounded-lg px-2.5 py-1.5 hidden sm:inline-block">
              FR
            </span>
            <a
              href="/auth"
              className="text-sm px-4 py-2 rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
            >
              Se connecter
            </a>
            <a
              href="#secteurs"
              className="text-sm px-4.5 py-2.5 rounded-lg border-none bg-navy text-white font-semibold hover:bg-navy-deep"
            >
              S&apos;inscrire
            </a>
          </div>
        </nav>

        {/* HERO */}
        <section className="grid grid-cols-1 md:grid-cols-[1.05fr_.95fr] gap-14 items-center py-16 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 text-[12.5px] tracking-wide uppercase text-teal bg-teal-light px-3 py-1.5 rounded-full font-bold">
              ● Commercialisation assistée par IA
            </span>
            <h1 className="font-serif italic font-medium text-[32px] md:text-[44px] leading-[1.14] mt-5 mb-5 text-navy-deep">
              Des prospects qualifiés, livrés <span className="not-italic text-teal font-semibold">automatiquement</span>.
            </h1>
            <p className="text-[16.5px] leading-relaxed text-[#4B5768] max-w-[480px] mb-7">
              PiloBrain automatise le ciblage, la qualification et le suivi de vos prospects — en
              Tunisie comme à l&apos;international — pour que votre équipe passe son temps à conclure,
              pas à chercher.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <a
                href="#secteurs"
                className="text-sm px-[18px] py-[10px] rounded-lg bg-navy text-white font-semibold hover:bg-navy-deep"
              >
                Choisir mon secteur →
              </a>
              <a
                href="/auth"
                className="text-sm px-4 py-[9px] rounded-lg border border-slate-300 bg-white text-ink hover:border-slate-400"
              >
                Se connecter
              </a>
            </div>
            <div className="mt-8 text-[13px] text-[#8892A0] flex gap-2 items-center">
              <span className="text-ink font-bold">Conçu par une experte terrain</span> — certifiée PMP, 12 ans d&apos;expérience commerciale &amp; formation
            </div>
          </div>

          <div className="relative h-[320px] md:h-[400px]">
            <div
              className="absolute inset-0 rounded-[20px] overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 20%, #16344F 0%, #0A1A2E 60%)',
              }}
            >
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400" fill="none">
                <g stroke="#2E6F78" strokeWidth={1} opacity={0.55}>
                  <line x1="60" y1="90" x2="180" y2="150" />
                  <line x1="180" y1="150" x2="300" y2="100" />
                  <line x1="180" y1="150" x2="150" y2="270" />
                  <line x1="150" y1="270" x2="280" y2="300" />
                  <line x1="180" y1="150" x2="320" y2="230" />
                  <line x1="60" y1="90" x2="150" y2="270" />
                </g>
                <g fill="#F0CC7A">
                  <circle cx="60" cy="90" r="4" />
                  <circle cx="300" cy="100" r="4" />
                  <circle cx="280" cy="300" r="4" />
                </g>
                <g fill="#1F6F78">
                  <circle cx="150" cy="270" r="5" />
                  <circle cx="320" cy="230" r="4" />
                </g>
                <circle cx="180" cy="150" r="8" fill="#ffffff" />
              </svg>
              <div className="absolute top-[16%] left-[8%] bg-white rounded-xl px-[13px] py-[10px] shadow-lg text-[12.5px] font-bold flex items-center gap-2 text-navy-deep">
                <span className="w-2 h-2 rounded-full bg-[#22C58B]" /> Score 82/100
              </div>
              <div className="absolute bottom-[18%] right-[10%] bg-white rounded-xl px-[13px] py-[10px] shadow-lg text-[12.5px] font-bold flex items-center gap-2 text-navy-deep">
                <span className="w-2 h-2 rounded-full bg-gold" /> Golfe · USD
              </div>
            </div>
          </div>
        </section>

        {/* SECTEURS */}
        <section id="secteurs" className="py-14 md:py-[70px] scroll-mt-8">
          <div className="max-w-[560px] mb-11">
            <span className="text-[12.5px] tracking-widest uppercase text-teal font-bold">Pour qui</span>
            <h2 className="font-serif text-[26px] md:text-[30px] font-medium mt-3 mb-2.5 text-navy-deep">
              Un moteur, plusieurs métiers
            </h2>
            <p className="text-[#5B6675] text-[15.5px] leading-relaxed">
              PiloBrain s&apos;adapte au vocabulaire et à la méthodologie de votre secteur —
              choisissez le vôtre pour commencer.
            </p>
          </div>

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

      {/* FOOTER */}
      <div className="max-w-[1180px] mx-auto px-7">
        <footer className="bg-navy-deep text-[#EAF0F5] rounded-[28px] my-10 px-6 py-12 md:px-12 md:py-16">
          <div className="text-center max-w-[640px] mx-auto">
            <h2 className="font-serif italic font-medium text-[26px] md:text-[32px] mb-4">
              Prêt à structurer votre prospection ?
            </h2>
            <p className="text-[#9FB0C2] text-[15px] leading-relaxed mb-7">
              Un diagnostic généré en quelques minutes, validé par votre expertise avant chaque envoi.
            </p>
            <a
              href="#secteurs"
              className="inline-block bg-white text-navy-deep border-none px-[22px] py-3 rounded-[9px] font-bold text-[14.5px] hover:bg-slate-100"
            >
              On s&apos;occupe de tout →
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5 my-14 pt-10 border-t border-white/10">
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">Formation &amp; Conseil RH</b>
              Ciblage RH, diagnostic sur-mesure, suivi de conventions.
            </div>
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">Startups &amp; SaaS</b>
              Qualification technique et pipeline dédié.
            </div>
            <div className="text-[13.5px] text-[#B9C6D4]">
              <b className="block text-white text-[14.5px] mb-1 font-serif font-semibold">Écosystème Entrepreneurial</b>
              Dealflow qualifié pour investisseurs et incubateurs.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-[12.5px] text-[#7488A0] pt-5 border-t border-white/10">
            <span>© PiloBrain — De l&apos;épreuve à l&apos;élan</span>
            <span className="space-x-4">
              <a href="/mentions-legales" className="hover:text-white underline">
                Mentions légales
              </a>
              <a href="/cgu" className="hover:text-white underline">
                CGU
              </a>
              <a href="/politique-confidentialite" className="hover:text-white underline">
                Politique de confidentialité
              </a>
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}
