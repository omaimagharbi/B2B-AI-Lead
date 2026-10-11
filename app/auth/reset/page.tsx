'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import LangueSelect from '@/components/LangueSelect'
import { useLangueVisiteur } from '@/lib/use-langue-visiteur'
import { tt, tf, definirLangueLitterale } from '@/lib/litteral'

export default function ResetPasswordPage() {
  const [langue, changerLangue] = useLangueVisiteur()
  const router = useRouter()
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)
  const [succes, setSucces] = useState(false)

  const soumettre = async () => {
    setErreur(null)

    if (motDePasse.length < 6) {
      setErreur(tt("Le mot de passe doit contenir au moins 6 caractères"))
      return
    }
    if (motDePasse !== confirmation) {
      setErreur(tt("Les mots de passe ne correspondent pas"))
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
      <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
        <LangueSelect langue={langue} onChange={changerLangue} />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-center">{tt("Nouveau mot de passe")}</h1>

        {erreur && (
          <div className="text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
            {erreur}
          </div>
        )}
        {succes && (
          <div className="text-center text-accent bg-slate-900 border border-accent/40 rounded-lg p-3 text-sm">
            {tt("Mot de passe mis à jour ! Redirection...")}</div>
        )}

        <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-xl p-6">
          <input
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder={tt("Nouveau mot de passe")}
            type="password"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={tt("Confirmez le mot de passe")}
            type="password"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <button
            onClick={soumettre}
            disabled={chargement || !motDePasse || !confirmation}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
          >
            {chargement ? tt("Mise à jour...") : tt("Mettre à jour le mot de passe")}
          </button>
        </div>
      </div>
    </main>
  )
}
