'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SOUS_SECTEURS_PAR_VERTICAL } from '@/lib/sous-secteurs'

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
  vertical_slug: string | null
  secteur_activite?: string | null
  onglets_autorises?: string[] | null
  verticals_autorises?: string[] | null
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
  const [filtreRecherche, setFiltreRecherche] = useState('')
  const [filtreAbonnement, setFiltreAbonnement] = useState<'tous' | 'payant' | 'essai'>('tous')
  const [filtreAcces, setFiltreAcces] = useState<'tous' | 'actif' | 'inactif'>('tous')
  const [filtreVertical, setFiltreVertical] = useState<string>('tous')
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
  const [gestionAccesOuverte, setGestionAccesOuverte] = useState<string | null>(null)

  const [nouveauNom, setNouveauNom] = useState('')
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [nouveauContact, setNouveauContact] = useState('')
  const [nouveauVertical, setNouveauVertical] = useState('cabinet-formation')
  const [nouveauSousSecteur, setNouveauSousSecteur] = useState('')
  const [demandeBetaEnConversion, setDemandeBetaEnConversion] = useState<string | null>(null)
  const [creationEnCours, setCreationEnCours] = useState(false)
  const [resultatCreation, setResultatCreation] = useState<{
    email: string
    motDePasseTemporaire: string
    emailEnvoye?: boolean
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
  const [clientMisEnEvidence, setClientMisEnEvidence] = useState<string | null>(null)
  const [manuelChatbot, setManuelChatbot] = useState('')
  const [manuelChatbotChargement, setManuelChatbotChargement] = useState(true)
  const [manuelChatbotSauvegarde, setManuelChatbotSauvegarde] = useState(false)
  const [manuelChatbotImportEnCours, setManuelChatbotImportEnCours] = useState(false)
  const [manuelChatbotErreurImport, setManuelChatbotErreurImport] = useState<string | null>(null)

  // Panneau de diagnostic : les echecs silencieux (IA indisponible, extraction
  // catalogue, etc.) sont desormais journalises en base (voir logErreur) mais
  // il n'y avait encore aucun endroit pour les consulter cote admin.
  const [erreursLogs, setErreursLogs] = useState<
    { id: string; route: string; message: string | null; created_at: string }[]
  >([])
  const [erreursOuvert, setErreursOuvert] = useState(false)
  const [erreursChargement, setErreursChargement] = useState(false)

  const chargerErreurs = async () => {
    setErreursChargement(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/admin/erreurs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) setErreursLogs(data.erreurs ?? [])
    setErreursChargement(false)
  }

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
    const chargerManuel = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/admin/chatbot', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setManuelChatbot((await res.json()).manuel_utilisation ?? '')
      setManuelChatbotChargement(false)
    }
    chargerManuel()
  }, [])

  const sauvegarderManuelChatbot = async () => {
    setManuelChatbotSauvegarde(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/admin/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ manuel_utilisation: manuelChatbot }),
    })
    setManuelChatbotSauvegarde(false)
  }

  // Retour terrain : le manuel doit pouvoir venir d'un document Word (celui
  // qu'Omaima a deja redige) au lieu d'etre retape a la main. On extrait le
  // texte du fichier et on le met dans la zone de texte pour relecture —
  // l'admin garde la main pour ajuster avant de cliquer "Enregistrer".
  const importerManuelChatbot = async (fichier: File) => {
    setManuelChatbotImportEnCours(true)
    setManuelChatbotErreurImport(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const lecteur = new FileReader()
        lecteur.onload = () => resolve((lecteur.result as string).split(',')[1])
        lecteur.onerror = () => reject(new Error('Lecture du fichier impossible'))
        lecteur.readAsDataURL(fichier)
      })

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/admin/chatbot/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fichier_base64: base64, mime_type: fichier.type, nom_fichier: fichier.name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setManuelChatbotErreurImport(data.error ?? "Erreur lors de l'import")
      } else {
        setManuelChatbot(data.texte)
      }
    } catch (err) {
      setManuelChatbotErreurImport("Erreur lors de la lecture du fichier")
    } finally {
      setManuelChatbotImportEnCours(false)
    }
  }

  const telechargerManuelChatbot = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/admin/chatbot/telecharger', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'manuel-chatbot-support.docx'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Retour terrain : "je dois avoir des versions" - historique des versions
  // precedentes du manuel, avec possibilite de restaurer l'une d'elles.
  const [versionsManuel, setVersionsManuel] = useState<
    { id: string; manuel_utilisation: string; created_at: string }[]
  >([])
  const [versionsOuvertes, setVersionsOuvertes] = useState(false)
  const [versionsChargement, setVersionsChargement] = useState(false)

  const chargerVersionsManuel = async () => {
    if (versionsOuvertes) {
      setVersionsOuvertes(false)
      return
    }
    setVersionsChargement(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/admin/chatbot/historique', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) setVersionsManuel(data.versions ?? [])
    setVersionsOuvertes(true)
    setVersionsChargement(false)
  }

  const restaurerVersionManuel = (texte: string) => {
    setManuelChatbot(texte)
    setVersionsOuvertes(false)
  }

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

  // Retour terrain : l'admin doit pouvoir donner acces a un cabinet a une ou
  // plusieurs cartes/secteurs, et restreindre les onglets accessibles au
  // niveau du compte (au-dela de ce que le proprietaire du cabinet controle
  // deja pour ses propres membres).
  const basculerVerticalAutorise = async (client: ClientAdmin, slug: string) => {
    const actuels = client.verticals_autorises ?? (client.vertical_slug ? [client.vertical_slug] : [])
    const dejaAutorise = actuels.includes(slug)
    const nouveaux = dejaAutorise ? actuels.filter((v) => v !== slug) : [...actuels, slug]

    setMajEnCours(client.id)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_id: client.id, verticals_autorises: nouveaux }),
    })
    await charger()
    setMajEnCours(null)
  }

  const basculerOngletAutorise = async (client: ClientAdmin, ongletId: string) => {
    // null/vide = tous autorises ; on part donc de la liste complete si rien
    // n'a encore ete restreint, pour que le premier clic retire bien juste
    // celui-la (et pas tout le reste).
    const actuels = client.onglets_autorises ?? ONGLETS_ADMIN.map((o) => o.id)
    const dejaAutorise = actuels.includes(ongletId)
    const nouveaux = dejaAutorise ? actuels.filter((o) => o !== ongletId) : [...actuels, ongletId]

    setMajEnCours(client.id)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/admin/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client_id: client.id, onglets_autorises: nouveaux }),
    })
    await charger()
    setMajEnCours(null)
  }

  const VERTICALS_ADMIN = [
    { slug: 'cabinet-formation', label: 'Cabinet de Formation & Conseil' },
    { slug: 'startup-saas', label: 'Startup Tech & SaaS' },
    { slug: 'pme-services', label: 'PME de Services & Entreprises' },
    { slug: 'investisseur-incubateur', label: 'Écosystème Entrepreneurial' },
    { slug: 'comptable-fiscal', label: 'Cabinet Comptable, Juridique & Fiscal' },
    { slug: 'services-generaux', label: 'Logistique, Transit & Services Généraux' },
  ]

  const ONGLETS_ADMIN = [
    { id: 'ciblage', label: 'Ciblage' },
    { id: 'cibles', label: 'Cibles' },
    { id: 'validation', label: 'Validation' },
    { id: 'inbox', label: 'Boîte de réception' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'catalogue_strategie', label: 'Catalogue / Stratégie' },
    { id: 'collaboration', label: 'Collaboration & Tâches' },
    { id: 'calendrier', label: 'Calendrier' },
    { id: 'stats', label: 'Stats' },
    { id: 'equipe', label: 'Équipe' },
  ]

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

  // Accepte des overrides explicites (au lieu de relire les states) pour que
  // "Donner accès" puisse creer le cabinet immediatement, en un seul clic,
  // sans dependre du re-render du formulaire du haut (setState est async :
  // relire nouveauNom/nouvelEmail juste apres un setNouveauNom(...) lirait
  // encore l'ancienne valeur).
  const creerCabinet = async (overrides?: {
    nom?: string
    email?: string
    contact?: string
    vertical?: string
    sousSecteur?: string
    demandeBetaId?: string | null
  }) => {
    const nom = overrides?.nom ?? nouveauNom
    const email = overrides?.email ?? nouvelEmail
    const contact = overrides?.contact ?? nouveauContact
    const vertical = overrides?.vertical ?? nouveauVertical
    const sousSecteur = overrides?.sousSecteur ?? nouveauSousSecteur
    const demandeId = overrides?.demandeBetaId !== undefined ? overrides.demandeBetaId : demandeBetaEnConversion

    if (!nom.trim() || !email.trim()) return
    setCreationEnCours(true)
    setErreurCreation(null)
    setResultatCreation(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const res = await fetch('/api/admin/clients/creer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        nom_entreprise: nom,
        email: email,
        nom_complet: contact,
        vertical_slug: vertical,
        sous_secteur: sousSecteur || undefined,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setErreurCreation(data.error ?? 'Erreur lors de la création')
    } else {
      setResultatCreation({
        email: data.email,
        motDePasseTemporaire: data.motDePasseTemporaire,
        emailEnvoye: data.emailEnvoye,
      })
      setNouveauNom('')
      setNouvelEmail('')
      setNouveauContact('')
      if (demandeId) {
        await basculerDemandeTraitee(demandeId, false)
        setDemandeBetaEnConversion(null)
      }
      await charger()

      // Le nouveau cabinet est en haut de la liste (tri created_at desc),
      // mais peut passer inapercu sous le message de confirmation : on
      // scrolle jusqu'a sa carte et on la met en evidence quelques secondes.
      if (data.clientId) {
        setClientMisEnEvidence(data.clientId)
        setTimeout(() => {
          document
            .getElementById(`client-${data.clientId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        setTimeout(() => setClientMisEnEvidence(null), 4000)
      }
    }
    setCreationEnCours(false)
  }

  // "Donner accès" doit creer le cabinet tout de suite (retour terrain :
  // "je clique, rien ne change" — avant, le clic se contentait de pre-remplir
  // le formulaire du haut, ce qui ne se voit pas si on est deja en haut de
  // page). On pre-remplit quand meme le formulaire (pour que l'admin voie
  // ce qui a ete utilise / puisse corriger si l'API echoue) et on lance la
  // creation immediatement avec les valeurs de la demande.
  const donnerAccesDepuisDemande = (d: {
    id: string
    email: string
    nom_entreprise: string | null
    carte_slug: string
  }) => {
    setNouveauNom(d.nom_entreprise || d.email)
    setNouvelEmail(d.email)
    setNouveauContact('')
    setNouveauVertical(d.carte_slug)
    setDemandeBetaEnConversion(d.id)
    setResultatCreation(null)
    setErreurCreation(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    creerCabinet({
      nom: d.nom_entreprise || d.email,
      email: d.email,
      contact: '',
      vertical: d.carte_slug,
      demandeBetaId: d.id,
    })
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

  const clientsFiltres = clients.filter((c) => {
    const recherche = filtreRecherche.trim().toLowerCase()
    if (
      recherche &&
      !c.nom_entreprise?.toLowerCase().includes(recherche) &&
      !c.email?.toLowerCase().includes(recherche)
    ) {
      return false
    }
    if (filtreAbonnement !== 'tous' && c.statut_abonnement !== filtreAbonnement) return false
    if (filtreAcces === 'actif' && !c.acces_active) return false
    if (filtreAcces === 'inactif' && c.acces_active) return false
    if (filtreVertical !== 'tous' && c.vertical_slug !== filtreVertical) return false
    return true
  })

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">🔑 Administration — Cabinets</h1>
          <a href="/dashboard" className="text-sm text-accent underline">
            ← Voir mon propre dashboard cabinet
          </a>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <p className="text-sm font-semibold">🤖 Manuel d'utilisation du chatbot support</p>
          <p className="text-xs text-slate-500">
            Le chatbot flottant visible par tous les cabinets répond UNIQUEMENT à partir du texte
            ci-dessous. Plus il est détaillé et à jour, meilleures sont les réponses.
          </p>
          {manuelChatbotChargement ? (
            <p className="text-xs text-slate-500">Chargement...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer">
                  {manuelChatbotImportEnCours ? 'Import en cours...' : '📄 Importer un document (.docx / .pdf / .txt)'}
                  <input
                    type="file"
                    accept=".docx,.pdf,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
                    className="hidden"
                    disabled={manuelChatbotImportEnCours}
                    onChange={(e) => {
                      const fichier = e.target.files?.[0]
                      if (fichier) importerManuelChatbot(fichier)
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  onClick={telechargerManuelChatbot}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
                >
                  ⬇️ Télécharger le manuel actuel (.docx)
                </button>
                <button
                  onClick={chargerVersionsManuel}
                  disabled={versionsChargement}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-50"
                >
                  {versionsChargement
                    ? 'Chargement...'
                    : versionsOuvertes
                    ? '🕘 Masquer les versions'
                    : '🕘 Voir les versions précédentes'}
                </button>
              </div>
              {versionsOuvertes && (
                <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 space-y-2 max-h-64 overflow-y-auto">
                  {versionsManuel.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Aucune version précédente enregistrée pour le moment.
                    </p>
                  ) : (
                    versionsManuel.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400">
                            {new Date(v.created_at).toLocaleString('fr-FR')}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-md">
                            {v.manuel_utilisation.slice(0, 100)}
                            {v.manuel_utilisation.length > 100 ? '...' : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => restaurerVersionManuel(v.manuel_utilisation)}
                          className="text-xs px-2 py-1 rounded-lg bg-accent text-slate-950 font-semibold shrink-0"
                        >
                          Restaurer
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
              {manuelChatbotErreurImport && (
                <p className="text-xs text-red-400">{manuelChatbotErreurImport}</p>
              )}
              <textarea
                value={manuelChatbot}
                onChange={(e) => setManuelChatbot(e.target.value)}
                placeholder="Ex: Pour créer un diagnostic, va dans l'onglet Ciblage... Pour ajouter un membre à l'équipe..."
                rows={10}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-sm font-mono"
              />
              <p className="text-xs text-slate-500">
                Importer un fichier remplit la zone ci-dessus avec son contenu (à relire), mais ne
                sauvegarde rien tant que tu n'as pas cliqué sur "Enregistrer le manuel".
              </p>
              <button
                onClick={sauvegarderManuelChatbot}
                disabled={manuelChatbotSauvegarde}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
              >
                {manuelChatbotSauvegarde ? 'Enregistrement...' : 'Enregistrer le manuel'}
              </button>
            </>
          )}
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
                            onClick={() => donnerAccesDepuisDemande(d)}
                            disabled={creationEnCours}
                            className="text-xs px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                          >
                            {creationEnCours && demandeBetaEnConversion === d.id
                              ? 'Création en cours...'
                              : '✅ Donner accès (créer le cabinet)'}
                          </button>
                          <button
                            onClick={() => basculerDemandeTraitee(d.id, d.traite)}
                            className="text-xs px-3 py-1 rounded-lg bg-slate-800 border border-slate-700"
                          >
                            {d.traite ? 'Marquer non traitée' : 'Marquer traitée'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          "Donner accès" crée le cabinet immédiatement avec les infos de cette
                          demande (nom, email, secteur) et affiche le mot de passe temporaire à
                          transmettre au client — pas besoin d'un second clic. Le formulaire du haut
                          de page se pré-remplit aussi, au cas où l'email ou le secteur doivent être
                          corrigés avant de réessayer.
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
            <select
              value={nouveauVertical}
              onChange={(e) => {
                setNouveauVertical(e.target.value)
                setNouveauSousSecteur('')
              }}
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            >
              {VERTICALS_ADMIN.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.label}
                </option>
              ))}
            </select>
            {SOUS_SECTEURS_PAR_VERTICAL[nouveauVertical] && (
              <select
                value={nouveauSousSecteur}
                onChange={(e) => setNouveauSousSecteur(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">— Sous-secteur précis (optionnel) —</option>
                {SOUS_SECTEURS_PAR_VERTICAL[nouveauVertical].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => creerCabinet()}
            disabled={creationEnCours || !nouveauNom.trim() || !nouvelEmail.trim()}
            className="text-sm px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
          >
            {creationEnCours ? '...' : 'Créer le cabinet'}
          </button>
          {erreurCreation && <p className="text-red-400 text-sm">{erreurCreation}</p>}
          {resultatCreation && (
            <p className="text-sm text-accent bg-slate-950 border border-accent/40 rounded-lg p-3">
              {resultatCreation.emailEnvoye ? (
                <>✅ Cabinet créé — un email avec les identifiants a été envoyé automatiquement au client.</>
              ) : (
                <>
                  ✅ Cabinet créé, mais l&apos;email automatique n&apos;a pas pu être envoyé — transmets ces
                  identifiants toi-même (WhatsApp, en main propre...) :
                </>
              )}
              <br />
              Email : <strong>{resultatCreation.email}</strong> · Mot de passe temporaire :{' '}
              <strong>{resultatCreation.motDePasseTemporaire}</strong>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filtreRecherche}
            onChange={(e) => setFiltreRecherche(e.target.value)}
            placeholder="🔍 Rechercher un cabinet (nom, email)..."
            className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm min-w-[220px] flex-1"
          />
          <select
            value={filtreAbonnement}
            onChange={(e) => setFiltreAbonnement(e.target.value as typeof filtreAbonnement)}
            className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
          >
            <option value="tous">Tous les abonnements</option>
            <option value="payant">Payant</option>
            <option value="essai">Essai</option>
          </select>
          <select
            value={filtreAcces}
            onChange={(e) => setFiltreAcces(e.target.value as typeof filtreAcces)}
            className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
          >
            <option value="tous">Accès : tous</option>
            <option value="actif">Accès actif</option>
            <option value="inactif">Accès désactivé</option>
          </select>
          <select
            value={filtreVertical}
            onChange={(e) => setFiltreVertical(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
          >
            <option value="tous">Tous les secteurs</option>
            {VERTICALS_ADMIN.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            {clientsFiltres.length} / {clients.length} cabinet{clients.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              setErreursOuvert(!erreursOuvert)
              if (!erreursOuvert) chargerErreurs()
            }}
            className="text-xs px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400 ml-auto"
          >
            🐞 Erreurs récentes
          </button>
        </div>

        {erreursOuvert && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">🐞 Erreurs récentes (IA indisponible, extraction échouée...)</h3>
              <button onClick={chargerErreurs} className="text-xs text-accent">
                Rafraîchir
              </button>
            </div>
            {erreursChargement ? (
              <p className="text-xs text-slate-500">Chargement...</p>
            ) : erreursLogs.length === 0 ? (
              <p className="text-xs text-slate-500">Aucune erreur journalisée récemment.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {erreursLogs.map((e) => (
                  <div key={e.id} className="text-xs border-b border-slate-800 pb-2">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-mono">{e.route}</span>
                      <span>{new Date(e.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="text-red-400 mt-1 break-words">{e.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          {clientsFiltres.map((client) => {
            return (
              <div
                key={client.id}
                id={`client-${client.id}`}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors duration-1000 ${
                  clientMisEnEvidence === client.id
                    ? 'border-accent bg-accent/10'
                    : 'border-slate-700 bg-slate-900'
                }`}
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
                    <button
                      onClick={() =>
                        setGestionAccesOuverte(gestionAccesOuverte === client.id ? null : client.id)
                      }
                      className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 transition shrink-0"
                    >
                      ⚙️ Accès
                    </button>
                  </div>
                </div>

                {gestionAccesOuverte === client.id && (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1">
                        Cartes/secteurs autorisés (un ou plusieurs)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {VERTICALS_ADMIN.map((v) => {
                          const actuels =
                            client.verticals_autorises ??
                            (client.vertical_slug ? [client.vertical_slug] : [])
                          const coche = actuels.includes(v.slug)
                          return (
                            <label
                              key={v.slug}
                              className={`text-xs px-2 py-1 rounded-lg border cursor-pointer ${
                                coche
                                  ? 'border-accent bg-accent/10 text-accent'
                                  : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={coche}
                                onChange={() => basculerVerticalAutorise(client, v.slug)}
                                className="mr-1"
                              />
                              {v.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    {(() => {
                      const secteursCoches = (
                        client.verticals_autorises ?? (client.vertical_slug ? [client.vertical_slug] : [])
                      ).filter((slug) => SOUS_SECTEURS_PAR_VERTICAL[slug])
                      if (secteursCoches.length === 0) return null
                      return (
                        <div>
                          <p className="text-xs font-semibold text-slate-300 mb-1">
                            Sous-secteur précis (même liste qu'à l'inscription)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {secteursCoches.map((slug) => (
                              <select
                                key={slug}
                                value={
                                  SOUS_SECTEURS_PAR_VERTICAL[slug].includes(client.secteur_activite ?? '')
                                    ? client.secteur_activite ?? ''
                                    : ''
                                }
                                onChange={async (e) => {
                                  setMajEnCours(client.id)
                                  const { data: sessionData } = await supabase.auth.getSession()
                                  const token = sessionData.session?.access_token
                                  await fetch('/api/admin/clients', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({
                                      client_id: client.id,
                                      secteur_activite: e.target.value || null,
                                    }),
                                  })
                                  await charger()
                                  setMajEnCours(null)
                                }}
                                className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                              >
                                <option value="">
                                  — {VERTICALS_ADMIN.find((v) => v.slug === slug)?.label ?? slug} —
                                </option>
                                {SOUS_SECTEURS_PAR_VERTICAL[slug].map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1">
                        Onglets accessibles (décoche pour restreindre)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ONGLETS_ADMIN.map((o) => {
                          const actuels = client.onglets_autorises ?? ONGLETS_ADMIN.map((x) => x.id)
                          const coche = actuels.includes(o.id)
                          return (
                            <label
                              key={o.id}
                              className={`text-xs px-2 py-1 rounded-lg border cursor-pointer ${
                                coche
                                  ? 'border-accent bg-accent/10 text-accent'
                                  : 'border-slate-700 text-slate-500 line-through'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={coche}
                                onChange={() => basculerOngletAutorise(client, o.id)}
                                className="mr-1"
                              />
                              {o.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

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
