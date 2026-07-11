'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vertical = searchParams.get('vertical') ?? 'cabinet-formation'

  const [mode, setMode] = useState<'inscription' | 'connexion'>('inscription')
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)

  const soumettre = async () => {
    setErreur(null)
    setChargement(true)

    try {
      if (mode === 'inscription') {
        const { error } = await supabase.auth.signUp({
          email,
          password: motDePasse,
          options: {
            data: { nom_entreprise: nomEntreprise, vertical_slug: vertical },
          },
        })
        if (error) {
          setErreur(error.message)
          setChargement(false)
          return
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: motDePasse,
        })
        if (error) {
          setErreur(error.message)
          setChargement(false)
          return
        }
      }

      router.push('/dashboard')
    } catch (err) {
      console.error('Erreur auth:', err)
      setErreur(
        err instanceof Error
          ? `Erreur technique : ${err.message}`
          : 'Erreur technique inconnue'
      )
      setChargement(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            {mode === 'inscription' ? 'Créez votre compte cabinet' : 'Connexion'}
          </h1>
          <p className="text-slate-400 text-sm">
            Vertical sélectionné : <span className="text-accent">{vertical}</span>
          </p>
        </div>

        {erreur && (
          <div className="text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
            {erreur}
          </div>
        )}

        <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-xl p-6">
          {mode === 'inscription' && (
            <input
              value={nomEntreprise}
              onChange={(e) => setNomEntreprise(e.target.value)}
              placeholder="Nom du cabinet"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email professionnel"
            type="email"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <input
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="Mot de passe"
            type="password"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          <button
            onClick={soumettre}
            disabled={chargement || !email || !motDePasse || (mode === 'inscription' && !nomEntreprise)}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
          >
            {chargement
              ? 'Chargement...'
              : mode === 'inscription'
              ? "Créer mon compte"
              : 'Se connecter'}
          </button>
        </div>

        <p className="text-center text-slate-400 text-sm">
          {mode === 'inscription' ? 'Déjà un compte ?' : "Pas encore de compte ?"}{' '}
          <button
            onClick={() => setMode(mode === 'inscription' ? 'connexion' : 'inscription')}
            className="text-accent underline"
          >
            {mode === 'inscription' ? 'Se connecter' : "S'inscrire"}
          </button>
        </p>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  )
}
