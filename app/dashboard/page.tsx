'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'
import { SECTEURS_DISPONIBLES } from '@/lib/secteurs'
import { professionsDisponibles, PROFILS_PARTICULIER } from '@/lib/professions'
import { traduire, type Langue } from '@/lib/i18n'
import { templatesPourVertical } from '@/lib/templates'
import { vocabulairePourVertical, etapesPipelinePourVertical } from '@/lib/vocabulaire'
import { zonePourPays, drapeauPays } from '@/lib/pays'
import ValidationItem from './validation-item'
import DropdownMultiSelect from './dropdown-multiselect'

type Client = {
  id: string
  nom_entreprise: string
  statut_abonnement: string
  mode_ciblage: 'entreprise' | 'particulier'
  secteur_activite: string | null
  taille_entreprise: string
  canal_sourcing: string
  profil_particulier: string | null
  message_personnalise: string | null
  logo_url: string | null
  langue_preferee: Langue
  imap_host?: string | null
  imap_port?: number | null
  imap_utilisateur?: string | null
  imap_secure?: boolean
  imap_actif?: boolean
  imap_derniere_sync_at?: string | null
  imap_derniere_erreur?: string | null
  acces_active?: boolean
  onboarding_complete?: boolean
  whatsapp_directeur?: string | null
  whatsapp_equipe?: string[]
  facebook_url?: string | null
  instagram_url?: string | null
  linkedin_url?: string | null
  site_web?: string | null
  onglets_masques_equipe?: string[]
}

type Target = {
  id: string
  nom: string
  entreprise_ou_objectif: string | null
  poste_ou_budget: string | null
  telephone: string | null
  email: string | null
  country: string | null
  statut: string
  etape_pipeline: string
  segment_categorie?: string | null
  segment_urgence?: string | null
  score_chaleur?: number | null
  nb_relances?: number
  derniere_relance_at?: string | null
  created_at?: string
  assigne_a?: string | null
  signal_ia?: string | null
  reponse_sentiment?: 'positive' | 'negative' | 'neutre' | null
  reponse_a_traiter?: boolean
}

type DiagnosticEnAttente = {
  id: string
  token_acces: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: any
  recommandations_json: any
  lien_ouvert_at: string | null
  targets: { nom: string } | { nom: string }[] | null
}

type DiagnosticValide = {
  id: string
  token_acces: string
  created_at: string
  target_id: string
  recommandations_json: any
  targets: { nom: string } | { nom: string }[] | null
}

type OffreCatalogue = {
  id: string
  nom: string
  description: string | null
  prix: number | null
  devise: string | null
  duree: string | null
  public_cible: string | null
  pdf_url: string | null
  mode_facturation: string | null
}

type CalendrierEntree = {
  id: string
  titre: string
  description: string | null
  date_evenement: string
  type: 'rdv' | 'evenement' | 'appel_offre' | 'autre'
  lien: string | null
}

type NoteCible = {
  id: string
  target_id: string
  contenu: string
  created_at: string
  auteur_id: string | null
}

type MessageRecu = {
  id: string
  target_id: string | null
  canal: 'whatsapp' | 'email'
  contenu: string
  expediteur: string | null
  lu: boolean
  created_at: string
  targets: { nom: string } | { nom: string }[] | null
}

type StatsPerformance = {
  nbMessagesEnvoyes: number
  nbReponses: number
  nbDiagnosticsValides: number
  nbPacksAcceptes: number
}

type PackVendu = {
  id: string
  pack_propose_nom: string | null
  prix_pack: number | null
  statut_vente: string
  diagnostics?: { target_id: string } | { target_id: string }[] | null
}

type Onglet = 'ciblage' | 'cibles' | 'validation' | 'inbox' | 'pipeline' | 'catalogue_strategie' | 'collaboration' | 'equipe' | 'calendrier' | 'stats'

