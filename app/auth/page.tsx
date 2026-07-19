'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const vertical = searchParams.get('vertical') ?? 'cabinet-formation'

  const [mode, setMode] = useState<'inscription' | 'connexion' | 'mot_de_passe_oublie'>(
    'inscription'
  )
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)

  const soumettre = async () => {
    setErreur(null)
    setMessageSucces(null)
    setChargement(true)

    try {
      if (mode === 'mot_de_passe_oublie') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) {
          setErreur(error.message)
        } else {
          setMessageSucces(
            'Si un compte existe avec cet email, un lien de réinitialisation vient de vous être envoyé.'
          )
        }
        setChargement(false)
        return
      }

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

      // On redirige automatiquement vers /admin si ce compte est administrateur
      // plateforme (ADMIN_EMAILS), sinon vers le dashboard cabinet normal.
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      let estAdmin = false
      if (accessToken) {
        try {
          const res = await fetch('/api/admin/whoami', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const data = await res.json()
          estAdmin = Boolean(data.estAdmin)
        } catch {
          estAdmin = false
        }
      }

      router.push(estAdmin ? '/admin' : '/dashboard')
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
            {mode === 'inscription'
              ? 'Créez votre compte cabinet (utilisateur)'
              : mode === 'connexion'
              ? 'Connexion à votre compte cabinet'
              : 'Mot de passe oublié'}
          </h1>
          <p className="text-slate-400 text-sm">
            Vertical sélectionné : <span className="text-accent">{vertical}</span>
          </p>
          {mode === 'inscription' && (
            <p className="text-slate-600 text-xs">
              Ce compte donne accès à votre tableau de bord (prospection, diagnostics, envois).
              L'accès administration plateforme est réservé à Braise et n'est pas ouvert à
              l'inscription.
            </p>
          )}
        </div>

        {erreur && (
          <div className="text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
            {erreur}
          </div>
        )}
        {messageSucces && (
          <div className="text-center text-accent bg-slate-900 border border-accent/40 rounded-lg p-3 text-sm">
            {messageSucces}
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
            onKeyDown={(e) => e.key === 'Enter' && soumettre()}
            placeholder="Email professionnel"
            type="email"
            className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
          />
          {mode !== 'mot_de_passe_oublie' && (
            <input
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && soumettre()}
              placeholder="Mot de passe"
              type="password"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
            />
          )}
          <button
            onClick={soumettre}
            disabled={
              chargement ||
              !email ||
              (mode !== 'mot_de_passe_oublie' && !motDePasse) ||
              (mode === 'inscription' && !nomEntreprise)
            }
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
          >
            {chargement
              ? 'Chargement...'
              : mode === 'inscription'
              ? 'Créer mon compte'
              : mode === 'connexion'
              ? 'Se connecter'
              : 'Envoyer le lien de réinitialisation'}
          </button>
        </div>

        {mode === 'connexion' && (
          <p className="text-center">
            <button
              onClick={() => {
                setMode('mot_de_passe_oublie')
                setErreur(null)
                setMessageSucces(null)
              }}
              className="text-slate-400 text-sm underline"
            >
              Mot de passe oublié ?
            </button>
          </p>
        )}

        <p className="text-center text-slate-400 text-sm">
          {mode === 'mot_de_passe_oublie' ? (
            <button
              onClick={() => {
                setMode('connexion')
                setErreur(null)
                setMessageSucces(null)
              }}
              className="text-accent underline"
            >
              Retour à la connexion
            </button>
          ) : (
            <>
              {mode === 'inscription' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
              <button
                onClick={() => setMode(mode === 'inscription' ? 'connexion' : 'inscription')}
                className="text-accent underline"
              >
                {mode === 'inscription' ? 'Se connecter' : "S'inscrire"}
              </button>
            </>
          )}
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
