'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Etape = 'saisie' | 'chargement' | 'apercu_floute' | 'envoi_lead' | 'termine'

type Apercu = {
  titre: string
  synthese: string
  premier_module: string | null
  nombre_modules_total: number
}

export default function DiagnosticPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [etape, setEtape] = useState<Etape>('saisie')
  const [probleme, setProbleme] = useState('')
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const [nom, setNom] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')

  const lancerDiagnostic = async () => {
    if (probleme.trim().length < 10) return
    setErreur(null)
    setEtape('chargement')

    try {
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, probleme }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? 'Une erreur est survenue')
        setEtape('saisie')
        return
      }

      setApercu(data.apercu)
      setEtape('apercu_floute')
    } catch {
      setErreur('Impossible de contacter le serveur')
      setEtape('saisie')
    }
  }

  const debloquerRapport = async () => {
    if (!nom.trim() || !telephone.trim() || !email.trim()) return
    setErreur(null)
    setEtape('envoi_lead')

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, nom, entreprise, telephone, email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? 'Une erreur est survenue')
        setEtape('apercu_floute')
        return
      }

      setEtape('termine')
      router.push(`/rapport/${params.token}`)
    } catch {
      setErreur('Impossible de contacter le serveur')
      setEtape('apercu_floute')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">

        {erreur && (
          <div className="mb-4 text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3">
            {erreur}
          </div>
        )}

        {etape === 'saisie' && (
          <div className="text-center space-y-6">
            <h1 className="text-3xl md:text-4xl font-bold">
              Décrivez le défi actuel de vos équipes
            </h1>
            <p className="text-slate-400">
              Notre IA analyse votre situation et génère un plan de compétences sur-mesure en 15 secondes.
            </p>
            <textarea
              value={probleme}
              onChange={(e) => setProbleme(e.target.value)}
              placeholder="Ex : Mes chefs de projet ont du mal à respecter les délais et le budget..."
              className="w-full h-32 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
            <button
              onClick={lancerDiagnostic}
              disabled={probleme.trim().length < 10}
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-accent text-slate-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              Générer mon diagnostic gratuit
            </button>
          </div>
        )}

        {etape === 'chargement' && (
          <div className="text-center space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400">L&apos;IA analyse votre situation...</p>
          </div>
        )}

        {(etape === 'apercu_floute' || etape === 'envoi_lead') && apercu && (
          <div className="space-y-6">
            <div className="relative rounded-xl border border-slate-700 bg-slate-900 p-6 overflow-hidden">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">{apercu.titre}</h3>
                <p className="text-slate-400">{apercu.synthese}</p>
                <div className="blur-sm select-none pointer-events-none space-y-2 pt-2">
                  <p className="text-slate-400">
                    1. {apercu.premier_module ?? 'Module prioritaire'} — priorité haute
                  </p>
                  {Array.from({ length: Math.max(apercu.nombre_modules_total - 1, 2) }).map((_, i) => (
                    <p key={i} className="text-slate-400">
                      {i + 2}. Module complémentaire — priorité moyenne
                    </p>
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 top-[40%] flex items-start justify-center pt-6 bg-gradient-to-b from-transparent to-slate-950/90">
                <p className="font-semibold text-center px-4">
                  Débloquez votre rapport complet et gratuit ci-dessous 👇
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-xl p-6">
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              />
              <input
                value={entreprise}
                onChange={(e) => setEntreprise(e.target.value)}
                placeholder="Entreprise"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              />
              <input
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Téléphone"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              />
              <button
                onClick={debloquerRapport}
                disabled={etape === 'envoi_lead' || !nom.trim() || !telephone.trim() || !email.trim()}
                className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
              >
                {etape === 'envoi_lead' ? 'Déblocage en cours...' : 'Débloquer mon rapport complet'}
              </button>
            </div>
          </div>
        )}

        {etape === 'termine' && (
          <p className="text-center text-slate-400">Redirection vers votre rapport...</p>
        )}

      </div>
    </main>
  )
}
