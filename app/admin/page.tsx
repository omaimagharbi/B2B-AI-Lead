'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ClientAdmin = {
  id: string
  nom_entreprise: string
  email: string
  statut_abonnement: string
  acces_active: boolean
  montant_abonnement: number | null
  devise_abonnement: string | null
  statut_paiement: string | null
  date_echeance_paiement: string | null
  mode_paiement: string | null
  quota_cibles_mensuel: number | null
  nb_cibles_mois_en_cours?: number
  plan_tarifaire: string | null
  created_at: string
  packs_vendus: number
  montant_vendu: number
  commission_pourcentage: number | null
  commission_due: number
  nb_cibles: number
  nb_diagnostics_attente: number
}

export default function AdminPage() {
  const [clients, setClients] = useState<ClientAdmin[]>([])
  const [monitoring, setMonitoring] = useState<{
    sante: Record<
      string,
      {
        statut: 'ok' | 'ko' | 'inconnu'
        derniere_verif: string | null
        details: string | null
        taux_succes_recent: number | null
      }
    >
    cout_ia_mois_en_cours: {
      client_id: string
      nom: string
      cout_usd: number
      appels: number
      abonnement: number | null
      devise: string | null
    }[]
  } | null>(null)
  const [statsGlobales, setStatsGlobales] = useState<{
    total_entreprises: number
    entreprises_actives: number
    en_attente_activation: number
    total_diagnostics: number
    total_cibles: number
    mrr_par_devise: Record<string, number>
  } | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [majEnCours, setMajEnCours] = useState<string | null>(null)

  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [nouveauContact, setNouveauContact] = useState('')
  const [nouveauVertical, setNouveauVertical] = useState('cabinet-formation')
  const [demandeBetaEnConversion, setDemandeBetaEnConversion] = useState<string | null>(null)
  const [creationEnCours, setCreationEnCours] = useState(false)
  const [resultatCreation, setResultatCreation] = useState<{
    email: string
    motDePasseTemporaire: string
  } | null>(null)
  const [demandesBeta, setDemandesBeta] = useState<
    {
      id: string
      email: string
      nom_entreprise: string | null
      telephone: string | null
      carte_slug: string
      sous_secteur: string | null
      traite: boolean
      created_at: string
    }[]
  >([])
  const [demandeBetaOuverte, setDemandeBetaOuverte] = useState<string | null>(null)
  const [erreurCreation, setErreurCreation] = useState<string | null>(null)

  const charger = async () => {
    setChargement(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    if (!token) {
      setErreur('Vous devez etre connecte')
      setChargement(false)
      return
    }

    const res = await fetch('/api/admin/clients', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()

    if (!res.ok) {
      setErreur(data.error ?? 'Acces refuse')
      setChargement(false)
      return
    }

    setClients(data.clients)

    const resStats = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resStats.ok) {
      setStatsGlobales(await resStats.json())
    }

    const resMonitoring = await fetch('/api/admin/monitoring', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resMonitoring.ok) {
      setMonitoring(await resMonitoring.json())
    }

    const resBeta = await fetch('/api/admin/beta-demandes', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resBeta.ok) {
      setDemandesBeta((await resBeta.json()).demandes)
    }

    setChargement(false)
  }

  useEffect(() => {
    charger()
  }, [])

  const basculerPayant = async (clientId: string, planActuel: string) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const nouveauStatut = planActuel === 'payant' ? 'trial' : 'payant'

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        statut_abonnement: nouveauStatut,
        plan_tarifaire: nouveauStatut === 'payant' ? '400dt_mois' : null,
      }),
    })

    await charger()
    setMajEnCours(null)
  }

  const basculerAcces = async (clientId: string, accesActuel: boolean) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        acces_active: !accesActuel,
      }),
    })

    await charger()
    setMajEnCours(null)
  }

  const supprimerClient = async (clientId: string, nomEntreprise: string) => {
    const confirmation = window.confirm(
      `Supprimer definitivement "${nomEntreprise || 'ce cabinet'}" ?\n\nCeci supprime le cabinet, toutes ses donnees (cibles, diagnostics, pipeline...) et les comptes de connexion de tous ses membres. Action irreversible.`
    )
    if (!confirmation) return

    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const res = await fetch('/api/admin/clients', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ client_id: clientId }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      window.alert(data?.error ?? 'Erreur lors de la suppression. Reessaie ou verifie la console.')
      setMajEnCours(null)
      return
    }

    await charger()
    setMajEnCours(null)
  }

  const forcerStatutPaye = async (clientId: string) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    // Echeance repoussee d'un mois a partir d'aujourd'hui - simple
    // renouvellement manuel pour les paiements hors Stripe (cheque,
    // especes, virement en Tunisie).
    const nouvelleEcheance = new Date()
    nouvelleEcheance.setMonth(nouvelleEcheance.getMonth() + 1)

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        statut_paiement: 'paye',
        date_echeance_paiement: nouvelleEcheance.toISOString().slice(0, 10),
      }),
    })

    await charger()
    setMajEnCours(null)
  }

  const modifierMontantAbonnement = async (
    clientId: string,
    montant: number,
    devise: string,
    modePaiement: string
  ) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        client_id: clientId,
        montant_abonnement: montant,
        devise_abonnement: devise,
        mode_paiement: modePaiement,
      }),
    })

    await charger()
    setMajEnCours(null)
  }

  const modifierQuota = async (clientId: string, quota: number | null) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ client_id: clientId, quota_cibles_mensuel: quota }),
    })

    await charger()
    setMajEnCours(null)
  }

  const basculerDemandeTraitee = async (id: string, traiteActuel: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    await fetch('/api/admin/beta-demandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, traite: !traiteActuel }),
    })

    await charger()
  }

  const modifierCommission = async (clientId: string, pourcentage: number) => {
    setMajEnCours(clientId)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ client_id: clientId, commission_pourcentage: pourcentage }),
    })

    await charger()
    setMajEnCours(null)
  }

  const creerCabinet = async () => {
    if (!nouveauNom.trim() || !nouvelEmail.trim()) return
    setCreationEnCours(true)
    setErreurCreation(null)
    setResultatCreation(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const res = await fetch('/api/admin/clients/creer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nom_entreprise: nouveauNom,
        email: nouvelEmail,
        nom_complet: nouveauContact,
        vertical_slug: nouveauVertical,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErreurCreation(data.error ?? 'Erreur lors de la création')
    } else {
      setResultatCreation({ email: data.email, motDePasseTemporaire: data.motDePasseTemporaire })
      setNouveauNom('')
      setNouvelEmail('')
      setNouveauContact('')
      if (demandeBetaEnConversion) {
        await basculerDemandeTraitee(demandeBetaEnConversion, false)
        setDemandeBetaEnConversion(null)
      }
      await charger()
    }
    setCreationEnCours(false)
  }

  if (chargement) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (erreur) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-red-400">{erreur}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">🔑 Administration — Cabinets</h1>
          <a href="/dashboard" className="text-sm text-accent underline">
            ← Voir mon propre dashboard cabinet
          </a>
        </div>

        {statsGlobales && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase">Entreprises actives</p>
              <p className="text-2xl font-bold text-accent">
                {statsGlobales.entreprises_actives}
                <span className="text-sm text-slate-500 font-normal">
                  {' '}
                  / {statsGlobales.total_entreprises}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-amber-900 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase">En attente d'activation</p>
              <p className="text-2xl font-bold text-amber-400">{statsGlobales.en_attente_activation}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase">Diagnostics générés</p>
              <p className="text-2xl font-bold">{statsGlobales.total_diagnostics}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase">Cibles sourcées</p>
              <p className="text-2xl font-bold">{statsGlobales.total_cibles}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs text-slate-500 uppercase" title="Monthly Recurring Revenue : revenu mensuel récurrent total des abonnements payants actifs">
                MRR (revenu récurrent mensuel)
              </p>
              <p className="text-lg font-bold">
                {Object.keys(statsGlobales.mrr_par_devise).length === 0
                  ? '—'
                  : Object.entries(statsGlobales.mrr_par_devise)
                      .map(([devise, montant]) => `${montant} ${devise}`)
                      .join(' · ')}
              </p>
            </div>
          </div>
        )}

        {monitoring && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h2 className="font-semibold">⚙️ Console santé des intégrations</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(monitoring.sante).map(([service, info]) => (
                <div key={service} className="rounded-lg bg-slate-950 border border-slate-800 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        info.statut === 'ok'
                          ? 'bg-emerald-500'
                          : info.statut === 'ko'
                          ? 'bg-red-500'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-sm font-medium capitalize">
                      {service.replace('_', ' ')}
                    </span>
                  </div>
                  {info.taux_succes_recent !== null ? (
                    <p className="text-xs text-slate-500 mt-1">
                      {info.taux_succes_recent}% succès (20 derniers appels)
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-1">Aucun appel encore enregistré</p>
                  )}
                  {info.details && (
                    <p className="text-xs text-red-400 mt-1 truncate" title={info.details}>
                      {info.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {monitoring && monitoring.cout_ia_mois_en_cours.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h2 className="font-semibold">🧮 Coût IA réel — mois en cours</h2>
            <p className="text-xs text-slate-500">
              Estimation basée sur les tarifs publics des fournisseurs — à titre indicatif, pas
              une facture exacte.
            </p>
            <div className="space-y-2">
              {monitoring.cout_ia_mois_en_cours.map((c) => (
                <div
                  key={c.client_id}
                  className="flex items-center justify-between rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
                >
                  <span>{c.nom}</span>
                  <span className="text-slate-400">
                    {c.appels} appel{c.appels > 1 ? 's' : ''} · ~${c.cout_usd.toFixed(3)}
                    {c.abonnement != null && (
                      <>
                        {' '}
                        · abonnement {c.abonnement} {c.devise}
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {demandesBeta.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h2 className="font-semibold">
              🔒 Demandes Bêta Privée{' '}
              <span className="text-xs text-slate-500 font-normal">
                ({demandesBeta.filter((d) => !d.traite).length} non traitée
                {demandesBeta.filter((d) => !d.traite).length > 1 ? 's' : ''})
              </span>
            </h2>
            <div className="space-y-2">
              {demandesBeta.map((d) => {
                const ouverte = demandeBetaOuverte === d.id
                return (
                  <div
                    key={d.id}
                    className={`rounded-lg border text-sm ${
                      d.traite
                        ? 'bg-slate-950 border-slate-800 opacity-50'
                        : 'bg-slate-950 border-amber-900'
                    }`}
                  >
                    <button
                      onClick={() => setDemandeBetaOuverte(ouverte ? null : d.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left"
                    >
                      <span>
                        <span className="font-medium">
                          {d.nom_entreprise || '(entreprise inconnue)'}
                        </span>
                        <span className="text-slate-500">
                          {' '}
                          · {d.carte_slug} ·{' '}
                          {new Date(d.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </span>
                      <span className="text-slate-500 text-xs">{ouverte ? '▲' : '▼ voir le détail'}</span>
                    </button>
                    {ouverte && (
                      <div className="border-t border-slate-800 px-3 py-3 space-y-2">
                        <p>
                          <span className="text-slate-500">Entreprise :</span>{' '}
                          {d.nom_entreprise || '(non renseignée)'}
                        </p>
                        <p>
                          <span className="text-slate-500">Email :</span> {d.email}
                        </p>
                        <p>
                          <span className="text-slate-500">Téléphone :</span>{' '}
                          {d.telephone || '(non renseigné)'}
                        </p>
                        <p>
                          <span className="text-slate-500">Carte :</span> {d.carte_slug}
                          {d.sous_secteur ? ` · ${d.sous_secteur}` : ''}
                        </p>
                        <p>
                          <span className="text-slate-500">Reçue le :</span>{' '}
                          {new Date(d.created_at).toLocaleString('fr-FR')}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setNouveauNom(d.nom_entreprise || '')
                              setNouvelEmail(d.email)
                              setNouveauContact('')
                              setNouveauVertical(d.carte_slug)
                              setDemandeBetaEnConversion(d.id)
                              setResultatCreation(null)
                              setErreurCreation(null)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="text-xs px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold"
                          >
                            ✅ Donner accès (créer le cabinet)
                          </button>
                          <button
                            onClick={() => basculerDemandeTraitee(d.id, d.traite)}
                            className="text-xs px-3 py-1 rounded-lg bg-slate-800 border border-slate-700"
                          >
                            {d.traite ? 'Marquer non traitée' : 'Marquer traitée'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          "Donner accès" pré-remplit le formulaire de création de cabinet en haut de
                          page avec les infos de cette demande — il ne reste qu'à cliquer sur "Créer
                          le cabinet". Le nouveau cabinet apparaîtra automatiquement dans la liste des
                          cabinets ci-dessous.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <h2 className="font-semibold">➕ Créer un nouveau cabinet</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              placeholder="Nom du cabinet"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouvelEmail}
              onChange={(e) => setNouvelEmail(e.target.value)}
              placeholder="Email du propriétaire"
              type="email"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouveauContact}
              onChange={(e) => setNouveauContact(e.target.value)}
              placeholder="Nom du contact (optionnel)"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouveauVertical}
              onChange={(e) => setNouveauVertical(e.target.value)}
              placeholder="cabinet-formation"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
          </div>
          <button
            onClick={creerCabinet}
            disabled={creationEnCours || !nouveauNom.trim() || !nouvelEmail.trim()}
            className="text-sm px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
          >
            {creationEnCours ? '...' : 'Créer le cabinet'}
          </button>
          {erreurCreation && <p className="text-red-400 text-sm">{erreurCreation}</p>}
          {resultatCreation && (
            <p className="text-sm text-accent bg-slate-950 border border-accent/40 rounded-lg p-3">
              ✅ Cabinet créé — transmets ces identifiants au client (par WhatsApp, en main propre...) :
              <br />
              Email : <strong>{resultatCreation.email}</strong> · Mot de passe temporaire :{' '}
              <strong>{resultatCreation.motDePasseTemporaire}</strong>
            </p>
          )}
        </div>

        <div className="space-y-3">
          {clients.map((client) => {
            return (
              <div
                key={client.id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{client.nom_entreprise || '(sans nom)'}</p>
                    <p className="text-slate-400 text-sm">{client.email || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => basculerAcces(client.id, client.acces_active)}
                      disabled={majEnCours === client.id}
                      className={`text-sm px-3 py-2 rounded-lg border transition disabled:opacity-40 ${
                        client.acces_active
                          ? 'bg-slate-800 border-slate-600 hover:bg-slate-700'
                          : 'bg-accent text-slate-950 border-accent font-semibold hover:bg-accent/90'
                      }`}
                    >
                      {majEnCours === client.id
                        ? '...'
                        : client.acces_active
                        ? '🔓 Accès actif'
                        : '🔒 Activer l\'accès'}
                    </button>
                    <button
                      onClick={() => basculerPayant(client.id, client.statut_abonnement)}
                      disabled={majEnCours === client.id}
                      className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 transition disabled:opacity-40 shrink-0"
                    >
                      {majEnCours === client.id
                        ? '...'
                        : client.statut_abonnement === 'payant'
                        ? 'Repasser en essai'
                        : 'Passer en payant'}
                    </button>
                    <button
                      onClick={() => supprimerClient(client.id, client.nom_entreprise)}
                      disabled={majEnCours === client.id}
                      title="Supprimer definitivement ce cabinet (compte de test, doublon...)"
                      className="text-sm px-3 py-2 rounded-lg bg-red-950 text-red-400 border border-red-900 hover:bg-red-900 transition disabled:opacity-40 shrink-0"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`px-2 py-1 rounded-full ${
                      client.statut_abonnement === 'payant'
                        ? 'bg-green-950 text-accent'
                        : 'bg-amber-950 text-amber-400'
                    }`}
                  >
                    {client.statut_abonnement}
                    {client.plan_tarifaire ? ` (${client.plan_tarifaire})` : ''}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                    🎯 {client.nb_cibles} cibles
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                    🔔 {client.nb_diagnostics_attente} en attente
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                    💰 {client.packs_vendus} packs vendus
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-500">
                    Inscrit le {new Date(client.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-800">
                  <label className="text-slate-400">Commission :</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={client.commission_pourcentage ?? 0}
                    onBlur={(e) => modifierCommission(client.id, Number(e.target.value))}
                    className="w-16 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                  />
                  <span className="text-slate-500">%</span>
                  {(client.commission_pourcentage ?? 0) > 0 && (
                    <span className="text-accent font-semibold ml-2">
                      → {client.commission_due} dû (sur {client.montant_vendu} vendu)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs pt-1 border-t border-slate-800 flex-wrap">
                  <label className="text-slate-400">Abonnement :</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Montant"
                    defaultValue={client.montant_abonnement ?? ''}
                    onBlur={(e) =>
                      modifierMontantAbonnement(
                        client.id,
                        Number(e.target.value),
                        client.devise_abonnement ?? 'TND',
                        client.mode_paiement ?? ''
                      )
                    }
                    className="w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                  />
                  <select
                    defaultValue={client.devise_abonnement ?? 'TND'}
                    onChange={(e) =>
                      modifierMontantAbonnement(
                        client.id,
                        client.montant_abonnement ?? 0,
                        e.target.value,
                        client.mode_paiement ?? ''
                      )
                    }
                    className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                  >
                    <option value="TND">TND</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                  <select
                    defaultValue={client.mode_paiement ?? ''}
                    onChange={(e) =>
                      modifierMontantAbonnement(
                        client.id,
                        client.montant_abonnement ?? 0,
                        client.devise_abonnement ?? 'TND',
                        e.target.value
                      )
                    }
                    className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                  >
                    <option value="">Mode de paiement</option>
                    <option value="cheque">Chèque</option>
                    <option value="especes">Espèces</option>
                    <option value="virement">Virement</option>
                    <option value="stripe">Stripe</option>
                  </select>
                  <span
                    className={`px-2 py-1 rounded-full ${
                      client.statut_paiement === 'paye'
                        ? 'bg-green-950 text-accent'
                        : client.statut_paiement === 'en_retard'
                        ? 'bg-red-950 text-red-400'
                        : 'bg-amber-950 text-amber-400'
                    }`}
                  >
                    {client.statut_paiement === 'paye'
                      ? '✅ Payé'
                      : client.statut_paiement === 'en_retard'
                      ? '⚠️ En retard'
                      : '⏳ En attente'}
                  </span>
                  {client.date_echeance_paiement && (
                    <span className="text-slate-500">
                      Échéance : {new Date(client.date_echeance_paiement).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                  {client.statut_paiement !== 'paye' && (
                    <button
                      onClick={() => forcerStatutPaye(client.id)}
                      disabled={majEnCours === client.id}
                      className="px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                    >
                      Forcer le statut payé
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <label className="text-slate-400">Quota cibles/mois :</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Illimité"
                    defaultValue={client.quota_cibles_mensuel ?? ''}
                    onBlur={(e) =>
                      modifierQuota(client.id, e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-24 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                  />
                  {client.quota_cibles_mensuel != null ? (
                    <span
                      className={
                        (client.nb_cibles_mois_en_cours ?? 0) >= client.quota_cibles_mensuel
                          ? 'text-red-400 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {client.nb_cibles_mois_en_cours ?? 0} / {client.quota_cibles_mensuel} ce
                      mois-ci
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {client.nb_cibles_mois_en_cours ?? 0} ce mois-ci · illimité
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
