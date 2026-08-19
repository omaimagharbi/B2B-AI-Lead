'use client'

import { useState, useEffect } from 'react'

type Etape = 'saisie' | 'envoi' | 'termine'
type ModeCiblage = 'entreprise' | 'particulier'

export default function DiagnosticPage({ params }: { params: { token: string } }) {
  const [etape, setEtape] = useState<Etape>('saisie')
  const [modeCiblage, setModeCiblage] = useState<ModeCiblage>('entreprise')
  const [erreur, setErreur] = useState<string | null>(null)

  // Questionnaire structure (au lieu d'une seule case libre) : de meilleures
  // reponses ici donnent un diagnostic bien plus precis a l'expert et a l'IA.
  const [defi, setDefi] = useState('')
  const [depuisQuand, setDepuisQuand] = useState('')
  const [dejaEssaye, setDejaEssaye] = useState('')
  const [urgence, setUrgence] = useState('')

  // Suivi d'ouverture + recuperation du mode de ciblage (entreprise/particulier)
  // pour adapter les questions posees.
  useEffect(() => {
    fetch('/api/diagnostic/ouverture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.mode_ciblage === 'particulier') setModeCiblage('particulier')
      })
      .catch(() => {})
  }, [params.token])

  const MIN_CARACTERES_DEFI = 15
  const estValide = defi.trim().length >= MIN_CARACTERES_DEFI && depuisQuand && urgence

  const soumettre = async () => {
    if (!estValide) {
      const manques: string[] = []
      if (defi.trim().length < MIN_CARACTERES_DEFI) {
        manques.push(
          `la description (encore ${MIN_CARACTERES_DEFI - defi.trim().length} caractère${
            MIN_CARACTERES_DEFI - defi.trim().length > 1 ? 's' : ''
          } minimum)`
        )
      }
      if (!depuisQuand) manques.push('"Depuis combien de temps"')
      if (!urgence) manques.push('"Niveau d\'urgence"')
      setErreur(`Merci de compléter : ${manques.join(', ')}.`)
      return
    }
    setErreur(null)
    setEtape('envoi')

    // On combine les reponses en un texte structure envoye au backend (le
    // format de l'API ne change pas : une seule chaine "probleme"), mais
    // desormais bien plus riche que "quelques mots".
    const probleme = [
      `Défi / objectif : ${defi.trim()}`,
      `Depuis quand : ${depuisQuand}`,
      `Déjà essayé : ${dejaEssaye.trim() || 'Rien de particulier pour le moment'}`,
      `Urgence à agir : ${urgence}`,
    ].join('\n')

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

  const libelleDefi =
    modeCiblage === 'particulier'
      ? "Quel est l'objectif ou le blocage que vous cherchez à résoudre ?"
      : 'Quel est le principal défi que rencontre votre entreprise ou votre équipe ?'

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        {erreur && (
          <div className="mb-4 text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3">
            {erreur}
          </div>
        )}

        {etape === 'saisie' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">Décrivez votre situation</h1>
              <p className="text-slate-400">
                Un expert étudiera votre dossier personnellement et vous recontactera avec une
                solution sur-mesure.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm text-slate-300">{libelleDefi}</label>
                <textarea
                  value={defi}
                  onChange={(e) => setDefi(e.target.value)}
                  placeholder="Décrivez la situation avec le plus de détails possible..."
                  className="w-full h-28 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                />
                <p
                  className={`text-xs ${
                    defi.trim().length >= MIN_CARACTERES_DEFI ? 'text-slate-500' : 'text-amber-400'
                  }`}
                >
                  {defi.trim().length}/{MIN_CARACTERES_DEFI} caractères minimum
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">
                  Depuis combien de temps rencontrez-vous cette situation ?
                </label>
                <select
                  value={depuisQuand}
                  onChange={(e) => setDepuisQuand(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white focus:outline-none focus:border-accent"
                >
                  <option value="">Sélectionner...</option>
                  <option value="Moins d'1 mois">Moins d'1 mois</option>
                  <option value="1 à 6 mois">1 à 6 mois</option>
                  <option value="Plus de 6 mois">Plus de 6 mois</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">
                  Qu'avez-vous déjà essayé pour y remédier ? (optionnel)
                </label>
                <textarea
                  value={dejaEssaye}
                  onChange={(e) => setDejaEssaye(e.target.value)}
                  placeholder="Ex : formation en interne, prestataire externe, rien pour l'instant..."
                  className="w-full h-20 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">
                  Quel est votre niveau d'urgence pour agir ?
                </label>
                <select
                  value={urgence}
                  onChange={(e) => setUrgence(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white focus:outline-none focus:border-accent"
                >
                  <option value="">Sélectionner...</option>
                  <option value="Pas pressé, j'explore">Pas pressé, j'explore</option>
                  <option value="Modéré, dans les prochains mois">Modéré, dans les prochains mois</option>
                  <option value="Urgent, je veux avancer rapidement">
                    Urgent, je veux avancer rapidement
                  </option>
                </select>
              </div>
            </div>

            <button
              onClick={soumettre}
              className={`w-full md:w-auto px-8 py-3 rounded-xl font-semibold transition ${
                estValide
                  ? 'bg-accent text-slate-950 hover:opacity-90'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
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
