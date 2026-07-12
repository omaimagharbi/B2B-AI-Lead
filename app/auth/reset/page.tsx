'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  const soumettre = async () => {
    setErreur(null)

    if (motDePasse.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas')
      return
    }

    setChargement(true)
    const { error } = await supabase.auth.updateUser({ password: motDePasse })

    if (error) {
      setErreur(error.message)
      setChargement(false)
      return
    }

    setSucces(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">Nouveau mot de passe</h1>

        {erreur && (
          <div className="text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
            {erreur}
          </div>
        )}
        {succes && (
          <div className="text-center text-accent bg-slate-900 border border-accent/40 rounded-lg p-3 text-sm">
            Mot de passe mis à jour ! Redirection...
          </div>
        )}

        <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-xl p-6">
          <input
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="Nouveau mot de passe"
            type="password"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Confirmez le mot de passe"
            type="password"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <button
            onClick={soumettre}
            disabled={chargement || !motDePasse || !confirmation}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
          >
            {chargement ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
          </button>
        </div>
      </div>
    </main>
  )
}
