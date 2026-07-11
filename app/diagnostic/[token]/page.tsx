'use client'

import { useState } from 'react'

type Etape = 'saisie' | 'envoi' | 'termine'

export default function DiagnosticPage({ params }: { params: { token: string } }) {
  const [etape, setEtape] = useState<Etape>('saisie')
  const [probleme, setProbleme] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const soumettre = async () => {
    if (probleme.trim().length < 10) return
    setErreur(null)
    setEtape('envoi')

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

      setEtape('termine')
    } catch {
      setErreur('Impossible de contacter le serveur')
      setEtape('saisie')
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
              Décrivez votre situation actuelle
            </h1>
            <p className="text-slate-400">
              Un expert étudiera votre dossier personnellement et vous recontactera avec une
              solution sur-mesure.
            </p>
            <textarea
              value={probleme}
              onChange={(e) => setProbleme(e.target.value)}
              placeholder="Décrivez en quelques mots le défi ou l'objectif que vous rencontrez actuellement..."
              className="w-full h-32 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
            />
            <button
              onClick={soumettre}
              disabled={probleme.trim().length < 10}
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-accent text-slate-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              Envoyer à mon expert
            </button>
          </div>
        )}

        {etape === 'envoi' && (
          <div className="text-center space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400">Transmission de votre dossier...</p>
          </div>
        )}

        {etape === 'termine' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl md:text-3xl font-bold">C'est envoyé !</h1>
            <p className="text-slate-400 max-w-md mx-auto">
              Votre expert étudie votre dossier. Vous recevrez votre solution personnalisée par
              WhatsApp ou Email d'ici quelques minutes.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
