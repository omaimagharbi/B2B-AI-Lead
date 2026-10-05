'use client'

import { useState, useEffect } from 'react'
import { traduire, type Langue } from '@/lib/i18n'

type Etape = 'saisie' | 'envoi' | 'termine'
type ModeCiblage = 'entreprise' | 'particulier'

export default function DiagnosticPage({ params }: { params: { token: string } }) {
  const [etape, setEtape] = useState<Etape>('saisie')
  const [modeCiblage, setModeCiblage] = useState<ModeCiblage>('entreprise')
  const [erreur, setErreur] = useState<string | null>(null)
  const [langue, setLangue] = useState<Langue>('fr')
  const t = (cle: string) => traduire(langue, cle)

  // Questionnaire structure (au lieu d'une seule case libre) : de meilleures
  // reponses ici donnent un diagnostic bien plus precis a l'expert et a l'IA.
  const [defi, setDefi] = useState('')
  const [depuisQuand, setDepuisQuand] = useState('')
  const [dejaEssaye, setDejaEssaye] = useState('')
  const [urgence, setUrgence] = useState('')

  // Suivi d'ouverture + recuperation du mode de ciblage (entreprise/particulier)
  // et de la langue preferee du cabinet (defaut d'affichage, modifiable par
  // le prospect via le selecteur) pour adapter les questions posees.
  useEffect(() => {
    fetch('/api/diagnostic/ouverture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.mode_ciblage === 'particulier') setModeCiblage('particulier')
        if (data?.langue_preferee === 'en' || data?.langue_preferee === 'ar') {
          setLangue(data.langue_preferee)
        }
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
          `${t('diag_description_label_court')} (${t('diag_encore')} ${MIN_CARACTERES_DEFI - defi.trim().length} ${t('diag_caracteres_min_court')})`
        )
      }
      if (!depuisQuand) manques.push(t('diag_depuis_quand_court'))
      if (!urgence) manques.push(t('diag_urgence_court'))
      setErreur(`${t('diag_merci_completer')} ${manques.join(', ')}.`)
      return
    }
    setErreur(null)
    setEtape('envoi')

    // On combine les reponses en un texte structure envoye au backend (le
    // format de l'API ne change pas : une seule chaine "probleme"), mais
    // desormais bien plus riche que "quelques mots". Toujours redige en
    // francais cote donnees internes (pour le prompt IA / le cabinet), quelle
    // que soit la langue affichee au prospect.
    const probleme = [
      `Défi / objectif : ${defi.trim()}`,
      `Depuis quand : ${depuisQuand}`,
      `Déjà essayé : ${dejaEssaye.trim() || 'Rien de particulier pour le moment'}`,
      `Urgence à agir : ${urgence}`,
    ].join('\n')

    try {
      // Garde-fou cote client : si le serveur ne repond vraiment pas (au lieu
      // d'un retour d'erreur propre), on ne laisse jamais le spinner tourner
      // indefiniment - on coupe et on invite a reessayer.
      const controleur = new AbortController()
      const minuteur = setTimeout(() => controleur.abort(), 45_000)
      const res = await fetch('/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, probleme }),
        signal: controleur.signal,
      })
      clearTimeout(minuteur)
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? t('diag_erreur_survenue'))
        setEtape('saisie')
        return
      }

      setEtape('termine')
    } catch {
      setErreur(t('diag_serveur_trop_lent'))
      setEtape('saisie')
    }
  }

  const libelleDefi = modeCiblage === 'particulier' ? t('diag_defi_particulier') : t('diag_defi_entreprise')

  return (
    <main
      className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 py-10"
      dir={langue === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-3">
          <select
            value={langue}
            onChange={(e) => setLangue(e.target.value as Langue)}
            className="text-xs text-slate-400 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1"
          >
            <option value="fr">FR</option>
            <option value="en">EN</option>
            <option value="ar">AR</option>
          </select>
        </div>

        {erreur && (
          <div className="mb-4 text-center text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3">
            {erreur}
          </div>
        )}

        {etape === 'saisie' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold">{t('diag_titre')}</h1>
              <p className="text-slate-400">{t('diag_sous_titre')}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm text-slate-300">{libelleDefi}</label>
                <textarea
                  value={defi}
                  onChange={(e) => setDefi(e.target.value)}
                  placeholder={t('diag_defi_placeholder')}
                  className="w-full h-28 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                />
                <p
                  className={`text-xs ${
                    defi.trim().length >= MIN_CARACTERES_DEFI ? 'text-slate-500' : 'text-amber-400'
                  }`}
                >
                  {defi.trim().length}/{MIN_CARACTERES_DEFI} {t('diag_caracteres_min')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">{t('diag_depuis_quand_label')}</label>
                <select
                  value={depuisQuand}
                  onChange={(e) => setDepuisQuand(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white focus:outline-none focus:border-accent"
                >
                  <option value="">{t('diag_selectionner')}</option>
                  <option value="Moins d'1 mois">{t('diag_moins_1_mois')}</option>
                  <option value="1 à 6 mois">{t('diag_1_a_6_mois')}</option>
                  <option value="Plus de 6 mois">{t('diag_plus_6_mois')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">{t('diag_deja_essaye_label')}</label>
                <textarea
                  value={dejaEssaye}
                  onChange={(e) => setDejaEssaye(e.target.value)}
                  placeholder={t('diag_deja_essaye_placeholder')}
                  className="w-full h-20 rounded-xl bg-slate-900 border border-slate-700 p-4 text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">{t('diag_urgence_label')}</label>
                <select
                  value={urgence}
                  onChange={(e) => setUrgence(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-white focus:outline-none focus:border-accent"
                >
                  <option value="">{t('diag_selectionner')}</option>
                  <option value="Pas pressé, j'explore">{t('diag_pas_presse')}</option>
                  <option value="Modéré, dans les prochains mois">{t('diag_modere')}</option>
                  <option value="Urgent, je veux avancer rapidement">{t('diag_urgent')}</option>
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
              {t('diag_envoyer_cta')}
            </button>
          </div>
        )}

        {etape === 'envoi' && (
          <div className="text-center space-y-4">
            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full mx-auto" />
            <p className="text-slate-400">{t('diag_transmission')}</p>
          </div>
        )}

        {etape === 'termine' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h1 className="text-2xl md:text-3xl font-bold">{t('diag_cest_envoye')}</h1>
            <p className="text-slate-400 max-w-md mx-auto">{t('diag_confirmation_desc')}</p>
          </div>
        )}
      </div>
    </main>
  )
}
