'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PhoneInput from '@/components/PhoneInput'
import ThemeToggle from '@/components/ThemeToggle'
import LangueSelect from '@/components/LangueSelect'
import { useLangueVisiteur } from '@/lib/use-langue-visiteur'
import { tt, tf, definirLangueLitterale } from '@/lib/litteral'

type EtapeInscription = 1 | 2 | 3 | 4

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [langue, changerLangue] = useLangueVisiteur()
  const vertical = searchParams.get('vertical') ?? 'cabinet-formation'
  const sousSecteurChoisi = searchParams.get('sous_secteur') ?? ''

  const [mode, setMode] = useState<'inscription' | 'connexion' | 'mot_de_passe_oublie'>(
    searchParams.get('mode') === 'connexion' ? 'connexion' : 'inscription'
  )
  const [etapeMdpOublie, setEtapeMdpOublie] = useState<'email' | 'code'>('email')
  const [codeVerification, setCodeVerification] = useState('')

  // ----- Connexion / mot de passe oublie (inchange) -----
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('')

  // ----- Inscription (formulaire en 4 etapes) -----
  const [etape, setEtape] = useState<EtapeInscription>(1)

  // Etape 1 : identite de l'entreprise
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [emailEntreprise, setEmailEntreprise] = useState('')
  const [telephone, setTelephone] = useState('')
  const [indicatifTelephone, setIndicatifTelephone] = useState('+216')
  const [logoFichier, setLogoFichier] = useState<File | null>(null)
  const [logoApercu, setLogoApercu] = useState<string | null>(null)
  const [glisserSurvol, setGlisserSurvol] = useState(false)

  // Etape 2 : identite du directeur commercial
  const [nomDirecteur, setNomDirecteur] = useState('')
  const [motDePasseInscription, setMotDePasseInscription] = useState('')
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('')
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false)

  // Etape 3 : invitation de l'equipe
  const [emailDirecteurCommercial, setEmailDirecteurCommercial] = useState('')
  const [emailsEquipe, setEmailsEquipe] = useState('')

  // Etape 4 : lien site + reseaux sociaux
  const [siteWeb, setSiteWeb] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')

  const [erreur, setErreur] = useState<string | null>(null)
  const [messageSucces, setMessageSucces] = useState<string | null>(null)
  const [chargement, setChargement] = useState(false)
  const [equipeCreee, setEquipeCreee] = useState<
    { email: string; motDePasseTemporaire: string; role: string }[]
  >(
    []
  )

  const choisirLogo = (fichier: File | null) => {
    setLogoFichier(fichier)
    if (fichier) {
      const lecteur = new FileReader()
      lecteur.onload = () => setLogoApercu(lecteur.result as string)
      lecteur.readAsDataURL(fichier)
    } else {
      setLogoApercu(null)
    }
  }

  const etape1Valide = nomEntreprise.trim() && emailEntreprise.trim() && telephone.trim()
  const etape2Valide =
    nomDirecteur.trim() &&
    motDePasseInscription.length >= 6 &&
    motDePasseInscription === confirmationMotDePasse

  const allerEtapeSuivante = () => {
    setErreur(null)
    if (etape === 1 && !etape1Valide) {
      setErreur(tt("Merci de remplir le nom, l’email et le téléphone de l’entreprise."))
      return
    }
    if (etape === 2 && !etape2Valide) {
      setErreur(tt("Le mot de passe doit faire au moins 6 caractères et les deux champs doivent correspondre."))
      return
    }
    setEtape((e) => Math.min(4, e + 1) as EtapeInscription)
  }

  const allerEtapePrecedente = () => {
    setErreur(null)
    setEtape((e) => Math.max(1, e - 1) as EtapeInscription)
  }

  const finaliserInscription = async () => {
    setErreur(null)
    setChargement(true)

    try {
      const { data: signupData, error: erreurSignup } = await supabase.auth.signUp({
        email: emailEntreprise,
        password: motDePasseInscription,
        options: {
          data: {
            nom_entreprise: nomEntreprise,
            vertical_slug: vertical,
            sous_secteur: sousSecteurChoisi || null,
            nom_complet: nomDirecteur,
          },
        },
      })

      if (erreurSignup) {
        setErreur(
          erreurSignup.message.toLowerCase().includes('already registered') ||
            erreurSignup.message.toLowerCase().includes('already been registered')
            ? tt("Cet email a déjà un compte — connecte-toi plutôt (un même email ne peut pas créer plusieurs cabinets).")
            : erreurSignup.message
        )
        setChargement(false)
        return
      }

      // Supabase ne renvoie PAS d'erreur si l'email existe deja (pour eviter
      // l'enumeration d'emails) - il renvoie un "succes" silencieux avec un
      // tableau identities vide. On doit donc detecter ce cas nous-memes.
      if (signupData.user && signupData.user.identities && signupData.user.identities.length === 0) {
        setErreur(tt("Cet email a déjà un compte — connecte-toi plutôt (un même email ne peut pas créer plusieurs cabinets)."))
        setChargement(false)
        setMode('connexion')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        setErreur(tt("Compte créé, mais la session a échoué. Essaie de te connecter."))
        setChargement(false)
        setMode('connexion')
        return
      }

      // Upload du logo (optionnel) directement dans le storage, meme
      // pattern que l'import PDF du catalogue.
      let logoUrl: string | null = null
      if (logoFichier) {
        const chemin = `${sessionData.session!.user.id}/${Date.now()}-${logoFichier.name}`
        const { error: erreurUpload } = await supabase.storage.from('logos').upload(chemin, logoFichier)
        if (!erreurUpload) {
          const { data: urlData } = supabase.storage.from('logos').getPublicUrl(chemin)
          logoUrl = urlData.publicUrl
        }
      }

      const res = await fetch('/api/inscription/finaliser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          telephone: telephone.trim() ? `${indicatifTelephone}${telephone.trim()}` : telephone,
          logo_url: logoUrl,
          site_web: siteWeb || null,
          facebook_url: facebookUrl || null,
          instagram_url: instagramUrl || null,
          linkedin_url: linkedinUrl || null,
          invite_emails: emailsEquipe,
          email_directeur_commercial: emailDirecteurCommercial || null,
          langue,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? tt("Compte créé, mais une erreur est survenue en finalisant l'inscription."))
        setChargement(false)
        return
      }

      if (data.equipeCreee?.length) {
        // On affiche les identifiants temporaires de l'equipe une seule fois :
        // le directeur doit les transmettre lui-meme a ses commerciaux.
        setEquipeCreee(data.equipeCreee)
        setChargement(false)
        return
      }

      await redirigerApresConnexion()
    } catch (err) {
      console.error('Erreur inscription:', err)
      setErreur(err instanceof Error ? tf("Erreur technique : {0}", [err.message]) : tt("Erreur technique inconnue"))
      setChargement(false)
    }
  }

  const redirigerApresConnexion = async () => {
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
  }

  const soumettreConnexion = async () => {
    setErreur(null)
    setMessageSucces(null)
    setChargement(true)

    try {
      if (mode === 'mot_de_passe_oublie') {
        if (etapeMdpOublie === 'email') {
          const res = await fetch('/api/auth/mot-de-passe-oublie/demander', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          const data = await res.json()
          if (!res.ok) {
            setErreur(data.error ?? tt("Erreur lors de l'envoi du code"))
          } else {
            setMessageSucces(tt("Code envoyé — vérifie ta boîte mail (et les spams)."))
            setEtapeMdpOublie('code')
          }
          setChargement(false)
          return
        }

        const res = await fetch('/api/auth/mot-de-passe-oublie/confirmer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: codeVerification, nouveauMotDePasse }),
        })
        const data = await res.json()
        if (!res.ok) {
          setErreur(data.error ?? tt("Erreur lors du changement de mot de passe"))
        } else {
          setMessageSucces(tt("Mot de passe mis à jour ! Tu peux te connecter."))
          setNouveauMotDePasse('')
          setCodeVerification('')
          setEtapeMdpOublie('email')
          setMode('connexion')
        }
        setChargement(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
      if (error) {
        setErreur(error.message)
        setChargement(false)
        return
      }

      await redirigerApresConnexion()
    } catch (err) {
      console.error('Erreur auth:', err)
      setErreur(err instanceof Error ? tf("Erreur technique : {0}", [err.message]) : tt("Erreur technique inconnue"))
      setChargement(false)
    }
  }

  // ----- Ecran final : identifiants de l'equipe a transmettre -----
  const [envoiIdentifiantsEnCours, setEnvoiIdentifiantsEnCours] = useState(false)
  const [envoiIdentifiantsMessage, setEnvoiIdentifiantsMessage] = useState<string | null>(null)

  const envoyerIdentifiantsParEmail = async () => {
    setEnvoiIdentifiantsEnCours(true)
    setEnvoiIdentifiantsMessage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const jeton = sessionData.session?.access_token
      const res = await fetch('/api/auth/envoyer-identifiants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ membres: equipeCreee }),
      })
      const data = await res.json()
      if (res.ok) {
        setEnvoiIdentifiantsMessage(
          data.echecs > 0
            ? tf("{0} email(s) envoyé(s), {1} échec(s).", [data.envoyes, data.echecs])
            : tf("✅ Identifiants envoyés à {0} membre(s) de l'équipe.", [data.envoyes])
        )
      } else {
        setEnvoiIdentifiantsMessage(data.error ?? tt("Erreur lors de l'envoi."))
      }
    } catch {
      setEnvoiIdentifiantsMessage(tt("Erreur lors de l'envoi."))
    }
    setEnvoiIdentifiantsEnCours(false)
  }

  if (equipeCreee.length > 0) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
          <LangueSelect langue={langue} onChange={changerLangue} />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">{tt("✅ Compte créé !")}</h1>
          <p className="text-slate-400 text-sm">
            {tt("Voici les identifiants de connexion de ton équipe — transmets-les-leur, ils ne seront plus affichés ensuite.")}</p>
          <div className="space-y-2 text-left bg-slate-900 border border-slate-700 rounded-xl p-4">
            {equipeCreee.map((m) => (
              <div key={m.email} className="text-sm border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                <p className="font-semibold">
                  {m.email}{' '}
                  <span className="text-accent text-xs font-normal">
                    {m.role === 'directeur_commercial' ? '🧭 Directeur commercial' : '👤 Commercial'}
                  </span>
                </p>
                <p className="text-slate-400">
                  {tt("Mot de passe temporaire :")}{' '}<span className="text-accent">{m.motDePasseTemporaire}</span>
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={envoyerIdentifiantsParEmail}
            disabled={envoiIdentifiantsEnCours}
            className="w-full py-2.5 rounded-lg border border-accent text-accent font-semibold hover:bg-accent/10 transition disabled:opacity-50"
          >
            {envoiIdentifiantsEnCours ? 'Envoi en cours...' : tt("📧 Envoyer les identifiants par email")}
          </button>
          {envoiIdentifiantsMessage && (
            <p className="text-xs text-slate-400">{envoiIdentifiantsMessage}</p>
          )}
          <button
            onClick={redirigerApresConnexion}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90 transition"
          >
            {tt("Accéder à mon tableau de bord →")}</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
        <div className="fixed top-4 right-4 z-40 flex items-center gap-3">
          <LangueSelect langue={langue} onChange={changerLangue} />
          <ThemeToggle />
        </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            {mode === 'inscription'
              ? tt("Créez le compte de votre cabinet")
              : mode === 'connexion'
              ? tt("Connexion à votre compte cabinet")
              : tt("Mot de passe oublié")}
          </h1>
          {mode === 'inscription' && (
            <p className="text-slate-600 text-xs">
              {tt("Étape")}{' '}{etape} {tt("sur 4")}{sousSecteurChoisi ? ` — ${sousSecteurChoisi}` : ''} {tt("— l'accès administration plateforme est réservé à PiloBrain et n'est pas ouvert à l'inscription.")}</p>
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

        {mode === 'inscription' && (
          <div className="space-y-4 bg-slate-900 border border-slate-700 rounded-xl p-6">
            {/* Indicateur d'etapes */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full ${n <= etape ? 'bg-accent' : 'bg-slate-800'}`}
                />
              ))}
            </div>

            {etape === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300">
                  {tt("L'identité de l'entreprise")}</p>
                <input
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  placeholder={tt("Nom de l'entreprise")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <input
                  value={emailEntreprise}
                  onChange={(e) => setEmailEntreprise(e.target.value)}
                  placeholder={tt("Email professionnel de l'entreprise")}
                  type="email"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <div className="flex gap-2">
                  <PhoneInput
                    className="w-full"
                    indicatif={indicatifTelephone}
                    onIndicatifChange={setIndicatifTelephone}
                    numero={telephone}
                    onNumeroChange={setTelephone}
                    placeholder={tt("Téléphone / WhatsApp pro")}
                  />
                </div>
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setGlisserSurvol(true)
                  }}
                  onDragLeave={() => setGlisserSurvol(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setGlisserSurvol(false)
                    choisirLogo(e.dataTransfer.files?.[0] ?? null)
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm cursor-pointer transition ${
                    glisserSurvol ? 'border-accent bg-accent/5' : 'border-slate-700 text-slate-500'
                  }`}
                >
                  {logoApercu ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoApercu} alt="Logo" className="h-16 object-contain" />
                  ) : (
                    <span>{tt("📁 Glissez-déposez le logo du cabinet ici (optionnel)")}</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => choisirLogo(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            )}

            {etape === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300">
                  {tt("L'identité du directeur commercial")}</p>
                <input
                  value={nomDirecteur}
                  onChange={(e) => setNomDirecteur(e.target.value)}
                  placeholder={tt("Prénom & nom du directeur")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <div className="relative">
                  <input
                    value={motDePasseInscription}
                    onChange={(e) => setMotDePasseInscription(e.target.value)}
                    placeholder={tt("Mot de passe")}
                    type={afficherMotDePasse ? 'text' : 'password'}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setAfficherMotDePasse((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={tt("Afficher/masquer le mot de passe")}
                  >
                    👁️
                  </button>
                </div>
                <input
                  value={confirmationMotDePasse}
                  onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                  placeholder={tt("Confirmation du mot de passe")}
                  type={afficherMotDePasse ? 'text' : 'password'}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
              </div>
            )}

            {etape === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300">
                  {tt("L'invitation de l'équipe")}</p>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {tt("Directeur commercial (optionnel) — supervise l'équipe et voit les statistiques de chacun.")}</p>
                  <input
                    value={emailDirecteurCommercial}
                    onChange={(e) => setEmailDirecteurCommercial(e.target.value)}
                    placeholder={tt("email.du.directeur@exemple.com")}
                    type="email"
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">
                    {tt("Commerciaux — adresses e-mail séparées par une virgule. Ils recevront un accès immédiat (à leur transmettre toi-même) — tu peux aussi le faire plus tard depuis ton tableau de bord.")}</p>
                  <textarea
                    value={emailsEquipe}
                    onChange={(e) => setEmailsEquipe(e.target.value)}
                    placeholder={tt("commercial1@exemple.com, commercial2@exemple.com")}
                    rows={3}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                  />
                </div>
              </div>
            )}

            {etape === 4 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-300">
                  {tt("Site et réseaux sociaux")}</p>
                <input
                  value={siteWeb}
                  onChange={(e) => setSiteWeb(e.target.value)}
                  placeholder={tt("Lien du site de l'entreprise (optionnel)")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder={tt("Page LinkedIn (optionnel)")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder={tt("Page Facebook (optionnel)")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder={tt("Page Instagram (optionnel)")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {etape > 1 && (
                <button
                  onClick={allerEtapePrecedente}
                  disabled={chargement}
                  className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition disabled:opacity-40"
                >
                  {tt("← Précédent")}</button>
              )}
              {etape < 4 ? (
                <button
                  onClick={allerEtapeSuivante}
                  className="flex-1 py-3 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90 transition"
                >
                  {tt("Suivant →")}</button>
              ) : (
                <button
                  onClick={finaliserInscription}
                  disabled={chargement}
                  className="flex-1 py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
                >
                  {chargement ? tt("Création du compte...") : tt("Créer mon compte →")}
                </button>
              )}
            </div>
          </div>
        )}

        {mode !== 'inscription' && (
          <div className="space-y-3 bg-slate-900 border border-slate-700 rounded-xl p-6">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && soumettreConnexion()}
              placeholder={tt("Email professionnel")}
              type="email"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
            />
            {mode !== 'mot_de_passe_oublie' && (
              <input
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && soumettreConnexion()}
                placeholder={tt("Mot de passe")}
                type="password"
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
              />
            )}
            {mode === 'mot_de_passe_oublie' && etapeMdpOublie === 'code' && (
              <>
                <input
                  value={codeVerification}
                  onChange={(e) => setCodeVerification(e.target.value)}
                  placeholder={tt("Code reçu par email (6 chiffres)")}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
                <input
                  value={nouveauMotDePasse}
                  onChange={(e) => setNouveauMotDePasse(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && soumettreConnexion()}
                  placeholder={tt("Nouveau mot de passe")}
                  type="password"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3"
                />
              </>
            )}
            <button
              onClick={soumettreConnexion}
              disabled={
                chargement ||
                !email ||
                (mode === 'connexion' && !motDePasse) ||
                (mode === 'mot_de_passe_oublie' &&
                  etapeMdpOublie === 'code' &&
                  (codeVerification.length < 4 || nouveauMotDePasse.length < 6))
              }
              className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition"
            >
              {chargement
                ? 'Chargement...'
                : mode === 'connexion'
                ? 'Se connecter'
                : mode === 'mot_de_passe_oublie' && etapeMdpOublie === 'email'
                ? tt("Envoyer le code")
                : tt("Mettre à jour le mot de passe")}
            </button>
          </div>
        )}

        {mode === 'connexion' && (
          <p className="text-center">
            <button
              onClick={() => {
                setMode('mot_de_passe_oublie')
                setEtapeMdpOublie('email')
                setErreur(null)
                setMessageSucces(null)
              }}
              className="text-slate-400 text-sm underline"
            >
              {tt("Mot de passe oublié ?")}</button>
          </p>
        )}

        <p className="text-center text-slate-400 text-sm">
          {mode === 'mot_de_passe_oublie' ? (
            <button
              onClick={() => {
                setMode('connexion')
                setEtapeMdpOublie('email')
                setCodeVerification('')
                setErreur(null)
                setMessageSucces(null)
              }}
              className="text-accent underline"
            >
              {tt("Retour à la connexion")}</button>
          ) : (
            <>
              {mode === 'inscription' ? tt("Déjà un compte ?") : tt("Pas encore de compte ?")}{' '}
              <button
                onClick={() => {
                  if (mode === 'inscription') {
                    setMode('connexion')
                    setErreur(null)
                    setEtape(1)
                  } else {
                    // "S'inscrire" doit repasser par le choix du secteur (page /secteurs)
                    // avant d'arriver sur le formulaire d'inscription pré-rempli, plutot
                    // que d'afficher directement le formulaire generique.
                    router.push('/secteurs')
                  }
                }}
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