export default function DashboardPage() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [estHybride, setEstHybride] = useState(false)
  const [verticalSlug, setVerticalSlug] = useState('')
  const [paysSelectionnes, setPaysSelectionnes] = useState<Set<string>>(new Set())
  const [professionsSelectionnees, setProfessionsSelectionnees] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Target[]>([])
  const [diagnosticsEnAttente, setDiagnosticsEnAttente] = useState<DiagnosticEnAttente[]>([])
  const [messagesRecus, setMessagesRecus] = useState<MessageRecu[]>([])
  const [catalogue, setCatalogue] = useState<OffreCatalogue[]>([])
  const [calendrier, setCalendrier] = useState<CalendrierEntree[]>([])
  const [notesCibles, setNotesCibles] = useState<Record<string, NoteCible[]>>({})
  const [cibleNotesOuverte, setCibleNotesOuverte] = useState<string | null>(null)
  const [carteEnCoursDeGlissement, setCarteEnCoursDeGlissement] = useState<string | null>(null)
  const [imapForm, setImapForm] = useState({
    imap_host: '',
    imap_port: 993,
    imap_utilisateur: '',
    imap_mot_de_passe: '',
    imap_secure: true,
    imap_actif: false,
  })
  const [imapEnregistrement, setImapEnregistrement] = useState(false)
  const [imapMessage, setImapMessage] = useState<string | null>(null)
  const [onboardingForm, setOnboardingForm] = useState({
    whatsapp_directeur: '',
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
    site_web: '',
  })
  const [onboardingMembres, setOnboardingMembres] = useState([
    { email: '', nom_complet: '', role: 'membre' as 'membre' | 'directeur_commercial' },
  ])
  const [onboardingEnCours, setOnboardingEnCours] = useState(false)
  const [nouveauNumeroWhatsapp, setNouveauNumeroWhatsapp] = useState('')
  const [sousOngletStrategie, setSousOngletStrategie] = useState<
    'donnees' | 'commercial' | 'marketing'
  >('donnees')
  const [sousOngletGroupe, setSousOngletGroupe] = useState<'catalogue' | 'strategie' | 'idees'>(
    'catalogue'
  )
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null)
  const [filtrePaysStats, setFiltrePaysStats] = useState<'tous' | 'tunisie' | 'golfe' | 'reste'>(
    'tous'
  )
  const [nouvelleNoteTexte, setNouvelleNoteTexte] = useState('')
  const [moisAffiche, setMoisAffiche] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [nouvelleEntree, setNouvelleEntree] = useState({
    titre: '',
    description: '',
    date_evenement: '',
    type: 'rdv' as CalendrierEntree['type'],
    lien: '',
  })
  const [nouvelleOffre, setNouvelleOffre] = useState({
    nom: '',
    description: '',
    prix: '',
    devise: 'TND',
    duree: '',
    public_cible: '',
    mode_facturation: '',
  })
  const [pdfUrlTemp, setPdfUrlTemp] = useState<string | null>(null)
  const [pdfEnCours, setPdfEnCours] = useState(false)
  const inputPdfCatalogue = useRef<HTMLInputElement>(null)
  const [strategieEnCours, setStrategieEnCours] = useState(false)
  const [strategieResultat, setStrategieResultat] = useState<{
    recommandationCommerciale: string
    recommandationMarketing: string | null
    parCanal: { canal: string; total: number; gagnes: number; taux: number }[]
    parSegment: { canal: string; total: number; gagnes: number; taux: number }[]
    parThemeMarketing: { canal: string; total: number }[]
    historique: {
      id: string
      recommandation_commerciale: string | null
      recommandation_marketing: string | null
      created_at: string
    }[]
  } | null>(null)
  const [reponseTexte, setReponseTexte] = useState<Record<string, string>>({})
  const [envoiReponseEnCours, setEnvoiReponseEnCours] = useState<string | null>(null)
  const [diagnosticsValides, setDiagnosticsValides] = useState<DiagnosticValide[]>([])
  const [messageLinkedin, setMessageLinkedin] = useState<string | null>(null)
  const [estAdmin, setEstAdmin] = useState(false)
  const [monClientUserId, setMonClientUserId] = useState<string | null>(null)
  const [monRole, setMonRole] = useState<string | null>(null)
  const [filtreAssignation, setFiltreAssignation] = useState<'toutes' | 'mes-cibles'>('toutes')
  const [statsPerformance, setStatsPerformance] = useState<StatsPerformance>({
    nbMessagesEnvoyes: 0,
    nbReponses: 0,
    nbDiagnosticsValides: 0,
    nbPacksAcceptes: 0,
  })
  const [packsVendus, setPacksVendus] = useState<PackVendu[]>([])
  const [chargement, setChargement] = useState(true)
  const [maj, setMaj] = useState(false)
  const [secteurInput, setSecteurInput] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null)
  const [lancementEnCours, setLancementEnCours] = useState(false)
  const [lancementResultat, setLancementResultat] = useState<Record<string, unknown>[] | null>(
    null
  )
  const [messageInput, setMessageInput] = useState('')
  const [logoInput, setLogoInput] = useState('')
  const [ciblesSelectionnees, setCiblesSelectionnees] = useState<Set<string>>(new Set())
  const [envoiMasseEnCours, setEnvoiMasseEnCours] = useState(false)
  const [membresEquipe, setMembresEquipe] = useState<
    { id: string; nom_complet: string | null; role: string }[]
  >([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNom, setInviteNom] = useState('')
  const [inviteRole, setInviteRole] = useState<'membre' | 'directeur_commercial'>('membre')
  const [inviteEnCours, setInviteEnCours] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [ongletActif, setOngletActif] = useState<Onglet>('ciblage')

  const [messagesEquipe, setMessagesEquipe] = useState<
    { id: string; contenu: string; created_at: string; auteur_id: string | null; client_users: { nom_complet: string | null } | null }[]
  >([])
  const [nouveauMessageEquipe, setNouveauMessageEquipe] = useState('')
  const [envoiMessageEquipeEnCours, setEnvoiMessageEquipeEnCours] = useState(false)
  const [taches, setTaches] = useState<
    {
      id: string
      titre: string
      description: string | null
      statut: 'a_faire' | 'en_cours' | 'terminee'
      echeance: string | null
      assigne_a: string | null
      membre: { nom_complet: string | null } | null
    }[]
  >([])
  const [nouvelleTache, setNouvelleTache] = useState({ titre: '', description: '', assigne_a: '', echeance: '' })
  const [creationTacheEnCours, setCreationTacheEnCours] = useState(false)
  const [collaborationChargee, setCollaborationChargee] = useState(false)

  const [nouvelleCible, setNouvelleCible] = useState({
    nom: '',
    entreprise_ou_objectif: '',
    poste_ou_budget: '',
    telephone: '',
    email: '',
    country: 'TN',
  })
  const inputFichierCSV = useRef<HTMLInputElement>(null)
  const [importCSVEnCours, setImportCSVEnCours] = useState(false)
  const [messageImportCSV, setMessageImportCSV] = useState<string | null>(null)

  const langue: Langue = client?.langue_preferee ?? 'fr'
  const t = (cle: string) => traduire(langue, cle)
  // Le proprietaire et le directeur commercial voient/gerent toute l'equipe ;
  // un simple commercial ("membre") ne voit que son propre suivi.
  const peutSuperviser = monRole === 'proprietaire' || monRole === 'admin' || monRole === 'directeur_commercial'

  const chargerTout = async (clientId: string) => {
    const { data: paysData } = await supabase
      .from('client_countries')
      .select('country_code')
      .eq('client_id', clientId)
    setPaysSelectionnes(new Set((paysData ?? []).map((p) => p.country_code)))

    const { data: professionsData } = await supabase
      .from('client_professions')
      .select('profession')
      .eq('client_id', clientId)
    setProfessionsSelectionnees(new Set((professionsData ?? []).map((p) => p.profession)))

    const { data: targetsData } = await supabase
      .from('targets')
      .select(
        'id, nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, statut, etape_pipeline, segment_categorie, segment_urgence, score_chaleur, nb_relances, derniere_relance_at, created_at, assigne_a, signal_ia, reponse_sentiment, reponse_a_traiter'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setTargets(targetsData ?? [])

    const { data: diagData } = await supabase
      .from('diagnostics')
      .select(
        'id, token_acces, phrase_brute_prospect, json_ia_brouillon, recommandations_json, lien_ouvert_at, targets(nom)'
      )
      .eq('client_id', clientId)
      .eq('statut_validation', 'en_attente_validation')
      .order('created_at', { ascending: false })
    setDiagnosticsEnAttente((diagData ?? []) as unknown as DiagnosticEnAttente[])

    const { data: diagValidesData } = await supabase
      .from('diagnostics')
      .select('id, token_acces, created_at, target_id, recommandations_json, targets(nom)')
      .eq('client_id', clientId)
      .eq('statut_validation', 'valide_par_expert')
      .order('created_at', { ascending: false })
      .limit(50)
    setDiagnosticsValides((diagValidesData ?? []) as unknown as DiagnosticValide[])

    const { data: messagesRecusData } = await supabase
      .from('messages_recus')
      .select('id, target_id, canal, contenu, expediteur, lu, created_at, targets(nom)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100)
    setMessagesRecus((messagesRecusData ?? []) as unknown as MessageRecu[])

    const { data: catalogueData } = await supabase
      .from('catalogue_offres')
      .select('id, nom, description, prix, devise, duree, public_cible, pdf_url, mode_facturation')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setCatalogue((catalogueData ?? []) as OffreCatalogue[])

    const { data: calendrierData } = await supabase
      .from('calendrier_entrees')
      .select('id, titre, description, date_evenement, type, lien')
      .eq('client_id', clientId)
      .order('date_evenement', { ascending: true })
    setCalendrier((calendrierData ?? []) as CalendrierEntree[])

    const { data: notesData } = await supabase
      .from('notes_cibles')
      .select('id, target_id, contenu, created_at, auteur_id')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    const notesParCible: Record<string, NoteCible[]> = {}
    for (const n of notesData ?? []) {
      if (!notesParCible[n.target_id]) notesParCible[n.target_id] = []
      notesParCible[n.target_id].push(n as NoteCible)
    }
    setNotesCibles(notesParCible)

    const { data: packsData } = await supabase
      .from('leads_packs')
      .select('id, pack_propose_nom, prix_pack, statut_vente, diagnostics!inner(client_id, target_id)')
      .eq('diagnostics.client_id', clientId)
      .eq('statut_vente', 'accepte')
    setPacksVendus((packsData ?? []) as unknown as PackVendu[])

    const { data: membresData } = await supabase
      .from('client_users')
      .select('id, nom_complet, role')
      .eq('client_id', clientId)
    setMembresEquipe(membresData ?? [])

    // Statistiques de performance : taux de reponse et de conversion
    const { count: nbMessagesEnvoyes } = await supabase
      .from('outreach_campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)

    const { count: nbReponses } = await supabase
      .from('diagnostics')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .not('phrase_brute_prospect', 'is', null)

    const { count: nbDiagnosticsValides } = await supabase
      .from('diagnostics')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('statut_validation', 'valide_par_expert')

    const { count: nbPacksAcceptes } = await supabase
      .from('leads_packs')
      .select('*, diagnostics!inner(client_id)', { count: 'exact', head: true })
      .eq('diagnostics.client_id', clientId)
      .eq('statut_vente', 'accepte')

    setStatsPerformance({
      nbMessagesEnvoyes: nbMessagesEnvoyes ?? 0,
      nbReponses: nbReponses ?? 0,
      nbDiagnosticsValides: nbDiagnosticsValides ?? 0,
      nbPacksAcceptes: nbPacksAcceptes ?? 0,
    })
  }

  useEffect(() => {
    const charger = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/auth')
        return
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (accessToken) {
        try {
          const res = await fetch('/api/admin/whoami', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const data = await res.json()
          setEstAdmin(Boolean(data.estAdmin))
        } catch {
          setEstAdmin(false)
        }
      }

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('id, client_id, role')
        .eq('auth_user_id', userData.user.id)
        .single()

      if (!clientUser) {
        setChargement(false)
        return
      }
      setMonClientUserId(clientUser.id)
      setMonRole(clientUser.role ?? 'membre')

      const { data: clientData } = await supabase
        .from('clients')
        .select(
          'id, nom_entreprise, statut_abonnement, mode_ciblage, secteur_activite, taille_entreprise, canal_sourcing, profil_particulier, message_personnalise, logo_url, langue_preferee, imap_host, imap_port, imap_utilisateur, imap_secure, imap_actif, imap_derniere_sync_at, imap_derniere_erreur, acces_active, onboarding_complete, whatsapp_directeur, whatsapp_equipe, facebook_url, instagram_url, linkedin_url, site_web, onglets_masques_equipe, verticals(slug)'
        )
        .eq('id', clientUser.client_id)
        .single()

      if (clientData) {
        setClient(clientData as unknown as Client)
        setSecteurInput((clientData as unknown as Client).secteur_activite ?? '')
        setMessageInput((clientData as unknown as Client).message_personnalise ?? '')
        setLogoInput((clientData as unknown as Client).logo_url ?? '')
        setImapForm((prev) => ({
          ...prev,
          imap_host: (clientData as unknown as Client).imap_host ?? '',
          imap_port: (clientData as unknown as Client).imap_port ?? 993,
          imap_utilisateur: (clientData as unknown as Client).imap_utilisateur ?? '',
          imap_secure: (clientData as unknown as Client).imap_secure ?? true,
          imap_actif: (clientData as unknown as Client).imap_actif ?? false,
        }))
        // @ts-ignore - jointure Supabase typee dynamiquement
        const slug = clientData.verticals?.slug as string
        setVerticalSlug(slug ?? '')
        setEstHybride(slug === 'cabinet-formation')
        await chargerTout(clientData.id)
      }
      setChargement(false)
    }

    charger()
  }, [router])

  const togglePays = async (code: string) => {
    if (!client) return
    setMaj(true)
    const dejaSelectionne = paysSelectionnes.has(code)

    if (dejaSelectionne) {
      await supabase
        .from('client_countries')
        .delete()
        .eq('client_id', client.id)
        .eq('country_code', code)
    } else {
      await supabase.from('client_countries').insert({ client_id: client.id, country_code: code })
    }

    const nouveaux = new Set(paysSelectionnes)
    dejaSelectionne ? nouveaux.delete(code) : nouveaux.add(code)
    setPaysSelectionnes(nouveaux)
    setMaj(false)
  }

  const changerModeCiblage = async (mode: 'entreprise' | 'particulier') => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ mode_ciblage: mode }).eq('id', client.id)
    setClient({ ...client, mode_ciblage: mode })
    setMaj(false)
  }

  const changerSecteur = async (secteur: string) => {
    if (!client) return
    setMaj(true)
    setSecteurInput(secteur)
    await supabase
      .from('clients')
      .update({ secteur_activite: secteur || null })
      .eq('id', client.id)
    setClient({ ...client, secteur_activite: secteur || null })
    setMaj(false)
  }

  const changerTailleEntreprise = async (taille: string) => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ taille_entreprise: taille }).eq('id', client.id)
    setClient({ ...client, taille_entreprise: taille })
    setMaj(false)
  }

  const toggleProfession = async (profession: string) => {
    if (!client) return
    setMaj(true)
    const dejaSelectionnee = professionsSelectionnees.has(profession)

    if (dejaSelectionnee) {
      await supabase
        .from('client_professions')
        .delete()
        .eq('client_id', client.id)
        .eq('profession', profession)
    } else {
      await supabase.from('client_professions').insert({ client_id: client.id, profession })
    }

    const nouvelles = new Set(professionsSelectionnees)
    dejaSelectionnee ? nouvelles.delete(profession) : nouvelles.add(profession)
    setProfessionsSelectionnees(nouvelles)
    setMaj(false)
  }

  const changerCanalSourcing = async (canal: string) => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ canal_sourcing: canal }).eq('id', client.id)
    setClient({ ...client, canal_sourcing: canal })
    setMaj(false)
  }

  const changerProfilParticulier = async (profil: string) => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ profil_particulier: profil }).eq('id', client.id)
    setClient({ ...client, profil_particulier: profil })
    setMaj(false)
  }

  const changerLangue = async (nouvelleLangue: Langue) => {
    if (!client) return
    setClient({ ...client, langue_preferee: nouvelleLangue })
    await supabase.from('clients').update({ langue_preferee: nouvelleLangue }).eq('id', client.id)
  }

  const lancerRecherche = async () => {
    if (!client) return
    setLancementEnCours(true)
    setLancementResultat(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/sourcing/lancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (!res.ok) {
        setLancementResultat([{ erreur: data.error ?? 'Erreur lors du lancement' }])
      } else {
        setLancementResultat(data.resultats)
        await chargerTout(client.id)
      }
    } catch {
      setLancementResultat([{ erreur: 'Impossible de contacter le serveur' }])
    }
    setLancementEnCours(false)
  }

  const enregistrerMessage = async (valeurOverride?: string) => {
    if (!client) return
    const valeur = valeurOverride ?? messageInput
    setMaj(true)
    await supabase
      .from('clients')
      .update({ message_personnalise: valeur.trim() || null })
      .eq('id', client.id)
    setClient({ ...client, message_personnalise: valeur.trim() || null })
    setMaj(false)
  }

  const enregistrerLogo = async () => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ logo_url: logoInput.trim() || null }).eq('id', client.id)
    setClient({ ...client, logo_url: logoInput.trim() || null })
    setMaj(false)
  }


  const ajouterCible = async () => {
    if (!client || !nouvelleCible.nom.trim()) return
    setMaj(true)

    await supabase.from('targets').insert({
      client_id: client.id,
      nom: nouvelleCible.nom,
      entreprise_ou_objectif: nouvelleCible.entreprise_ou_objectif || null,
      poste_ou_budget: nouvelleCible.poste_ou_budget || null,
      telephone: nouvelleCible.telephone || null,
      email: nouvelleCible.email || null,
      country: nouvelleCible.country,
      statut: 'nouveau',
    })

    setNouvelleCible({
      nom: '',
      entreprise_ou_objectif: '',
      poste_ou_budget: '',
      telephone: '',
      email: '',
      country: 'TN',
    })
    await chargerTout(client.id)
    setMaj(false)
  }

  // Parseur CSV minimal : gere les guillemets et les virgules a l'interieur
  // des champs. Suffisant pour des exports simples (Excel, Google Sheets).
  // Genere la grille du mois (semaines de lundi a dimanche) pour l'affichage
  // calendrier, avec les jours des mois adjacents grises pour completer la grille.
  const genererGrilleMois = (mois: Date) => {
    const annee = mois.getFullYear()
    const moisIndex = mois.getMonth()
    const premierJour = new Date(annee, moisIndex, 1)
    // 0=dimanche -> on veut lundi en premiere colonne
    const decalage = (premierJour.getDay() + 6) % 7
    const debutGrille = new Date(annee, moisIndex, 1 - decalage)

    const jours: { date: Date; dansLeMois: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(debutGrille)
      d.setDate(debutGrille.getDate() + i)
      jours.push({ date: d, dansLeMois: d.getMonth() === moisIndex })
    }
    return jours
  }

  const formatDateLocale = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const j = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${j}`
  }

  const parserCSV = (texte: string): Record<string, string>[] => {
    const lignes = texte.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lignes.length < 2) return []

    const parserLigne = (ligne: string): string[] => {
      const champs: string[] = []
      let champActuel = ''
      let dansGuillemets = false
      for (let i = 0; i < ligne.length; i++) {
        const car = ligne[i]
        if (car === '"') {
          dansGuillemets = !dansGuillemets
        } else if (car === ',' && !dansGuillemets) {
          champs.push(champActuel.trim())
          champActuel = ''
        } else {
          champActuel += car
        }
      }
      champs.push(champActuel.trim())
      return champs
    }

    const entetes = parserLigne(lignes[0]).map((e) =>
      e.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    )

    return lignes.slice(1).map((ligne) => {
      const valeurs = parserLigne(ligne)
      const objet: Record<string, string> = {}
      entetes.forEach((entete, i) => {
        objet[entete] = valeurs[i] ?? ''
      })
      return objet
    })
  }

  const importerCibles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier || !client) return

    setImportCSVEnCours(true)
    setMessageImportCSV(null)

    try {
      const texte = await fichier.text()
      const lignes = parserCSV(texte)

      const contacts = lignes.map((l) => ({
        nom: l.nom || l.name || '',
        telephone: l.telephone || l.tel || l.phone || l.numero || '',
        email: l.email || l.mail || '',
        entreprise: l.entreprise || l.company || l.societe || l.objectif || '',
        pays: l.pays || l.country || '',
        canal: l.canal || l.source || '',
        resultat: l.resultat || l.result || l.statut_historique || '',
      }))

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/cibles/importer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contacts }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessageImportCSV(`❌ ${data.error ?? "Erreur lors de l'import"}`)
      } else {
        setMessageImportCSV(
          `✅ ${data.nombre_ajoute} cible(s) ajoutée(s)` +
            (data.doublons_ignores > 0 ? ` · ${data.doublons_ignores} doublon(s) ignoré(s)` : '') +
            (data.sans_nom_ignores > 0 ? ` · ${data.sans_nom_ignores} ligne(s) sans nom ignorée(s)` : '')
        )
        await chargerTout(client.id)
      }
    } catch {
      setMessageImportCSV('❌ Impossible de lire ce fichier')
    }

    setImportCSVEnCours(false)
    if (inputFichierCSV.current) inputFichierCSV.current.value = ''
  }

  const enregistrerConfigImap = async () => {
    setImapEnregistrement(true)
    setImapMessage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/parametres/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(imapForm),
      })
      const data = await res.json()

      if (!res.ok) {
        setImapMessage(`❌ ${data.error ?? 'Erreur lors de la sauvegarde'}`)
      } else {
        setImapMessage('✅ Configuration enregistrée')
        // On vide le champ mot de passe une fois envoye, il ne sera plus jamais rechargé.
        setImapForm((prev) => ({ ...prev, imap_mot_de_passe: '' }))
      }
    } catch {
      setImapMessage('❌ Erreur réseau')
    } finally {
      setImapEnregistrement(false)
    }
  }

  const chargerCollaboration = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const headers = { Authorization: `Bearer ${token}` }

    const [resMessages, resTaches] = await Promise.all([
      fetch('/api/collaboration/messages', { headers }),
      fetch('/api/collaboration/taches', { headers }),
    ])
    const [dataMessages, dataTaches] = await Promise.all([resMessages.json(), resTaches.json()])

    if (resMessages.ok) setMessagesEquipe(dataMessages.messages ?? [])
    if (resTaches.ok) setTaches(dataTaches.taches ?? [])
    setCollaborationChargee(true)
  }

  const envoyerMessageEquipe = async () => {
    if (!nouveauMessageEquipe.trim()) return
    setEnvoiMessageEquipeEnCours(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/collaboration/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contenu: nouveauMessageEquipe }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessagesEquipe((prev) => [...prev, data.message])
        setNouveauMessageEquipe('')
      }
    } finally {
      setEnvoiMessageEquipeEnCours(false)
    }
  }

  const creerTache = async () => {
    if (!nouvelleTache.titre.trim()) return
    setCreationTacheEnCours(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/collaboration/taches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(nouvelleTache),
      })
      const data = await res.json()
      if (res.ok) {
        setTaches((prev) => [data.tache, ...prev])
        setNouvelleTache({ titre: '', description: '', assigne_a: '', echeance: '' })
      }
    } finally {
      setCreationTacheEnCours(false)
    }
  }

  const majTache = async (id: string, changements: { statut?: string; assigne_a?: string | null }) => {
    setTaches((prev) => prev.map((t) => (t.id === id ? { ...t, ...changements } as typeof t : t)))
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/collaboration/taches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...changements }),
    })
  }

  useEffect(() => {
    if (ongletActif === 'collaboration' && !collaborationChargee) {
      chargerCollaboration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongletActif])

  const ajouterWhatsappEquipe = async (numero: string) => {
    if (!client || !numero.trim()) return
    const nouveaux = [...(client.whatsapp_equipe ?? []), numero.trim()]
    await supabase.from('clients').update({ whatsapp_equipe: nouveaux }).eq('id', client.id)
    setClient({ ...client, whatsapp_equipe: nouveaux })
  }

  const retirerWhatsappEquipe = async (numero: string) => {
    if (!client) return
    const nouveaux = (client.whatsapp_equipe ?? []).filter((n) => n !== numero)
    await supabase.from('clients').update({ whatsapp_equipe: nouveaux }).eq('id', client.id)
    setClient({ ...client, whatsapp_equipe: nouveaux })
  }

  const basculerOngletMasque = async (ongletId: string) => {
    if (!client) return
    const actuel = client.onglets_masques_equipe ?? []
    const nouveau = actuel.includes(ongletId)
      ? actuel.filter((id) => id !== ongletId)
      : [...actuel, ongletId]

    await supabase.from('clients').update({ onglets_masques_equipe: nouveau }).eq('id', client.id)
    setClient({ ...client, onglets_masques_equipe: nouveau })
  }

  const soumettreOnboarding = async () => {
    if (!client) return
    setOnboardingEnCours(true)

    try {
      // 1. Reseaux et canaux de l'entreprise (RLS deja en place, meme pattern
      // que les autres champs client comme taille_entreprise plus haut).
      await supabase
        .from('clients')
        .update({
          whatsapp_directeur: onboardingForm.whatsapp_directeur.trim() || null,
          facebook_url: onboardingForm.facebook_url.trim() || null,
          instagram_url: onboardingForm.instagram_url.trim() || null,
          linkedin_url: onboardingForm.linkedin_url.trim() || null,
          site_web: onboardingForm.site_web.trim() || null,
          onboarding_complete: true,
        })
        .eq('id', client.id)

      // 2. Invitation de chaque membre d'equipe renseigne (meme route que
      // l'invitation classique, reutilisee ici pour tout faire en une fois).
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      for (const membre of onboardingMembres) {
        if (!membre.email.trim()) continue
        await fetch('/api/team/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: membre.email,
            nom_complet: membre.nom_complet,
            role: membre.role,
          }),
        })
      }

      setClient({ ...client, ...onboardingForm, onboarding_complete: true })
      await chargerTout(client.id)
    } finally {
      setOnboardingEnCours(false)
    }
  }

  const changerEtapePipeline = async (targetId: string, etape: string) => {
    await supabase.from('targets').update({ etape_pipeline: etape }).eq('id', targetId)
    setTargets((prev) =>
      prev.map((tg) => (tg.id === targetId ? { ...tg, etape_pipeline: etape } : tg))
    )
  }

  const ajouterNote = async (targetId: string) => {
    if (!client || !nouvelleNoteTexte.trim()) return
    const { data } = await supabase
      .from('notes_cibles')
      .insert({
        target_id: targetId,
        client_id: client.id,
        auteur_id: monClientUserId,
        contenu: nouvelleNoteTexte.trim(),
      })
      .select('id, target_id, contenu, created_at, auteur_id')
      .single()
    if (data) {
      setNotesCibles((prev) => ({
        ...prev,
        [targetId]: [data as NoteCible, ...(prev[targetId] ?? [])],
      }))
    }
    setNouvelleNoteTexte('')
  }

  const supprimerNote = async (targetId: string, noteId: string) => {
    await supabase.from('notes_cibles').delete().eq('id', noteId)
    setNotesCibles((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] ?? []).filter((n) => n.id !== noteId),
    }))
  }

  const assignerCible = async (targetId: string, clientUserId: string | null) => {
    await supabase.from('targets').update({ assigne_a: clientUserId }).eq('id', targetId)
    setTargets((prev) =>
      prev.map((tg) => (tg.id === targetId ? { ...tg, assigne_a: clientUserId } : tg))
    )
  }

  const envoyerVersTarget = async (targetId: string, typeEnvoi: 'diagnostic' | 'message') => {
    if (!client) return
    setEnvoiEnCours(targetId)

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, type_envoi: typeEnvoi }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error ?? "Erreur lors de l'envoi")
      await chargerTout(client.id)
    } catch {
      alert('Impossible de contacter le serveur')
    }
    setEnvoiEnCours(null)
  }

  const envoyerDiagnostic = (targetId: string) => envoyerVersTarget(targetId, 'diagnostic')
  const envoyerMessage = (targetId: string) => envoyerVersTarget(targetId, 'message')

  const preparerLinkedin = async (targetId: string) => {
    if (!client) return
    setEnvoiEnCours(targetId)

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, type_envoi: 'diagnostic', canal_force: 'linkedin' }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Erreur lors de la préparation du message')
      } else {
        setMessageLinkedin(data.message)
        await chargerTout(client.id)
      }
    } catch {
      alert('Impossible de contacter le serveur')
    }
    setEnvoiEnCours(null)
  }

  const toggleCibleSelectionnee = (targetId: string) => {
    const nouvelles = new Set(ciblesSelectionnees)
    nouvelles.has(targetId) ? nouvelles.delete(targetId) : nouvelles.add(targetId)
    setCiblesSelectionnees(nouvelles)
  }

  const toggleTouteSelection = () => {
    const ciblesEnvoyables = targets.filter((t) => t.statut === 'nouveau').map((t) => t.id)
    const toutesDejaSelectionnees =
      ciblesEnvoyables.length > 0 && ciblesEnvoyables.every((id) => ciblesSelectionnees.has(id))
    setCiblesSelectionnees(toutesDejaSelectionnees ? new Set() : new Set(ciblesEnvoyables))
  }

  const envoyerAuxSelectionnes = async (typeEnvoi: 'diagnostic' | 'message' = 'diagnostic') => {
    if (!client || ciblesSelectionnees.size === 0) return
    setEnvoiMasseEnCours(true)

    for (const targetId of ciblesSelectionnees) {
      try {
        await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId, type_envoi: typeEnvoi }),
        })
      } catch {
        // on continue meme si un envoi echoue, pour ne pas bloquer les autres
      }
    }

    setCiblesSelectionnees(new Set())
    await chargerTout(client.id)
    setEnvoiMasseEnCours(false)
  }

  const inviterMembre = async () => {
    if (!client || !inviteEmail.trim()) return
    setInviteEnCours(true)
    setInviteMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail, nom_complet: inviteNom, role: inviteRole }),
      })
      const data = await res.json()

      if (!res.ok) {
        setInviteMessage(`❌ ${data.error ?? "Erreur lors de l'invitation"}`)
      } else {
        setInviteMessage(
          `✅ Compte créé pour ${inviteEmail} — mot de passe temporaire : ${data.motDePasseTemporaire} (transmets-le toi-même, il n'y a pas d'email envoyé)`
        )
        setInviteEmail('')
        setInviteNom('')
        setInviteRole('membre')
        await chargerTout(client.id)
      }
    } catch {
      setInviteMessage('❌ Impossible de contacter le serveur')
    }
    setInviteEnCours(false)
  }

  const supprimerMembre = async (clientUserId: string, nom: string | null) => {
    const confirme = window.confirm(
      `Retirer ${nom || 'ce membre'} de l'équipe ? Il ne pourra plus se connecter. Ses cibles assignées repasseront à "non assigné".`
    )
    if (!confirme || !client) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/team/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_user_id: clientUserId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setInviteMessage(`❌ ${data.error ?? 'Erreur lors de la suppression'}`)
      } else {
        setInviteMessage(`✅ ${nom || 'Le membre'} a été retiré de l'équipe`)
        await chargerTout(client.id)
      }
    } catch {
      setInviteMessage('❌ Impossible de contacter le serveur')
    }
  }

  const marquerCommeLu = async (messageId: string) => {
    await supabase.from('messages_recus').update({ lu: true }).eq('id', messageId)
    setMessagesRecus((prev) => prev.map((m) => (m.id === messageId ? { ...m, lu: true } : m)))
  }

  const repondreMessage = async (messageId: string, targetId: string, canal: 'whatsapp' | 'email') => {
    const message = reponseTexte[messageId]?.trim()
    if (!message) return

    setEnvoiReponseEnCours(messageId)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/inbox/repondre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_id: targetId, canal, message }),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error ?? "Échec de l'envoi")
      } else {
        setReponseTexte((prev) => ({ ...prev, [messageId]: '' }))
        await marquerCommeLu(messageId)
      }
    } catch {
      alert('Impossible de contacter le serveur')
    }
    setEnvoiReponseEnCours(null)
  }

  const genererStrategie = async () => {
    setStrategieEnCours(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/strategie/generer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setStrategieResultat(data)
    } catch {
      // best-effort, pas critique
    }
    setStrategieEnCours(false)
  }

  const importerPdfOffre = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier || !client) return

    setPdfEnCours(true)
    try {
      // 1. Upload dans Supabase Storage
      const chemin = `${client.id}/${Date.now()}-${fichier.name}`
      const { error: uploadError } = await supabase.storage
        .from('catalogue-pdfs')
        .upload(chemin, fichier)

      if (uploadError) {
        alert("Échec de l'upload du PDF")
        setPdfEnCours(false)
        return
      }

      const { data: urlData } = supabase.storage.from('catalogue-pdfs').getPublicUrl(chemin)
      setPdfUrlTemp(urlData.publicUrl)

      // 2. Extraction IA pour pré-remplir le formulaire
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(fichier)
      })

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/catalogue/extraire-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pdf_base64: base64 }),
      })
      const data = await res.json()

      if (res.ok && data.champs) {
        setNouvelleOffre({
          nom: data.champs.nom ?? '',
          description: data.champs.description ?? '',
          prix: data.champs.prix ? String(data.champs.prix) : '',
          devise: 'TND',
          duree: data.champs.duree ?? '',
          public_cible: data.champs.public_cible ?? '',
          mode_facturation: '',
        })
      } else {
        alert(
          "PDF importé mais pré-remplissage impossible (" +
            (data.error ?? 'erreur inconnue') +
            ') — remplis le formulaire manuellement, le PDF reste attaché.'
        )
      }
    } catch {
      alert("Erreur lors de l'import du PDF")
    }
    setPdfEnCours(false)
    if (inputPdfCatalogue.current) inputPdfCatalogue.current.value = ''
  }

  const ajouterOffre = async () => {
    if (!client || !nouvelleOffre.nom.trim()) return
    setMaj(true)
    const { data } = await supabase
      .from('catalogue_offres')
      .insert({
        client_id: client.id,
        nom: nouvelleOffre.nom.trim(),
        description: nouvelleOffre.description.trim() || null,
        prix: nouvelleOffre.prix ? Number(nouvelleOffre.prix) : null,
        devise: nouvelleOffre.devise,
        duree: nouvelleOffre.duree.trim() || null,
        public_cible: nouvelleOffre.public_cible.trim() || null,
        mode_facturation: nouvelleOffre.mode_facturation || null,
        pdf_url: pdfUrlTemp,
      })
      .select('id, nom, description, prix, devise, duree, public_cible, pdf_url, mode_facturation')
      .single()
    if (data) setCatalogue((prev) => [data as OffreCatalogue, ...prev])
    setNouvelleOffre({
      nom: '',
      description: '',
      prix: '',
      devise: 'TND',
      duree: '',
      public_cible: '',
      mode_facturation: '',
    })
    setPdfUrlTemp(null)
    setMaj(false)
  }

  const supprimerOffre = async (id: string) => {
    await supabase.from('catalogue_offres').delete().eq('id', id)
    setCatalogue((prev) => prev.filter((o) => o.id !== id))
  }

  const ajouterEntreeCalendrier = async () => {
    if (!client || !nouvelleEntree.titre.trim() || !nouvelleEntree.date_evenement) return
    setMaj(true)
    const { data } = await supabase
      .from('calendrier_entrees')
      .insert({
        client_id: client.id,
        titre: nouvelleEntree.titre.trim(),
        description: nouvelleEntree.description.trim() || null,
        date_evenement: nouvelleEntree.date_evenement,
        type: nouvelleEntree.type,
        lien: nouvelleEntree.lien.trim() || null,
      })
      .select('id, titre, description, date_evenement, type, lien')
      .single()
    if (data) {
      setCalendrier((prev) =>
        [...prev, data as CalendrierEntree].sort((a, b) =>
          a.date_evenement.localeCompare(b.date_evenement)
        )
      )
    }
    setNouvelleEntree({ titre: '', description: '', date_evenement: '', type: 'rdv', lien: '' })
    setMaj(false)
  }

  const supprimerEntreeCalendrier = async (id: string) => {
    await supabase.from('calendrier_entrees').delete().eq('id', id)
    setCalendrier((prev) => prev.filter((c) => c.id !== id))
  }

  const deconnexion = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (chargement) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (!client) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Impossible de charger votre compte.</p>
      </main>
    )
  }

  if (!client.acces_active) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-semibold">Compte en attente d'activation</h1>
          <p className="text-slate-400 text-sm">
            Merci pour ton inscription, <strong>{client.nom_entreprise}</strong> ! Ton accès au
            tableau de bord sera débloqué dès validation par notre équipe. Tu recevras un email
            dès que c'est fait.
          </p>
        </div>
      </main>
    )
  }

  if (client.acces_active && !client.onboarding_complete && monRole === 'proprietaire') {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full space-y-6">
          <div className="text-center space-y-2">
            <div className="text-3xl">👋</div>
            <h1 className="text-xl font-semibold">
              Bienvenue, {client.nom_entreprise} !
            </h1>
            <p className="text-slate-400 text-sm">
              Quelques infos avant de commencer — ça ne prend qu'une minute, et tu pourras tout
              modifier plus tard.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">📱 Réseaux &amp; canaux</h2>
            <input
              placeholder="WhatsApp du directeur commercial"
              value={onboardingForm.whatsapp_directeur}
              onChange={(e) =>
                setOnboardingForm({ ...onboardingForm, whatsapp_directeur: e.target.value })
              }
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            />
            <input
              placeholder="Page Facebook (URL)"
              value={onboardingForm.facebook_url}
              onChange={(e) => setOnboardingForm({ ...onboardingForm, facebook_url: e.target.value })}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            />
            <input
              placeholder="Page Instagram (URL)"
              value={onboardingForm.instagram_url}
              onChange={(e) =>
                setOnboardingForm({ ...onboardingForm, instagram_url: e.target.value })
              }
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            />
            <input
              placeholder="Page LinkedIn (URL)"
              value={onboardingForm.linkedin_url}
              onChange={(e) => setOnboardingForm({ ...onboardingForm, linkedin_url: e.target.value })}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            />
            <input
              placeholder="Site web"
              value={onboardingForm.site_web}
              onChange={(e) => setOnboardingForm({ ...onboardingForm, site_web: e.target.value })}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">👥 Ton équipe (facultatif)</h2>
            {onboardingMembres.map((membre, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  placeholder="Email"
                  value={membre.email}
                  onChange={(e) => {
                    const copie = [...onboardingMembres]
                    copie[i] = { ...copie[i], email: e.target.value }
                    setOnboardingMembres(copie)
                  }}
                  className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                />
                <input
                  placeholder="Nom complet"
                  value={membre.nom_complet}
                  onChange={(e) => {
                    const copie = [...onboardingMembres]
                    copie[i] = { ...copie[i], nom_complet: e.target.value }
                    setOnboardingMembres(copie)
                  }}
                  className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                />
                <select
                  value={membre.role}
                  onChange={(e) => {
                    const copie = [...onboardingMembres]
                    copie[i] = { ...copie[i], role: e.target.value as 'membre' | 'directeur_commercial' }
                    setOnboardingMembres(copie)
                  }}
                  className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                >
                  <option value="membre">👤 Commercial</option>
                  <option value="directeur_commercial">🧭 Directeur commercial</option>
                </select>
              </div>
            ))}
            <button
              onClick={() =>
                setOnboardingMembres([
                  ...onboardingMembres,
                  { email: '', nom_complet: '', role: 'membre' },
                ])
              }
              className="text-xs text-accent underline"
            >
              + Ajouter un membre
            </button>
          </div>

          <button
            onClick={soumettreOnboarding}
            disabled={onboardingEnCours}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
          >
            {onboardingEnCours ? 'Enregistrement...' : "C'est parti →"}
          </button>
        </div>
      </main>
    )
  }

  const ciblesContactees = targets.filter((tg) => tg.statut === 'contacte').length
  const dir = langue === 'ar' ? 'rtl' : 'ltr'

  const ONGLETS: { id: Onglet; label: string; icone: string }[] = [
    { id: 'ciblage', label: t('onglet_ciblage'), icone: '🔍' },
    { id: 'cibles', label: t('onglet_cibles'), icone: '📋' },
    { id: 'validation', label: t('onglet_validation'), icone: '🛠️' },
    {
      id: 'inbox',
      label: `Boîte de réception${messagesRecus.filter((m) => !m.lu).length > 0 ? ` (${messagesRecus.filter((m) => !m.lu).length})` : ''}`,
      icone: '📬',
    },
    { id: 'pipeline', label: 'Pipeline', icone: '📊' },
    {
      id: 'catalogue_strategie',
      label: `📦 ${vocabulairePourVertical(verticalSlug).labelCatalogue} / Stratégie`,
      icone: '📦',
    },
    { id: 'collaboration', label: '💬 Collaboration & Tâches', icone: '💬' },
    { id: 'calendrier', label: '📅 Mon Calendrier', icone: '📅' },
    { id: 'stats', label: t('onglet_stats'), icone: '📈' },
    { id: 'equipe', label: t('onglet_equipe'), icone: '👥' },
  ].filter((onglet): onglet is { id: Onglet; label: string; icone: string } => {
    if (monRole === 'proprietaire' || monRole === 'admin') return true
    return !(client.onglets_masques_equipe ?? []).includes(onglet.id)
  })

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row" dir={dir}>
      {messageLinkedin && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-lg w-full space-y-3">
            <h3 className="font-semibold text-lg">🔗 Message prêt pour LinkedIn</h3>
            <p className="text-slate-400 text-xs">
              Copie ce texte et colle-le dans un message LinkedIn à ce contact (l'envoi LinkedIn
              n'est pas automatisé, il se fait à la main).
            </p>
            <textarea
              value={messageLinkedin}
              onChange={(e) => setMessageLinkedin(e.target.value)}
              className="w-full h-40 rounded-lg bg-slate-950 border border-slate-700 p-3 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMessageLinkedin(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(messageLinkedin)
                }}
                className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm"
              >
                📋 Copier
              </button>
            </div>
          </div>
        </div>
      )}
      {/* BARRE LATERALE GAUCHE */}
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800">
          <h1 className="text-lg font-bold leading-tight">{client.nom_entreprise}</h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('statut')} : <span className="text-accent">{client.statut_abonnement}</span>
          </p>
          {estAdmin && (
            <a
              href="/admin"
              className="mt-2 inline-block text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/40"
            >
              🔑 Vous êtes admin — voir tous les cabinets →
            </a>
          )}
        </div>

        <nav className="flex md:flex-col gap-1 px-3 py-3 overflow-x-auto md:overflow-visible">
          {ONGLETS.map((onglet) => (
            <button
              key={onglet.id}
              onClick={() => setOngletActif(onglet.id)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-left transition ${
                ongletActif === onglet.id
                  ? 'bg-accent/10 text-accent border border-accent/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              {onglet.icone} {onglet.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* CONTENU */}
      <div className="flex-1 overflow-y-auto">
        {/* BARRE DU HAUT (langue + deconnexion) */}
        <div className="flex justify-end items-center gap-3 px-6 py-4 border-b border-slate-800">
          <select
            value={client.langue_preferee}
            onChange={(e) => changerLangue(e.target.value as Langue)}
            className="rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
          >
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
            <option value="ar">🇹🇳 العربية</option>
          </select>
          <button onClick={deconnexion} className="text-sm text-slate-400 hover:text-white underline">
            {t('deconnexion')}
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {ongletActif === 'catalogue_strategie' && (
          <div className="flex gap-2 border-b border-slate-800 pb-2 -mb-6 flex-wrap">
            {[
              { id: 'catalogue' as const, label: `📦 ${vocabulairePourVertical(verticalSlug).labelCatalogue}` },
              { id: 'strategie' as const, label: '🧭 Stratégie' },
              { id: 'idees' as const, label: '📣 Idées marketing' },
            ].map((so) => (
              <button
                key={so.id}
                onClick={() => setSousOngletGroupe(so.id)}
                className={`text-sm px-3 py-1.5 rounded-t-lg ${
                  sousOngletGroupe === so.id
                    ? 'bg-accent/10 text-accent border-b-2 border-accent'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {so.label}
              </button>
            ))}
          </div>
        )}
        {/* ===================== ONGLET CIBLAGE ===================== */}
        {ongletActif === 'ciblage' && (
          <>
            <section className="space-y-5">
              {estHybride && (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">{t('mode_ciblage')}</p>
                  <div className="grid grid-cols-2 gap-3 max-w-md">
                    <button
                      onClick={() => changerModeCiblage('entreprise')}
                      disabled={maj}
                      className={`rounded-xl border p-3 text-sm font-semibold ${
                        client.mode_ciblage === 'entreprise'
                          ? 'border-accent bg-slate-900'
                          : 'border-slate-700 bg-slate-900/50'
                      }`}
                    >
                      🏢 {t('entreprise')}
                    </button>
                    <button
                      onClick={() => changerModeCiblage('particulier')}
                      disabled={maj}
                      className={`rounded-xl border p-3 text-sm font-semibold ${
                        client.mode_ciblage === 'particulier'
                          ? 'border-accent bg-slate-900'
                          : 'border-slate-700 bg-slate-900/50'
                      }`}
                    >
                      🙋 {t('particulier')}
                    </button>
                  </div>
                </div>
              )}

              {/* PAYS - dropdown multi-select */}
              <div className="space-y-2 max-w-md">
                <p className="text-slate-400 text-sm">{t('pays_cibles')}</p>
                <DropdownMultiSelect
                  options={PAYS_DISPONIBLES.map((p) => ({ value: p.code, label: p.nom }))}
                  selectionnes={paysSelectionnes}
                  onToggle={togglePays}
                  placeholder="Sélectionner des pays..."
                  disabled={maj}
                />
              </div>

              {client.mode_ciblage === 'entreprise' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm">{t('secteur')}</p>
                      <select
                        value={secteurInput}
                        onChange={(e) => changerSecteur(e.target.value)}
                        disabled={maj}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                      >
                        <option value="">Indifférent</option>
                        {SECTEURS_DISPONIBLES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <p className="text-slate-400 text-sm">{t('taille')}</p>
                      <select
                        value={client.taille_entreprise}
                        onChange={(e) => changerTailleEntreprise(e.target.value)}
                        disabled={maj}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                      >
                        <option value="indifferent">Indifférent</option>
                        <option value="startup">Startup / Jeune pousse</option>
                        <option value="pme">PME</option>
                        <option value="grande_entreprise">Grande entreprise / Groupe</option>
                      </select>
                    </div>
                  </div>

                  {/* POSTE - dropdown multi-select */}
                  <div className="space-y-2 max-w-md">
                    <p className="text-slate-400 text-sm">{t('poste')}</p>
                    <DropdownMultiSelect
                      options={professionsDisponibles(verticalSlug, 'entreprise').map((p) => ({
                        value: p,
                        label: p,
                      }))}
                      selectionnes={professionsSelectionnees}
                      onToggle={toggleProfession}
                      placeholder="Sélectionner des postes..."
                      disabled={maj}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2 max-w-md">
                  <p className="text-slate-400 text-sm">{t('profil_particulier')}</p>
                  <select
                    value={client.profil_particulier ?? ''}
                    onChange={(e) => changerProfilParticulier(e.target.value)}
                    disabled={maj}
                    className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                  >
                    <option value="">Sélectionner un profil</option>
                    {PROFILS_PARTICULIER.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CANAL DE SOURCING */}
              <div className="space-y-2 max-w-md">
                <p className="text-slate-400 text-sm">{t('source_sourcing')}</p>
                <select
                  value={client.canal_sourcing}
                  onChange={(e) => changerCanalSourcing(e.target.value)}
                  disabled={maj}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="google_maps">Google Maps / Google Business</option>
                  <option value="facebook">Facebook Pages</option>
                  <option value="web">Recherche Web générale</option>
                  <option value="tous">Toutes les sources combinées</option>
                </select>
                <p className="text-slate-600 text-xs">
                  💡 En Tunisie, beaucoup de PME sont plus présentes sur Google Maps/Facebook que
                  sur LinkedIn — pense à activer "Toutes les sources" pour maximiser la couverture.
                </p>
              </div>

              {/* BOUTON LANCER LA RECHERCHE */}
              <div className="pt-2">
                <button
                  onClick={lancerRecherche}
                  disabled={lancementEnCours || paysSelectionnes.size === 0}
                  className="px-6 py-3 rounded-xl bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2"
                >
                  {lancementEnCours ? '...' : t('lancer_recherche')}
                  {!lancementEnCours && <span>→</span>}
                </button>
                {paysSelectionnes.size === 0 && (
                  <p className="text-slate-600 text-xs mt-1">
                    Sélectionne au moins un pays d'abord.
                  </p>
                )}

                {lancementResultat && (
                  <div className="mt-3 space-y-1 text-sm">
                    {lancementResultat.some(
                      (r) => r.erreur && String(r.erreur).includes('APIFY_API_TOKEN')
                    ) ? (
                      <div className="rounded-lg bg-slate-900 border border-slate-700 p-3">
                        <p className="text-slate-300">
                          ⚙️ La recherche automatique n'est pas encore configurée.
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                          En attendant, tu peux ajouter tes cibles à la main ci-dessous, dans
                          l'onglet "Cibles".
                        </p>
                      </div>
                    ) : (
                      lancementResultat.map((r, i) => (
                        <div key={i} className="rounded-lg bg-slate-900 border border-slate-700 p-2">
                          {r.erreur ? (
                            <span className="text-red-400">❌ {String(r.erreur)}</span>
                          ) : r.info ? (
                            <span className="text-slate-400">ℹ️ {String(r.info)}</span>
                          ) : (
                            <span className="text-accent">
                              ✅ {String(r.pays)} ({String(r.source ?? '')}) —{' '}
                              {String(r.nouveaux_ajoutes)} nouveaux prospects ajoutés (
                              {String(r.profils_trouves)} trouvés au total)
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* PERSONNALISATION DU MESSAGE ET DU LOGO */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">{t('message_personnalise')}</h2>
              <p className="text-slate-500 text-xs">
                Utilise <code className="text-accent">{'{nom}'}</code>,{' '}
                <code className="text-accent">{'{cabinet}'}</code> et{' '}
                <code className="text-accent">{'{lien}'}</code> dans ton texte — ils seront
                automatiquement remplacés. Le lien de désinscription est toujours ajouté
                automatiquement à la fin (obligation légale).
              </p>

              <div className="flex flex-wrap gap-2">
                {templatesPourVertical(verticalSlug).map((tpl) => (
                  <button
                    key={tpl.titre}
                    onClick={() => {
                      setMessageInput(tpl.texte)
                      enregistrerMessage(tpl.texte)
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-accent transition"
                  >
                    📄 {tpl.titre}
                  </button>
                ))}
              </div>

              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onBlur={() => enregistrerMessage()}
                placeholder={`Bonjour {nom},\n\n{cabinet} vous invite a decrire votre situation, un expert etudiera votre dossier :\n{lien}`}
                className="w-full h-28 rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
              />

              <div className="space-y-2">
                <p className="text-slate-400 text-sm">
                  {t('logo')}{' '}
                  <span className="text-slate-600">(URL d'image hébergée en ligne)</span>
                </p>
                <input
                  value={logoInput}
                  onChange={(e) => setLogoInput(e.target.value)}
                  onBlur={enregistrerLogo}
                  placeholder="https://ton-site.com/logo.png"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                />
                {logoInput && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoInput}
                    alt="Aperçu logo"
                    className="h-12 mt-2 rounded bg-white p-1"
                  />
                )}
              </div>
            </section>
          </>
        )}

        {/* ===================== ONGLET CIBLES ===================== */}
        {ongletActif === 'cibles' && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
              <input
                value={nouvelleCible.nom}
                onChange={(e) => setNouvelleCible({ ...nouvelleCible, nom: e.target.value })}
                placeholder="Nom"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <input
                value={nouvelleCible.entreprise_ou_objectif}
                onChange={(e) =>
                  setNouvelleCible({ ...nouvelleCible, entreprise_ou_objectif: e.target.value })
                }
                placeholder={client.mode_ciblage === 'particulier' ? 'Objectif' : 'Entreprise'}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <input
                value={nouvelleCible.telephone}
                onChange={(e) => setNouvelleCible({ ...nouvelleCible, telephone: e.target.value })}
                placeholder="Téléphone"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <input
                value={nouvelleCible.email}
                onChange={(e) => setNouvelleCible({ ...nouvelleCible, email: e.target.value })}
                placeholder="Email"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <select
                value={nouvelleCible.country}
                onChange={(e) => setNouvelleCible({ ...nouvelleCible, country: e.target.value })}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                {PAYS_DISPONIBLES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <button
                onClick={ajouterCible}
                disabled={maj || !nouvelleCible.nom.trim()}
                className="rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-40"
              >
                {t('ajouter')}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={inputFichierCSV}
                type="file"
                accept=".csv"
                onChange={importerCibles}
                className="hidden"
              />
              <button
                onClick={() => inputFichierCSV.current?.click()}
                disabled={importCSVEnCours}
                className="text-xs px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-accent disabled:opacity-50"
              >
                {importCSVEnCours ? 'Import en cours...' : '📁 Importer une liste (CSV)'}
              </button>
              <span className="text-xs text-slate-500">
                Colonnes : nom, telephone, email, entreprise, pays — et pour l'historique
                (optionnel) : canal, resultat (gagné/perdu)
              </span>
            </div>
            {messageImportCSV && <p className="text-sm text-slate-300">{messageImportCSV}</p>}

            {targets.filter((tg) => tg.statut === 'nouveau').length === 0 ? (
              <p className="text-slate-500 text-sm italic">
                Aucune cible non contactée pour le moment. Les prospects déjà contactés se
                trouvent dans l'onglet Pipeline.
              </p>
            ) : (
              <>
                {membresEquipe.length > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFiltreAssignation('toutes')}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        filtreAssignation === 'toutes'
                          ? 'bg-accent/10 text-accent border-accent/40'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      Toutes les cibles ({targets.filter((tg) => tg.statut === 'nouveau').length})
                    </button>
                    <button
                      onClick={() => setFiltreAssignation('mes-cibles')}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        filtreAssignation === 'mes-cibles'
                          ? 'bg-accent/10 text-accent border-accent/40'
                          : 'bg-slate-900 text-slate-400 border-slate-700'
                      }`}
                    >
                      Mes cibles (
                      {
                        targets.filter(
                          (tg) => tg.statut === 'nouveau' && tg.assigne_a === monClientUserId
                        ).length
                      }
                      )
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        targets.filter((tg) => tg.statut === 'nouveau').length > 0 &&
                        targets
                          .filter((tg) => tg.statut === 'nouveau')
                          .every((tg) => ciblesSelectionnees.has(tg.id))
                      }
                      onChange={toggleTouteSelection}
                      className="accent-accent"
                    />
                    {t('tout_selectionner')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => envoyerAuxSelectionnes('diagnostic')}
                      disabled={ciblesSelectionnees.size === 0 || envoiMasseEnCours}
                      className="text-sm px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                    >
                      {envoiMasseEnCours
                        ? '...'
                        : `📋 Diagnostic (${ciblesSelectionnees.size})`}
                    </button>
                    <button
                      onClick={() => envoyerAuxSelectionnes('message')}
                      disabled={ciblesSelectionnees.size === 0 || envoiMasseEnCours}
                      className="text-sm px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 font-semibold disabled:opacity-40"
                    >
                      {envoiMasseEnCours
                        ? '...'
                        : `✉️ Message pro (${ciblesSelectionnees.size})`}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {targets
                    .filter((tg) => tg.statut === 'nouveau')
                    .filter((tg) => filtreAssignation === 'toutes' || tg.assigne_a === monClientUserId)
                    .map((target) => {
                      const estPriseParAutre = Boolean(
                        target.assigne_a && target.assigne_a !== monClientUserId
                      )
                      const nomCollegue = estPriseParAutre
                        ? membresEquipe.find((m) => m.id === target.assigne_a)?.nom_complet ||
                          'un(e) collègue'
                        : null
                      return (
                    <div
                      key={target.id}
                      className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between flex-wrap gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ciblesSelectionnees.has(target.id)}
                          onChange={() => toggleCibleSelectionnee(target.id)}
                          disabled={
                            target.statut !== 'nouveau' || (estPriseParAutre && !peutSuperviser)
                          }
                          title={
                            estPriseParAutre && !peutSuperviser
                              ? `Déjà pris en charge par ${nomCollegue}`
                              : undefined
                          }
                          className="accent-accent"
                        />
                        <div>
                          <p className="font-semibold">
                            {target.nom}{' '}
                            {target.entreprise_ou_objectif && (
                              <span className="text-slate-400 font-normal">
                                — {target.entreprise_ou_objectif}
                              </span>
                            )}
                          </p>
                          <p className="text-slate-400 text-sm">
                            {target.telephone ?? '—'} · {target.email ?? '—'} ·{' '}
                            {target.country ? `${drapeauPays(target.country)} ${target.country}` : '—'}{' '}
                            ·{' '}
                            <span className="text-accent">{target.statut}</span>
                          </p>
                          {target.signal_ia && (
                            <p className="text-xs text-sky-400 mt-1">{target.signal_ia}</p>
                          )}
                          {target.reponse_a_traiter && (
                            <p className="text-xs font-semibold text-emerald-400 mt-1">
                              🎯 Réponse positive détectée — passez à l'envoi du diagnostic
                            </p>
                          )}
                          {estPriseParAutre && (
                            <p className="text-amber-400 text-xs mt-1">
                              🔒 Déjà pris en charge par {nomCollegue} — merci de ne pas le contacter
                              de ton côté.
                            </p>
                          )}
                          {(target.segment_categorie || typeof target.score_chaleur === 'number') && (
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {target.segment_categorie && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                  {target.segment_categorie}
                                </span>
                              )}
                              {target.segment_urgence && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                  {target.segment_urgence === 'haute'
                                    ? '🔴 urgent'
                                    : target.segment_urgence === 'basse'
                                    ? '🟢 pas pressé'
                                    : '🟠 moyen'}
                                </span>
                              )}
                              {typeof target.score_chaleur === 'number' && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    target.score_chaleur >= 70
                                      ? 'bg-green-950 text-green-400'
                                      : target.score_chaleur >= 40
                                      ? 'bg-amber-950 text-amber-400'
                                      : 'bg-red-950 text-red-400'
                                  }`}
                                >
                                  🔥 {target.score_chaleur}/100
                                </span>
                              )}
                            </div>
                          )}
                          {membresEquipe.length > 1 && (
                            <select
                              value={target.assigne_a ?? ''}
                              onChange={(e) => assignerCible(target.id, e.target.value || null)}
                              disabled={estPriseParAutre && !peutSuperviser}
                              className="mt-2 text-xs rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 disabled:opacity-50"
                            >
                              <option value="">Non assigné</option>
                              {(peutSuperviser
                                ? membresEquipe
                                : membresEquipe.filter((m) => m.id === monClientUserId)
                              ).map((m) => (
                                <option key={m.id} value={m.id}>
                                  👤 {m.nom_complet || '(sans nom)'}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <select
                              value={target.etape_pipeline || 'nouveau'}
                              onChange={(e) => changerEtapePipeline(target.id, e.target.value)}
                              className="text-xs rounded-lg bg-slate-800 border border-slate-700 px-2 py-1"
                            >
                              <option value="nouveau">🆕 Nouveau</option>
                              <option value="contacte">📨 Contacté</option>
                              <option value="qualifie">✅ Qualifié</option>
                              <option value="proposition">📄 Proposition envoyée</option>
                              <option value="negociation">🤝 Négociation</option>
                              <option value="gagne">🏆 Gagné</option>
                              <option value="perdu">❌ Perdu</option>
                            </select>
                            <button
                              onClick={() =>
                                setCibleNotesOuverte(
                                  cibleNotesOuverte === target.id ? null : target.id
                                )
                              }
                              className="text-xs text-slate-400 underline"
                            >
                              📝 Notes ({(notesCibles[target.id] ?? []).length})
                            </button>
                          </div>

                          {cibleNotesOuverte === target.id && (
                            <div className="mt-2 space-y-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
                              <div className="flex gap-2">
                                <input
                                  value={nouvelleNoteTexte}
                                  onChange={(e) => setNouvelleNoteTexte(e.target.value)}
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' && ajouterNote(target.id)
                                  }
                                  placeholder="Ex: l'ai appelé, veut réfléchir, rappeler mardi"
                                  className="flex-1 text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                                />
                                <button
                                  onClick={() => ajouterNote(target.id)}
                                  disabled={!nouvelleNoteTexte.trim()}
                                  className="text-xs px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                                >
                                  Ajouter
                                </button>
                              </div>
                              {(notesCibles[target.id] ?? []).length === 0 ? (
                                <p className="text-xs text-slate-500 italic">Aucune note.</p>
                              ) : (
                                (notesCibles[target.id] ?? []).map((n) => (
                                  <div
                                    key={n.id}
                                    className="flex items-start justify-between gap-2 text-xs border-t border-slate-800 pt-2"
                                  >
                                    <div>
                                      <p className="text-slate-300">{n.contenu}</p>
                                      <p className="text-slate-600">
                                        {new Date(n.created_at).toLocaleString('fr-FR')}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => supprimerNote(target.id, n.id)}
                                      className="text-red-400 hover:text-red-300 underline whitespace-nowrap"
                                    >
                                      Suppr.
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => envoyerDiagnostic(target.id)}
                          disabled={
                            target.statut !== 'nouveau' ||
                            envoiEnCours === target.id ||
                            (estPriseParAutre && !peutSuperviser)
                          }
                          className="text-sm px-3 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                        >
                          {envoiEnCours === target.id
                            ? 'Envoi...'
                            : target.statut === 'nouveau'
                            ? '📋 Diagnostic'
                            : 'Déjà envoyé'}
                        </button>
                        {target.statut === 'nouveau' && (
                          <button
                            onClick={() => envoyerMessage(target.id)}
                            disabled={envoiEnCours === target.id}
                            className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 disabled:opacity-40"
                          >
                            {envoiEnCours === target.id ? 'Envoi...' : '✉️ Message pro'}
                          </button>
                        )}
                        {target.statut === 'nouveau' && (
                          <button
                            onClick={() => preparerLinkedin(target.id)}
                            disabled={envoiEnCours === target.id}
                            className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 disabled:opacity-40"
                          >
                            {envoiEnCours === target.id ? '...' : '🔗 LinkedIn'}
                          </button>
                        )}
                      </div>
                    </div>
                      )
                    })}
                </div>
              </>
            )}
          </section>
        )}

        {/* ===================== ONGLET PIPELINE (KANBAN) ===================== */}
        {ongletActif === 'pipeline' && (
          <section className="space-y-4">
            {(() => {
              const cibleEnCours = targets.filter((tg) => tg.statut !== 'nouveau')
              const colonnes = etapesPipelinePourVertical(verticalSlug)

              if (cibleEnCours.length === 0) {
                return (
                  <p className="text-slate-500 text-sm italic">
                    Aucun prospect en cours pour le moment. Les prospects contactés depuis
                    l'onglet Cibles apparaîtront ici.
                  </p>
                )
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {colonnes.map((colonne) => {
                    const cartes = cibleEnCours.filter(
                      (tg) => (tg.etape_pipeline || 'contacte') === colonne.etape
                    )
                    return (
                      <div
                        key={colonne.etape}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (carteEnCoursDeGlissement) {
                            changerEtapePipeline(carteEnCoursDeGlissement, colonne.etape)
                          }
                          setCarteEnCoursDeGlissement(null)
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-900/60 p-2 min-h-[200px] space-y-2"
                      >
                        <p className="text-xs font-semibold text-slate-300 px-1 pb-1 border-b border-slate-800">
                          {colonne.label} ({cartes.length})
                        </p>
                        {cartes.map((carte) => (
                          <div
                            key={carte.id}
                            draggable
                            onDragStart={() => setCarteEnCoursDeGlissement(carte.id)}
                            onDragEnd={() => setCarteEnCoursDeGlissement(null)}
                            className="rounded-lg border border-slate-700 bg-slate-950 p-2 cursor-grab active:cursor-grabbing space-y-1"
                          >
                            <p className="text-sm font-semibold">{carte.nom}</p>
                            {carte.entreprise_ou_objectif && (
                              <p className="text-xs text-slate-400">
                                {carte.entreprise_ou_objectif}
                              </p>
                            )}
                            {carte.reponse_a_traiter && (
                              <p className="text-xs font-semibold text-emerald-400">
                                🎯 Réponse positive à traiter
                              </p>
                            )}
                            {typeof carte.score_chaleur === 'number' && (
                              <span
                                className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  carte.score_chaleur >= 70
                                    ? 'bg-green-950 text-green-400'
                                    : carte.score_chaleur >= 40
                                    ? 'bg-amber-950 text-amber-400'
                                    : 'bg-red-950 text-red-400'
                                }`}
                              >
                                🔥 {carte.score_chaleur}/100
                              </span>
                            )}
                            {carte.country && (
                              <p className="text-xs text-slate-500">
                                {drapeauPays(carte.country)} {carte.country}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </section>
        )}

        {/* ===================== ONGLET VALIDATION ===================== */}
        {ongletActif === 'validation' && (
          <section className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">🔔 {t('validation_titre')}</h2>
              {diagnosticsEnAttente.length === 0 ? (
                <p className="text-slate-500 text-sm italic">Rien à valider pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {diagnosticsEnAttente.map((d) => (
                    <ValidationItem key={d.id} diagnostic={d} onValide={() => chargerTout(client.id)} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-400">📁 Déjà validés</h2>
              {diagnosticsValides.length === 0 ? (
                <p className="text-slate-600 text-sm italic">Aucun diagnostic validé pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {diagnosticsValides.map((d) => {
                    const nomCible = Array.isArray(d.targets) ? d.targets[0]?.nom : d.targets?.nom
                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                      >
                        <span>
                          {nomCible ?? 'Prospect'}{' '}
                          <span className="text-slate-500 text-xs">
                            · {new Date(d.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </span>
                        <a
                          href={`/api/rapport/${d.token_acces}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent underline text-xs"
                        >
                          📄 Voir le rapport
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ===================== ONGLET EQUIPE ===================== */}
        {ongletActif === 'equipe' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('equipe_titre')}</h2>

            {(monRole === 'proprietaire' || monRole === 'admin') && (
              <details className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  👑 Droits d'accès — choisir ce que l'équipe peut voir
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ONGLETS.filter((o) => o.id !== 'equipe').map((onglet) => {
                    const masque = (client.onglets_masques_equipe ?? []).includes(onglet.id)
                    return (
                      <button
                        key={onglet.id}
                        onClick={() => basculerOngletMasque(onglet.id)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${
                          masque
                            ? 'bg-slate-800 border-slate-600 text-slate-500 line-through'
                            : 'bg-accent/10 border-accent/40 text-accent'
                        }`}
                      >
                        {onglet.label}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Les onglets barrés sont masqués pour les commerciaux et directeurs commerciaux
                  (toi, propriétaire, vois toujours tout).
                </p>
              </details>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <h3 className="text-sm font-semibold">📱 Numéros WhatsApp de l'équipe</h3>
              <div className="flex flex-wrap gap-2">
                {(client.whatsapp_equipe ?? []).map((numero) => (
                  <span
                    key={numero}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 flex items-center gap-2"
                  >
                    {numero}
                    <button
                      onClick={() => retirerWhatsappEquipe(numero)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {(client.whatsapp_equipe ?? []).length === 0 && (
                  <span className="text-xs text-slate-500 italic">Aucun numéro ajouté.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="+216 XX XXX XXX"
                  value={nouveauNumeroWhatsapp}
                  onChange={(e) => setNouveauNumeroWhatsapp(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <button
                  onClick={async () => {
                    await ajouterWhatsappEquipe(nouveauNumeroWhatsapp)
                    setNouveauNumeroWhatsapp('')
                  }}
                  className="text-sm px-4 rounded-lg bg-accent text-slate-950 font-semibold"
                >
                  Ajouter
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {membresEquipe.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
                >
                  <span>{m.nom_complet || '(nom non renseigné)'}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-accent text-xs uppercase">
                      {m.role === 'proprietaire' || m.role === 'admin'
                        ? '👑 Propriétaire du cabinet'
                        : m.role === 'directeur_commercial'
                        ? '🧭 Directeur commercial'
                        : '👤 Commercial'}
                    </span>
                    {peutSuperviser &&
                      m.role !== 'proprietaire' &&
                      m.role !== 'admin' &&
                      m.id !== monClientUserId && (
                        <button
                          onClick={() => supprimerMembre(m.id, m.nom_complet)}
                          className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                          Retirer
                        </button>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {peutSuperviser && membresEquipe.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">📊 Suivi de l'équipe</h3>
                <div className="space-y-2">
                  {membresEquipe
                    .filter((m) => m.role !== 'proprietaire' && m.role !== 'admin')
                    .map((m) => {
                      const ciblesDuMembre = targets.filter((tg) => tg.assigne_a === m.id)
                      const ciblesContacteesDuMembre = ciblesDuMembre.filter(
                        (tg) => tg.statut === 'contacte'
                      )
                      const diagnosticsValidesDuMembre = diagnosticsValides.filter(
                        (d) => targets.find((tg) => tg.id === d.target_id)?.assigne_a === m.id
                      )
                      const packsDuMembre = packsVendus.filter((p) => {
                        const diag = Array.isArray(p.diagnostics) ? p.diagnostics[0] : p.diagnostics
                        const targetId = diag?.target_id
                        return targetId && targets.find((tg) => tg.id === targetId)?.assigne_a === m.id
                      })
                      const montantDuMembre = packsDuMembre.reduce(
                        (total, p) => total + (p.prix_pack ?? 0),
                        0
                      )
                      return (
                        <div
                          key={m.id}
                          className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm flex items-center justify-between flex-wrap gap-2"
                        >
                          <span>
                            👤 {m.nom_complet || '(sans nom)'}{' '}
                            {m.role === 'directeur_commercial' && (
                              <span className="text-accent text-xs">— directeur commercial</span>
                            )}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {ciblesDuMembre.length} cible(s) · {ciblesContacteesDuMembre.length}{' '}
                            contactée(s) · {diagnosticsValidesDuMembre.length} diagnostic(s) validé(s) ·{' '}
                            {packsDuMembre.length} pack(s) vendu(s) ({montantDuMembre} TND/EUR)
                          </span>
                        </div>
                      )
                    })}
                  {targets.filter((tg) => !tg.assigne_a).length > 0 && (
                    <p className="text-slate-500 text-xs italic">
                      {targets.filter((tg) => !tg.assigne_a).length} cible(s) pas encore assignée(s)
                      à un commercial.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <a href="/admin" className="text-xs text-slate-600 hover:text-slate-400 underline">
                Vous êtes Braise ? Accès administration plateforme →
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
              <input
                value={inviteNom}
                onChange={(e) => setInviteNom(e.target.value)}
                placeholder="Nom du collègue"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email du collègue"
                type="email"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <button
                onClick={inviterMembre}
                disabled={inviteEnCours || !inviteEmail.trim()}
                className="rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-40"
              >
                {inviteEnCours ? '...' : t('inviter')}
              </button>
              {(monRole === 'proprietaire' || monRole === 'admin') && (
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'membre' | 'directeur_commercial')}
                  className="md:col-span-3 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                >
                  <option value="membre">👤 Commercial</option>
                  <option value="directeur_commercial">🧭 Directeur commercial</option>
                </select>
              )}
            </div>
            {inviteMessage && <p className="text-sm">{inviteMessage}</p>}
          </section>
        )}

        {/* ===================== ONGLET MARKETING ===================== */}
        {ongletActif === 'catalogue_strategie' && sousOngletGroupe === 'idees' && (
          <section className="space-y-4">
            <p className="text-slate-400 text-sm">
              Idées de contenu générées automatiquement à partir des diagnostics des prospects — à
              copier-coller pour vos publications (LinkedIn, blog...). Rien n'est publié
              automatiquement.
            </p>
            {(() => {
              const tousLesDiagnostics = [...diagnosticsEnAttente, ...diagnosticsValides]
              const suggestions = tousLesDiagnostics
                .map((d) => {
                  const reco = d.recommandations_json as {
                    contenuMarketing?: { titre: string; accroche_linkedin: string; format_suggere: string }
                    segment?: { categorie: string }
                  } | null
                  const nomCible = Array.isArray(d.targets) ? d.targets[0]?.nom : d.targets?.nom
                  return reco?.contenuMarketing
                    ? { id: d.id, nomCible, ...reco.contenuMarketing, categorie: reco.segment?.categorie }
                    : null
                })
                .filter((s): s is NonNullable<typeof s> => s !== null)

              if (suggestions.length === 0) {
                return (
                  <p className="text-slate-500 text-sm italic">
                    Pas encore de suggestion — elles apparaissent dès qu'un prospect répond à un
                    diagnostic.
                  </p>
                )
              }

              return (
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-1"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="font-semibold">{s.titre}</p>
                        {s.categorie && (
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                            {s.categorie}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm">{s.accroche_linkedin}</p>
                      <p className="text-slate-500 text-xs">
                        Format suggéré : {s.format_suggere}
                        {s.nomCible ? ` · inspiré par ${s.nomCible}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </section>
        )}

        {/* ===================== ONGLET BOITE DE RECEPTION ===================== */}
        {ongletActif === 'inbox' && (
          <section className="space-y-4">
            <p className="text-slate-400 text-sm">
              Réponses des prospects par WhatsApp ou Email. Tu peux répondre directement d'ici.
            </p>

            <details className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                ⚙️ Synchroniser ma boîte mail pro (IMAP){' '}
                {client?.imap_actif && (
                  <span className="text-xs text-emerald-400 font-normal">— activée</span>
                )}
              </summary>
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500">
                  En plus de la réception automatique déjà active, tu peux brancher directement
                  ta boîte mail professionnelle (Gmail, Outlook, etc.) pour que les réponses
                  arrivées là-bas soient importées ici aussi, toutes les heures.
                </p>
                {client?.imap_derniere_erreur && (
                  <p className="text-xs text-red-400">
                    ⚠️ Dernière erreur de synchro : {client.imap_derniere_erreur}
                  </p>
                )}
                {client?.imap_derniere_sync_at && (
                  <p className="text-xs text-slate-500">
                    Dernière synchro réussie :{' '}
                    {new Date(client.imap_derniere_sync_at).toLocaleString('fr-FR')}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    placeholder="Serveur IMAP (ex: imap.gmail.com)"
                    value={imapForm.imap_host}
                    onChange={(e) => setImapForm({ ...imapForm, imap_host: e.target.value })}
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Port (993 par défaut)"
                    value={imapForm.imap_port}
                    onChange={(e) =>
                      setImapForm({ ...imapForm, imap_port: Number(e.target.value) })
                    }
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  />
                  <input
                    placeholder="Adresse email"
                    value={imapForm.imap_utilisateur}
                    onChange={(e) =>
                      setImapForm({ ...imapForm, imap_utilisateur: e.target.value })
                    }
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Mot de passe (laisser vide pour ne pas changer)"
                    value={imapForm.imap_mot_de_passe}
                    onChange={(e) =>
                      setImapForm({ ...imapForm, imap_mot_de_passe: e.target.value })
                    }
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={imapForm.imap_actif}
                    onChange={(e) => setImapForm({ ...imapForm, imap_actif: e.target.checked })}
                  />
                  Activer la synchronisation automatique
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={enregistrerConfigImap}
                    disabled={imapEnregistrement}
                    className="text-xs px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                  >
                    {imapEnregistrement ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  {imapMessage && <span className="text-xs">{imapMessage}</span>}
                </div>
              </div>
            </details>

            {messagesRecus.length === 0 ? (
              <p className="text-slate-500 text-sm italic">
                Aucun message reçu pour le moment.
              </p>
            ) : (
              <div className="space-y-3">
                {messagesRecus.map((m) => {
                  const nomCible = Array.isArray(m.targets) ? m.targets[0]?.nom : m.targets?.nom
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-4 space-y-2 ${
                        m.lu ? 'border-slate-700 bg-slate-900' : 'border-accent bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-slate-800">
                            {m.canal === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}
                          </span>
                          <span className="font-semibold text-sm">
                            {nomCible ?? m.expediteur ?? 'Inconnu'}
                          </span>
                          {!m.lu && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-slate-950 font-semibold">
                              Nouveau
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-xs">
                          {new Date(m.created_at).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap">{m.contenu}</p>

                      {!m.lu && (
                        <button
                          onClick={() => marquerCommeLu(m.id)}
                          className="text-xs text-slate-400 underline"
                        >
                          Marquer comme lu
                        </button>
                      )}

                      {m.target_id && (
                        <div className="flex gap-2 pt-1">
                          <input
                            value={reponseTexte[m.id] ?? ''}
                            onChange={(e) =>
                              setReponseTexte((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && repondreMessage(m.id, m.target_id!, m.canal)
                            }
                            placeholder="Écrire une réponse..."
                            className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                          />
                          <button
                            onClick={() => repondreMessage(m.id, m.target_id!, m.canal)}
                            disabled={
                              envoiReponseEnCours === m.id || !reponseTexte[m.id]?.trim()
                            }
                            className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-40"
                          >
                            {envoiReponseEnCours === m.id ? '...' : 'Envoyer'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* ===================== ONGLET STRATEGIE ===================== */}
        {ongletActif === 'catalogue_strategie' && sousOngletGroupe === 'strategie' && (
          <section className="space-y-4">
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              {[
                { id: 'donnees' as const, label: '📝 Remplir les données' },
                { id: 'commercial' as const, label: '📈 Stratégie commerciale' },
                { id: 'marketing' as const, label: '📣 Stratégie marketing' },
              ].map((so) => (
                <button
                  key={so.id}
                  onClick={() => setSousOngletStrategie(so.id)}
                  className={`text-sm px-3 py-1.5 rounded-t-lg ${
                    sousOngletStrategie === so.id
                      ? 'bg-slate-900 text-accent border-b-2 border-accent'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {so.label}
                </button>
              ))}
            </div>

            {sousOngletStrategie === 'donnees' && (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">
                  L'IA se base sur deux sources déjà remplies ailleurs dans la plateforme :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-1">
                    <p className="text-sm font-semibold">
                      📚 {vocabulairePourVertical(verticalSlug).labelCatalogue}
                    </p>
                    <p className="text-xs text-slate-500">
                      {catalogue.length} offre{catalogue.length > 1 ? 's' : ''} renseignée
                      {catalogue.length > 1 ? 's' : ''} — importable en PDF ou saisie manuelle.
                    </p>
                    <button
                      onClick={() => {
                        setSousOngletGroupe('catalogue')
                        setOngletActif('catalogue_strategie')
                      }}
                      className="text-xs text-accent underline"
                    >
                      Aller au catalogue →
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-1">
                    <p className="text-sm font-semibold">🎯 Historique de cibles</p>
                    <p className="text-xs text-slate-500">
                      {targets.length} cible{targets.length > 1 ? 's' : ''} au total — plus il y a
                      de résultats connus (gagné/perdu), plus l'analyse est fiable.
                    </p>
                    <button
                      onClick={() => setOngletActif('cibles')}
                      className="text-xs text-accent underline"
                    >
                      Aller aux cibles →
                    </button>
                  </div>
                </div>
                <button
                  onClick={genererStrategie}
                  disabled={strategieEnCours}
                  className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-50"
                >
                  {strategieEnCours ? 'Analyse en cours...' : '🧭 Générer ma stratégie'}
                </button>
              </div>
            )}

            {sousOngletStrategie === 'commercial' && (
              <div className="space-y-4">
                {!strategieResultat ? (
                  <p className="text-slate-500 text-sm italic">
                    Génère d'abord ta stratégie depuis l'onglet "Remplir les données".
                  </p>
                ) : (
                  <>
                    <div className="rounded-xl border border-accent/40 bg-slate-900 p-4 space-y-2">
                      <p className="text-xs text-accent font-semibold uppercase">📈 Commerciale</p>
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">
                        {strategieResultat.recommandationCommerciale}
                      </p>
                    </div>

                    {strategieResultat.parCanal.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-300">
                          Taux de conversion par canal
                        </h3>
                        {strategieResultat.parCanal.map((a) => (
                          <div
                            key={a.canal}
                            className="flex items-center justify-between text-sm bg-slate-900 border border-slate-700 rounded-lg p-2"
                          >
                            <span>{a.canal}</span>
                            <span className="text-slate-400">
                              {a.gagnes}/{a.total} · {a.taux}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {strategieResultat.parSegment.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-300">
                          Taux de conversion par segment
                        </h3>
                        {strategieResultat.parSegment.map((a) => (
                          <div
                            key={a.canal}
                            className="flex items-center justify-between text-sm bg-slate-900 border border-slate-700 rounded-lg p-2"
                          >
                            <span>{a.canal}</span>
                            <span className="text-slate-400">
                              {a.gagnes}/{a.total} · {a.taux}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {strategieResultat.historique.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <h3 className="text-sm font-semibold text-slate-300">🕓 Historique</h3>
                        {strategieResultat.historique.map((h) => (
                          <details
                            key={h.id}
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2"
                          >
                            <summary className="text-xs text-slate-400 cursor-pointer">
                              {new Date(h.created_at).toLocaleString('fr-FR')}
                            </summary>
                            <div className="mt-2 space-y-1 text-sm">
                              {h.recommandation_commerciale && (
                                <p>
                                  <span className="text-accent">Commercial :</span>{' '}
                                  {h.recommandation_commerciale}
                                </p>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {sousOngletStrategie === 'marketing' && (
              <div className="space-y-4">
                {!strategieResultat?.recommandationMarketing ? (
                  <p className="text-slate-500 text-sm italic">
                    Génère d'abord ta stratégie depuis l'onglet "Remplir les données".
                  </p>
                ) : (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase">📣 Marketing</p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                      {strategieResultat.recommandationMarketing}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===================== ONGLET CATALOGUE ===================== */}
        {ongletActif === 'catalogue_strategie' && sousOngletGroupe === 'catalogue' && (
          <section className="space-y-4">
            <p className="text-slate-400 text-sm">
              {vocabulairePourVertical(verticalSlug).introCatalogue}
            </p>

            <div className="flex items-center gap-3">
              <input
                ref={inputPdfCatalogue}
                type="file"
                accept=".pdf"
                onChange={importerPdfOffre}
                className="hidden"
              />
              <button
                onClick={() => inputPdfCatalogue.current?.click()}
                disabled={pdfEnCours}
                className="text-xs px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-accent disabled:opacity-50"
              >
                {pdfEnCours ? 'Analyse du PDF...' : '📄 Importer un PDF (pré-remplit le formulaire)'}
              </button>
              {pdfUrlTemp && (
                <span className="text-xs text-accent">✓ PDF prêt à être attaché à cette offre</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
              <input
                value={nouvelleOffre.nom}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, nom: e.target.value })}
                placeholder={vocabulairePourVertical(verticalSlug).placeholderNomOffre}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  value={nouvelleOffre.prix}
                  onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, prix: e.target.value })}
                  placeholder="Prix (ex: 450)"
                  type="number"
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <select
                  value={nouvelleOffre.devise}
                  onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, devise: e.target.value })}
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                >
                  <option value="TND">TND</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <input
                value={nouvelleOffre.duree}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, duree: e.target.value })}
                placeholder="Durée (ex: 3 jours)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <select
                value={nouvelleOffre.mode_facturation}
                onChange={(e) =>
                  setNouvelleOffre({ ...nouvelleOffre, mode_facturation: e.target.value })
                }
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">Mode de facturation (optionnel)</option>
                <option value="journee">Tarif journalier (TJM)</option>
                <option value="forfait">Forfait global</option>
                <option value="abonnement_mensuel">Abonnement mensuel</option>
              </select>
              <input
                value={nouvelleOffre.public_cible}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, public_cible: e.target.value })}
                placeholder="Public visé (optionnel)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <textarea
                value={nouvelleOffre.description}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, description: e.target.value })}
                placeholder="Description courte"
                className="md:col-span-2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm h-16"
              />
              <button
                onClick={ajouterOffre}
                disabled={maj || !nouvelleOffre.nom.trim()}
                className="md:col-span-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm py-2 disabled:opacity-40"
              >
                {t('ajouter')}
              </button>
            </div>

            <div className="space-y-2">
              {catalogue.length === 0 ? (
                <p className="text-slate-500 text-sm italic">
                  Aucune offre pour le moment — l'IA invente encore des packs génériques.
                </p>
              ) : (
                catalogue.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {o.nom}
                        {o.prix && <span className="text-accent"> — {o.prix} {o.devise ?? 'TND'}</span>}
                        {o.duree && <span className="text-slate-400 text-sm"> · {o.duree}</span>}
                      </p>
                      {o.description && (
                        <p className="text-slate-400 text-sm mt-1">{o.description}</p>
                      )}
                      {o.public_cible && (
                        <p className="text-slate-500 text-xs mt-1">Public : {o.public_cible}</p>
                      )}
                      {o.pdf_url && (
                        <a
                          href={o.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent underline mt-1 inline-block"
                        >
                          📄 Voir le PDF attaché
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => supprimerOffre(o.id)}
                      className="text-xs text-red-400 hover:text-red-300 underline whitespace-nowrap"
                    >
                      Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ===================== ONGLET COLLABORATION & TACHES ===================== */}
        {ongletActif === 'collaboration' && (
          <section className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">💬 Messages d'équipe</h2>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3 max-h-[420px] overflow-y-auto">
                {messagesEquipe.length === 0 && (
                  <p className="text-slate-500 text-sm italic">
                    Pas encore de message — écrivez le premier ci-dessous.
                  </p>
                )}
                {messagesEquipe.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-semibold text-accent">
                      {m.client_users?.nom_complet ?? 'Membre'}
                    </span>{' '}
                    <span className="text-slate-500 text-xs">
                      {new Date(m.created_at).toLocaleString('fr-FR')}
                    </span>
                    <p className="text-slate-300">{m.contenu}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={nouveauMessageEquipe}
                  onChange={(e) => setNouveauMessageEquipe(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && envoyerMessageEquipe()}
                  placeholder="Écrire un message à l'équipe..."
                  className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <button
                  onClick={envoyerMessageEquipe}
                  disabled={envoiMessageEquipeEnCours || !nouveauMessageEquipe.trim()}
                  className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                >
                  Envoyer
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="font-semibold text-lg">✅ Tâches</h2>
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                <input
                  value={nouvelleTache.titre}
                  onChange={(e) => setNouvelleTache({ ...nouvelleTache, titre: e.target.value })}
                  placeholder="Titre de la tâche"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <textarea
                  value={nouvelleTache.description}
                  onChange={(e) => setNouvelleTache({ ...nouvelleTache, description: e.target.value })}
                  placeholder="Description (optionnel)"
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  rows={2}
                />
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={nouvelleTache.assigne_a}
                    onChange={(e) => setNouvelleTache({ ...nouvelleTache, assigne_a: e.target.value })}
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  >
                    <option value="">Assigner à...</option>
                    {membresEquipe.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom_complet ?? 'Membre'}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={nouvelleTache.echeance}
                    onChange={(e) => setNouvelleTache({ ...nouvelleTache, echeance: e.target.value })}
                    className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                  />
                  <button
                    onClick={creerTache}
                    disabled={creationTacheEnCours || !nouvelleTache.titre.trim()}
                    className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'a_faire' as const, label: 'À faire' },
                    { id: 'en_cours' as const, label: 'En cours' },
                    { id: 'terminee' as const, label: 'Terminée' },
                  ]
                ).map((colonne) => (
                  <div key={colonne.id} className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">{colonne.label}</p>
                    {taches
                      .filter((t) => t.statut === colonne.id)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="rounded-lg border border-slate-700 bg-slate-900 p-2 space-y-1"
                        >
                          <p className="text-sm font-medium">{t.titre}</p>
                          {t.description && (
                            <p className="text-xs text-slate-400">{t.description}</p>
                          )}
                          <p className="text-xs text-slate-500">
                            {t.membre?.nom_complet ?? 'Non assignée'}
                            {t.echeance ? ` · ${new Date(t.echeance).toLocaleDateString('fr-FR')}` : ''}
                          </p>
                          <select
                            value={t.statut}
                            onChange={(e) => majTache(t.id, { statut: e.target.value })}
                            className="w-full text-xs rounded bg-slate-950 border border-slate-700 p-1"
                          >
                            <option value="a_faire">À faire</option>
                            <option value="en_cours">En cours</option>
                            <option value="terminee">Terminée</option>
                          </select>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ===================== ONGLET CALENDRIER ===================== */}
        {ongletActif === 'calendrier' && (
          <section className="space-y-4">
            <p className="text-slate-400 text-sm">
              Rendez-vous clients, événements repérés, appels d'offres — ajoutés manuellement.
              Rien ici n'est lié automatiquement à tes cibles.
            </p>

            {jourSelectionne && (
              <div className="rounded-xl border border-accent/40 bg-slate-900 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-accent">
                    📅 {new Date(jourSelectionne).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  <button
                    onClick={() => setJourSelectionne(null)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    ✕ Désélectionner
                  </button>
                </div>
                {calendrier.filter((c) => c.date_evenement === jourSelectionne).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Rien de prévu ce jour-là — remplis le formulaire ci-dessous pour ajouter.
                  </p>
                ) : (
                  calendrier
                    .filter((c) => c.date_evenement === jourSelectionne)
                    .map((c) => (
                      <p key={c.id} className="text-xs text-slate-300">
                        {c.type === 'rdv' ? '📞' : c.type === 'evenement' ? '🎪' : c.type === 'appel_offre' ? '📋' : '📌'}{' '}
                        {c.titre}
                      </p>
                    ))
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
              <input
                value={nouvelleEntree.titre}
                onChange={(e) => setNouvelleEntree({ ...nouvelleEntree, titre: e.target.value })}
                placeholder="Titre (ex: RDV client X)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <input
                value={nouvelleEntree.date_evenement}
                onChange={(e) =>
                  setNouvelleEntree({ ...nouvelleEntree, date_evenement: e.target.value })
                }
                type="date"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <select
                value={nouvelleEntree.type}
                onChange={(e) =>
                  setNouvelleEntree({
                    ...nouvelleEntree,
                    type: e.target.value as CalendrierEntree['type'],
                  })
                }
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="rdv">📞 Rendez-vous client</option>
                <option value="evenement">🎪 Événement</option>
                <option value="appel_offre">📋 Appel d'offres</option>
                <option value="autre">📌 Autre</option>
              </select>
              <input
                value={nouvelleEntree.lien}
                onChange={(e) => setNouvelleEntree({ ...nouvelleEntree, lien: e.target.value })}
                placeholder="Lien (optionnel)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <textarea
                value={nouvelleEntree.description}
                onChange={(e) =>
                  setNouvelleEntree({ ...nouvelleEntree, description: e.target.value })
                }
                placeholder="Notes (optionnel)"
                className="md:col-span-2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm h-16"
              />
              <button
                onClick={ajouterEntreeCalendrier}
                disabled={maj || !nouvelleEntree.titre.trim() || !nouvelleEntree.date_evenement}
                className="md:col-span-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm py-2 disabled:opacity-40"
              >
                {t('ajouter')}
              </button>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() =>
                    setMoisAffiche(
                      (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)
                    )
                  }
                  className="px-3 py-1 rounded-lg border border-slate-700 text-sm hover:border-accent"
                >
                  ← Précédent
                </button>
                <p className="font-semibold capitalize">
                  {moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </p>
                <button
                  onClick={() =>
                    setMoisAffiche(
                      (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)
                    )
                  }
                  className="px-3 py-1 rounded-lg border border-slate-700 text-sm hover:border-accent"
                >
                  Suivant →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-1">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => (
                  <div key={j}>{j}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {genererGrilleMois(moisAffiche).map(({ date, dansLeMois }) => {
                  const dateStr = formatDateLocale(date)
                  const entreesDuJour = calendrier.filter((c) => c.date_evenement === dateStr)
                  const estAujourdhui = dateStr === formatDateLocale(new Date())
                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setJourSelectionne(dateStr)
                        setNouvelleEntree((prev) => ({ ...prev, date_evenement: dateStr }))
                      }}
                      className={`min-h-[70px] rounded-lg border p-1 text-xs cursor-pointer transition ${
                        dansLeMois ? 'border-slate-700 bg-slate-950 hover:border-accent/60' : 'border-slate-800 bg-slate-900 opacity-40'
                      } ${estAujourdhui ? 'ring-1 ring-accent' : ''} ${
                        jourSelectionne === dateStr ? 'border-accent ring-1 ring-accent' : ''
                      }`}
                    >
                      <p className={`text-right ${estAujourdhui ? 'text-accent font-semibold' : 'text-slate-400'}`}>
                        {date.getDate()}
                      </p>
                      <div className="space-y-0.5 mt-1">
                        {entreesDuJour.map((c) => (
                          <div
                            key={c.id}
                            title={c.titre}
                            className="truncate rounded bg-slate-800 px-1 py-0.5 text-slate-200"
                          >
                            {c.type === 'rdv'
                              ? '📞'
                              : c.type === 'evenement'
                              ? '🎪'
                              : c.type === 'appel_offre'
                              ? '📋'
                              : '📌'}{' '}
                            {c.titre}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">📋 Liste détaillée</h3>
              {calendrier.length === 0 ? (
                <p className="text-slate-500 text-sm italic">Aucune entrée pour le moment.</p>
              ) : (
                calendrier.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {c.type === 'rdv'
                          ? '📞'
                          : c.type === 'evenement'
                          ? '🎪'
                          : c.type === 'appel_offre'
                          ? '📋'
                          : '📌'}{' '}
                        {c.titre}
                        <span className="text-accent text-sm ml-2">
                          {new Date(c.date_evenement).toLocaleDateString('fr-FR')}
                        </span>
                      </p>
                      {c.description && (
                        <p className="text-slate-400 text-sm mt-1">{c.description}</p>
                      )}
                      {c.lien && (
                        <a
                          href={c.lien}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent underline mt-1 inline-block"
                        >
                          🔗 Voir le lien
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => supprimerEntreeCalendrier(c.id)}
                      className="text-xs text-red-400 hover:text-red-300 underline whitespace-nowrap"
                    >
                      Supprimer
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* ===================== ONGLET STATISTIQUES ===================== */}
        {ongletActif === 'stats' && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-400">🌍 Filtrer par zone :</label>
              {[
                { id: 'tous' as const, label: 'Tous les pays' },
                { id: 'tunisie' as const, label: '🇹🇳 Tunisie' },
                { id: 'golfe' as const, label: '🇸🇦 Golfe' },
                { id: 'reste' as const, label: '🌍 Reste du monde' },
              ].map((z) => (
                <button
                  key={z.id}
                  onClick={() => setFiltrePaysStats(z.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border ${
                    filtrePaysStats === z.id
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <p className="text-slate-400 text-sm">{t('cibles_contactees')}</p>
                  <p className="text-3xl font-bold mt-2">{ciblesContactees}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <p className="text-slate-400 text-sm">{t('en_attente_validation')}</p>
                  <p className="text-3xl font-bold mt-2">{diagnosticsEnAttente.length}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <p className="text-slate-400 text-sm">{t('packs_vendus')}</p>
                  <p className="text-3xl font-bold mt-2">{packsVendus.length}</p>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">📈 Taux de performance</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <p className="text-slate-400 text-sm">Taux de réponse</p>
                  <p className="text-3xl font-bold mt-2">
                    {statsPerformance.nbMessagesEnvoyes > 0
                      ? Math.round(
                          (statsPerformance.nbReponses / statsPerformance.nbMessagesEnvoyes) * 100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {statsPerformance.nbReponses} réponses sur {statsPerformance.nbMessagesEnvoyes}{' '}
                    messages envoyés
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <p className="text-slate-400 text-sm">Taux de conversion</p>
                  <p className="text-3xl font-bold mt-2">
                    {statsPerformance.nbDiagnosticsValides > 0
                      ? Math.round(
                          (statsPerformance.nbPacksAcceptes /
                            statsPerformance.nbDiagnosticsValides) *
                            100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-slate-500 text-xs mt-1">
                    {statsPerformance.nbPacksAcceptes} packs acceptés sur{' '}
                    {statsPerformance.nbDiagnosticsValides} diagnostics validés
                  </p>
                </div>
              </div>
            </section>

            {(() => {
              const segments = new Map<string, { total: number; contactes: number }>()
              for (const tg of targets) {
                const key = tg.segment_categorie ?? 'non segmenté'
                const entry = segments.get(key) ?? { total: 0, contactes: 0 }
                entry.total++
                if (tg.statut === 'contacte') entry.contactes++
                segments.set(key, entry)
              }
              const lignes = Array.from(segments.entries())
              if (lignes.length === 0) return null
              return (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">🧩 Répartition par segment</h2>
                  <div className="space-y-2">
                    {lignes.map(([categorie, stats]) => (
                      <div
                        key={categorie}
                        className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                      >
                        <span className="capitalize">{categorie}</span>
                        <span className="text-slate-400">
                          {stats.contactes}/{stats.total} contactées
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}

            {(() => {
              const MS_PAR_JOUR = 1000 * 60 * 60 * 24
              const chauds = targets.filter((tg) => {
                if ((tg.score_chaleur ?? 0) < 70) return false
                if (tg.statut !== 'contacte') return false
                const derniereActivite = tg.derniere_relance_at ?? tg.created_at
                if (!derniereActivite) return false
                const jours = (Date.now() - new Date(derniereActivite).getTime()) / MS_PAR_JOUR
                return jours >= 3
              })
              if (chauds.length === 0) return null
              return (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold text-amber-400">
                    ⚠️ {chauds.length} prospect{chauds.length > 1 ? 's' : ''} chaud
                    {chauds.length > 1 ? 's' : ''} sans relance récente
                  </h2>
                  <div className="space-y-2">
                    {chauds.map((tg) => (
                      <div
                        key={tg.id}
                        className="flex items-center justify-between rounded-lg bg-amber-950/20 border border-amber-900 px-3 py-2 text-sm"
                      >
                        <span>{tg.nom}</span>
                        <span className="text-amber-400 font-semibold">
                          🔥 {tg.score_chaleur}/100
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}

            {membresEquipe.length > 1 &&
              (() => {
                const parCommercial = new Map<
                  string,
                  { total: number; contactes: number; gagnes: number }
                >()
                const targetsPourStats =
                  filtrePaysStats === 'tous'
                    ? targets
                    : targets.filter((tg) => zonePourPays(tg.country) === filtrePaysStats)
                for (const tg of targetsPourStats) {
                  const key = tg.assigne_a ?? '__non_assigne__'
                  const entry = parCommercial.get(key) ?? { total: 0, contactes: 0, gagnes: 0 }
                  entry.total++
                  if (tg.statut !== 'nouveau') entry.contactes++
                  if (tg.etape_pipeline === 'gagne') entry.gagnes++
                  parCommercial.set(key, entry)
                }
                const lignes = Array.from(parCommercial.entries())
                if (lignes.length === 0) return null
                return (
                  <section className="space-y-3">
                    <h2 className="text-lg font-semibold">👤 Stats par commercial</h2>
                    <div className="space-y-2">
                      {lignes.map(([id, stats]) => {
                        const nom =
                          id === '__non_assigne__'
                            ? 'Non assigné'
                            : membresEquipe.find((m) => m.id === id)?.nom_complet || '(sans nom)'
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                          >
                            <span>👤 {nom}</span>
                            <span className="text-slate-400">
                              {stats.contactes}/{stats.total} contactées · 🏆 {stats.gagnes} gagné
                              {stats.gagnes > 1 ? 's' : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })()}

            {(() => {
              const parMois = new Map<string, { total: number; contactes: number }>()
              const targetsPourStats =
                filtrePaysStats === 'tous'
                  ? targets
                  : targets.filter((tg) => zonePourPays(tg.country) === filtrePaysStats)
              for (const tg of targetsPourStats) {
                if (!tg.created_at) continue
                const date = new Date(tg.created_at)
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                const entry = parMois.get(key) ?? { total: 0, contactes: 0 }
                entry.total++
                if (tg.statut !== 'nouveau') entry.contactes++
                parMois.set(key, entry)
              }
              const lignes = Array.from(parMois.entries()).sort(([a], [b]) => (a < b ? 1 : -1))
              if (lignes.length === 0) return null
              const nomsMois = [
                'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
                'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc',
              ]
              return (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">📅 Stats par mois</h2>
                  <div className="space-y-2">
                    {lignes.map(([cle, stats]) => {
                      const [annee, mois] = cle.split('-')
                      const label = `${nomsMois[Number(mois) - 1]} ${annee}`
                      return (
                        <div
                          key={cle}
                          className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                        >
                          <span>{label}</span>
                          <span className="text-slate-400">
                            {stats.contactes}/{stats.total} contactées
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })()}

            {(() => {
              const parZone = new Map<string, { total: number; contactes: number; gagnes: number }>()
              for (const tg of targets) {
                const zone = zonePourPays(tg.country)
                const entry = parZone.get(zone) ?? { total: 0, contactes: 0, gagnes: 0 }
                entry.total++
                if (tg.statut !== 'nouveau') entry.contactes++
                if (tg.etape_pipeline === 'gagne') entry.gagnes++
                parZone.set(zone, entry)
              }
              const labels: Record<string, string> = {
                tunisie: '🇹🇳 Tunisie',
                golfe: '🇸🇦 Golfe',
                reste: '🌍 Reste du monde',
              }
              const lignes = Array.from(parZone.entries())
              if (lignes.length === 0) return null
              return (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold">📍 Stats par zone</h2>
                  <div className="space-y-2">
                    {lignes.map(([zone, stats]) => (
                      <div
                        key={zone}
                        className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                      >
                        <span>{labels[zone] ?? zone}</span>
                        <span className="text-slate-400">
                          {stats.contactes}/{stats.total} contactées · 🏆 {stats.gagnes} gagné
                          {stats.gagnes > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })()}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">📤 Export</h2>
              <button
                onClick={() => {
                  const entetes = ['nom', 'entreprise', 'telephone', 'email', 'pays', 'statut', 'segment', 'urgence', 'score']
                  const lignes = targets.map((tg) =>
                    [
                      tg.nom,
                      tg.entreprise_ou_objectif ?? '',
                      tg.telephone ?? '',
                      tg.email ?? '',
                      tg.country ?? '',
                      tg.statut,
                      tg.segment_categorie ?? '',
                      tg.segment_urgence ?? '',
                      String(tg.score_chaleur ?? ''),
                    ]
                      .map((valeur) => `"${String(valeur).replace(/"/g, '""')}"`)
                      .join(',')
                  )
                  const csv = [entetes.join(','), ...lignes].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const lien = document.createElement('a')
                  lien.href = url
                  lien.download = `cibles-${new Date().toISOString().slice(0, 10)}.csv`
                  lien.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-sm px-4 py-2 rounded-lg bg-slate-800 border border-slate-600"
              >
                📥 Exporter mes cibles en CSV
              </button>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">{t('packs_vendus')} — détail</h2>
              {packsVendus.length === 0 ? (
                <p className="text-slate-500 text-sm italic">Aucun pack vendu pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {packsVendus.map((pack) => (
                    <div
                      key={pack.id}
                      className="rounded-xl border border-accent/40 bg-slate-900 p-4 flex items-center justify-between"
                    >
                      <p className="font-semibold">{pack.pack_propose_nom}</p>
                      <p className="text-accent font-bold">{pack.prix_pack} TND/EUR</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        </div>
      </div>
    </main>
  )
}
