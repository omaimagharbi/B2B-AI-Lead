'use client'

import { Fragment, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'
import { SECTEURS_DISPONIBLES } from '@/lib/secteurs'
import { professionsDisponibles, PROFILS_PARTICULIER } from '@/lib/professions'
import { traduire, type Langue } from '@/lib/i18n'
import { templatesPourVertical } from '@/lib/templates'
import { vocabulairePourVertical, etapesPipelinePourVertical } from '@/lib/vocabulaire'
import { zonePourPays } from '@/lib/pays'
import ValidationItem from './validation-item'
import DropdownMultiSelect from './dropdown-multiselect'
import ChatbotWidget from '@/components/ChatbotWidget'
import PhoneInput, { decouperTelephone } from '@/components/PhoneInput'

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
  taux_closing_historique?: number | null
  mots_cles_expertise?: string | null
  idees_recues_marche?: string | null
  motifs_rejet_passes?: string | null
  canaux_echoues?: string | null
  volume_equipe_commerciale?: string | null
  positionnement_site?: string | null
  ligne_editoriale_reseaux?: string | null
  derniere_analyse_cabinet_at?: string | null
  token_badge_public?: string | null
  taille_min_salaries?: number | null
  taille_max_salaries?: number | null
  portee_geographique?: string | null
  villes_ciblees?: string | null
  reseaux_actifs?: { linkedin?: boolean; facebook?: boolean; instagram?: boolean } | null
  blog_actif?: boolean | null
  base_email_existante?: string | null
  budget_publicitaire?: string | null
  objectif_chiffre?: string | null
  onglets_autorises?: string[] | null
  verticals_autorises?: string[] | null
  vertical_id?: string | null
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
  motif_refus?: string | null
  dernier_canal_contact?: string | null
}

type DiagnosticEnAttente = {
  id: string
  token_acces: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: any
  recommandations_json: any
  lien_ouvert_at: string | null
  commentaire_expert?: string | null
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
  thematique: string | null
  format: string | null
  mode_delivrance: string | null
  usp: string | null
}

type CalendrierEntree = {
  id: string
  titre: string
  description: string | null
  date_evenement: string
  type: 'rdv' | 'evenement' | 'appel_offre' | 'autre'
  lien: string | null
  heure_debut: string | null
  duree_minutes: number | null
  lieu: string | null
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
  const [notifOuvertes, setNotifOuvertes] = useState(false)
  const [cibleEditionOuverte, setCibleEditionOuverte] = useState<string | null>(null)
  const [formEditionCible, setFormEditionCible] = useState({
    nom: '',
    telephone: '',
    email: '',
    country: '',
    entreprise_ou_objectif: '',
  })
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
  const [vueCalendrier, setVueCalendrier] = useState<'mois' | 'semaine' | 'jour'>('mois')
  const [jourAffiche, setJourAffiche] = useState(() => new Date())
  const [semaineAffichee, setSemaineAffichee] = useState(() => {
    const d = new Date()
    const decalage = (d.getDay() + 6) % 7 // lundi en premier
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - decalage)
  })
  const [nouvelleEntree, setNouvelleEntree] = useState({
    titre: '',
    description: '',
    date_evenement: '',
    type: 'rdv' as CalendrierEntree['type'],
    lien: '',
    heure_debut: '',
    duree_minutes: '60',
    lieu: '',
  })
  const [nouvelleOffre, setNouvelleOffre] = useState({
    nom: '',
    description: '',
    prix: '',
    devise: 'TND',
    duree: '',
    public_cible: '',
    mode_facturation: '',
    thematique: '',
    format: '',
    mode_delivrance: '',
    usp: '',
  })
  const [pdfUrlTemp, setPdfUrlTemp] = useState<string | null>(null)
  const [pdfEnCours, setPdfEnCours] = useState(false)
  const [offreEnEdition, setOffreEnEdition] = useState<string | null>(null)
  const [editionOffreForm, setEditionOffreForm] = useState<{
    nom: string
    description: string
    prix: string
    devise: string
    duree: string
    public_cible: string
    thematique: string
    format: string
    mode_delivrance: string
    usp: string
  }>({
    nom: '',
    description: '',
    prix: '',
    devise: 'TND',
    duree: '',
    public_cible: '',
    thematique: '',
    format: '',
    mode_delivrance: '',
    usp: '',
  })
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
    filtresRecommandes: { postes: string[]; secteur: string; taille: string } | null
    scriptAppel: string | null
    scriptLinkedin: string | null
    guideQualification: string[]
    ligneEditoriale: string | null
    leadMagnets: string[]
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
  const [inputsStrategiques, setInputsStrategiques] = useState({
    taux_closing_historique: '',
    mots_cles_expertise: '',
    idees_recues_marche: '',
    motifs_rejet_passes: '',
    canaux_echoues: '',
    volume_equipe_commerciale: '',
    linkedin_actif: false,
    facebook_actif: false,
    instagram_actif: false,
    blog_actif: false,
    base_email_existante: '',
    budget_publicitaire: '',
    objectif_chiffre: '',
    taille_min_salaries: '',
    taille_max_salaries: '',
    portee_geographique: '',
    villes_ciblees: '',
  })
  const [inputsStrategiquesEnCours, setInputsStrategiquesEnCours] = useState(false)
  const [analyseCabinetEnCours, setAnalyseCabinetEnCours] = useState(false)
  const [erreurAnalyseCabinet, setErreurAnalyseCabinet] = useState<string | null>(null)
  const [calendrierEditorial, setCalendrierEditorial] = useState<
    { id: string; semaine: number; theme: string; format_suggere: string; angle_accroche: string; statut: string }[]
  >([])
  const [matriceContreObjection, setMatriceContreObjection] = useState<
    { id: string; objection: string; angle_contenu: string; format_suggere: string }[]
  >([])
  const [calendrierEnCours, setCalendrierEnCours] = useState(false)
  const [erreurCalendrier, setErreurCalendrier] = useState<string | null>(null)
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
    {
      id: string
      nom_complet: string | null
      role: string
      telephone: string | null
      email?: string | null
      onglets_masques: string[]
      photo_url?: string | null
    }[]
  >([])
  const [mesOngletsMasques, setMesOngletsMasques] = useState<string[]>([])
  const [membreEnEdition, setMembreEnEdition] = useState<string | null>(null)
  const [editionMembreForm, setEditionMembreForm] = useState({
    nom_complet: '',
    indicatifTelephone: '+216',
    telephone: '',
  })
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
      cible_id?: string | null
      membre: { nom_complet: string | null } | null
      createur: { nom_complet: string | null } | null
      cible?: { nom: string } | null
    }[]
  >([])
  const [nouvelleTache, setNouvelleTache] = useState({ titre: '', description: '', assigne_a: '', echeance: '' })
  const [creationTacheEnCours, setCreationTacheEnCours] = useState(false)
  const [collaborationChargee, setCollaborationChargee] = useState(false)
  const [popoverPipelineOuvert, setPopoverPipelineOuvert] = useState<string | null>(null)
  const [popoverPipelineForm, setPopoverPipelineForm] = useState({ assigne_a: '', consigne: '' })

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
        'id, nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, statut, etape_pipeline, segment_categorie, segment_urgence, score_chaleur, nb_relances, derniere_relance_at, created_at, assigne_a, signal_ia, reponse_sentiment, reponse_a_traiter, motif_refus, dernier_canal_contact'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setTargets(targetsData ?? [])

    const { data: diagData } = await supabase
      .from('diagnostics')
      .select(
        'id, token_acces, phrase_brute_prospect, json_ia_brouillon, recommandations_json, lien_ouvert_at, commentaire_expert, targets(nom)'
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
      .select('id, nom, description, prix, devise, duree, public_cible, pdf_url, mode_facturation, thematique, format, mode_delivrance, usp')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setCatalogue((catalogueData ?? []) as OffreCatalogue[])

    const { data: calendrierData } = await supabase
      .from('calendrier_entrees')
      .select('id, titre, description, date_evenement, type, lien, heure_debut, duree_minutes, lieu')
      .eq('client_id', clientId)
      .order('date_evenement', { ascending: true })
      .order('heure_debut', { ascending: true })
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
      .select('id, nom_complet, role, telephone, email, onglets_masques, photo_url')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setMembresEquipe((membresData ?? []) as typeof membresEquipe)

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
        .select('id, client_id, role, onglets_masques')
        .eq('auth_user_id', userData.user.id)
        .single()

      if (!clientUser) {
        setChargement(false)
        return
      }
      setMonClientUserId(clientUser.id)
      setMonRole(clientUser.role ?? 'membre')
      setMesOngletsMasques((clientUser.onglets_masques as string[]) ?? [])

      const { data: clientData } = await supabase
        .from('clients')
        .select(
          'id, nom_entreprise, statut_abonnement, mode_ciblage, secteur_activite, taille_entreprise, canal_sourcing, profil_particulier, message_personnalise, logo_url, langue_preferee, imap_host, imap_port, imap_utilisateur, imap_secure, imap_actif, imap_derniere_sync_at, imap_derniere_erreur, acces_active, onboarding_complete, whatsapp_directeur, whatsapp_equipe, facebook_url, instagram_url, linkedin_url, site_web, onglets_masques_equipe, taux_closing_historique, mots_cles_expertise, idees_recues_marche, motifs_rejet_passes, canaux_echoues, volume_equipe_commerciale, positionnement_site, ligne_editoriale_reseaux, derniere_analyse_cabinet_at, token_badge_public, taille_min_salaries, taille_max_salaries, portee_geographique, villes_ciblees, reseaux_actifs, blog_actif, base_email_existante, budget_publicitaire, objectif_chiffre, onglets_autorises, verticals_autorises, vertical_id, verticals(slug)'
        )
        .eq('id', clientUser.client_id)
        .single()

      if (clientData) {
        setClient(clientData as unknown as Client)
        setSecteurInput((clientData as unknown as Client).secteur_activite ?? '')
        const cd = clientData as unknown as Client
        setPresenceDigitale({
          site_web: cd.site_web ?? '',
          facebook_url: cd.facebook_url ?? '',
          instagram_url: cd.instagram_url ?? '',
          linkedin_url: cd.linkedin_url ?? '',
        })
        setInputsStrategiques({
          taux_closing_historique: cd.taux_closing_historique?.toString() ?? '',
          mots_cles_expertise: cd.mots_cles_expertise ?? '',
          idees_recues_marche: cd.idees_recues_marche ?? '',
          motifs_rejet_passes: cd.motifs_rejet_passes ?? '',
          canaux_echoues: cd.canaux_echoues ?? '',
          volume_equipe_commerciale: cd.volume_equipe_commerciale ?? '',
          linkedin_actif: cd.reseaux_actifs?.linkedin ?? false,
          facebook_actif: cd.reseaux_actifs?.facebook ?? false,
          instagram_actif: cd.reseaux_actifs?.instagram ?? false,
          blog_actif: cd.blog_actif ?? false,
          base_email_existante: cd.base_email_existante ?? '',
          budget_publicitaire: cd.budget_publicitaire ?? '',
          objectif_chiffre: cd.objectif_chiffre ?? '',
          taille_min_salaries: cd.taille_min_salaries?.toString() ?? '',
          taille_max_salaries: cd.taille_max_salaries?.toString() ?? '',
          portee_geographique: cd.portee_geographique ?? '',
          villes_ciblees: cd.villes_ciblees ?? '',
        })
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
        await chargerCalendrierEditorial()
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

  const enregistrerInputsStrategiques = async () => {
    if (!client) return
    setInputsStrategiquesEnCours(true)
    const maj = {
      taux_closing_historique: inputsStrategiques.taux_closing_historique
        ? Number(inputsStrategiques.taux_closing_historique)
        : null,
      mots_cles_expertise: inputsStrategiques.mots_cles_expertise.trim() || null,
      idees_recues_marche: inputsStrategiques.idees_recues_marche.trim() || null,
      motifs_rejet_passes: inputsStrategiques.motifs_rejet_passes.trim() || null,
      canaux_echoues: inputsStrategiques.canaux_echoues.trim() || null,
      volume_equipe_commerciale: inputsStrategiques.volume_equipe_commerciale.trim() || null,
      reseaux_actifs: {
        linkedin: inputsStrategiques.linkedin_actif,
        facebook: inputsStrategiques.facebook_actif,
        instagram: inputsStrategiques.instagram_actif,
      },
      blog_actif: inputsStrategiques.blog_actif,
      base_email_existante: inputsStrategiques.base_email_existante.trim() || null,
      budget_publicitaire: inputsStrategiques.budget_publicitaire || null,
      objectif_chiffre: inputsStrategiques.objectif_chiffre.trim() || null,
      taille_min_salaries: inputsStrategiques.taille_min_salaries
        ? Number(inputsStrategiques.taille_min_salaries)
        : null,
      taille_max_salaries: inputsStrategiques.taille_max_salaries
        ? Number(inputsStrategiques.taille_max_salaries)
        : null,
      portee_geographique: inputsStrategiques.portee_geographique || null,
      villes_ciblees: inputsStrategiques.villes_ciblees.trim() || null,
    }
    await supabase.from('clients').update(maj).eq('id', client.id)
    setClient({ ...client, ...maj })
    setInputsStrategiquesEnCours(false)
  }

  const analyserSiteCabinet = async () => {
    if (!client) return
    setAnalyseCabinetEnCours(true)
    setErreurAnalyseCabinet(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/cabinet/analyser-site', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) {
      setErreurAnalyseCabinet(data.error ?? "Erreur lors de l'analyse")
    } else {
      setClient({
        ...client,
        positionnement_site: data.positionnement_site,
        derniere_analyse_cabinet_at: new Date().toISOString(),
      })
    }
    setAnalyseCabinetEnCours(false)
  }

  const chargerCalendrierEditorial = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/marketing/calendrier-editorial', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setCalendrierEditorial(data.calendrier ?? [])
      setMatriceContreObjection(data.matrice ?? [])
    }
  }

  const genererCalendrierEditorial = async () => {
    setCalendrierEnCours(true)
    setErreurCalendrier(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/marketing/calendrier-editorial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (!res.ok) {
      setErreurCalendrier(data.error ?? 'Erreur lors de la génération')
    } else {
      await chargerCalendrierEditorial()
    }
    setCalendrierEnCours(false)
  }

  const basculerStatutCalendrier = async (id: string, statutActuel: string) => {
    const nouveauStatut = statutActuel === 'publie' ? 'a_faire' : 'publie'
    setCalendrierEditorial((prev) => prev.map((e) => (e.id === id ? { ...e, statut: nouveauStatut } : e)))
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/marketing/calendrier-editorial', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, statut: nouveauStatut }),
    })
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

  // Vue semaine façon Google Calendar : 7 colonnes (lundi->dimanche) avec une
  // grille horaire, les entrées sans heure sont listées en haut ("journée").
  const genererJoursSemaine = (debutSemaine: Date) => {
    const jours: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(debutSemaine)
      d.setDate(debutSemaine.getDate() + i)
      jours.push(d)
    }
    return jours
  }
  const HEURES_AFFICHEES = Array.from({ length: 13 }, (_, i) => 7 + i) // 7h -> 19h

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

  // Popover "Assigner / consigne" ouvert au clic sur une carte du Pipeline :
  // assigne le prospect a un commercial et cree en meme temps une tache liee
  // a sa fiche, visible dans Collaboration & Tâches et dans le compteur de
  // la cloche du commercial concerne.
  const validerPopoverPipeline = async (cible: Target) => {
    if (popoverPipelineForm.assigne_a) {
      await assignerCible(cible.id, popoverPipelineForm.assigne_a)
    }
    if (popoverPipelineForm.consigne.trim()) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/collaboration/taches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          titre: `${cible.nom} — ${popoverPipelineForm.consigne.trim().slice(0, 60)}`,
          description: popoverPipelineForm.consigne.trim(),
          assigne_a: popoverPipelineForm.assigne_a || null,
          cible_id: cible.id,
        }),
      })
      const data = await res.json()
      if (res.ok) setTaches((prev) => [data.tache, ...prev])
    }
    setPopoverPipelineOuvert(null)
    setPopoverPipelineForm({ assigne_a: '', consigne: '' })
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

  // Retour terrain : "les messages n'arrivent pas à temps, il faut rafraîchir".
  // Pas de vraie synchro temps reel (Supabase Realtime demanderait d'activer
  // une publication dediee) - on se contente d'un polling leger toutes les
  // 5 secondes tant que l'onglet Collaboration est ouvert, ce qui suffit
  // largement pour une messagerie d'equipe interne a faible volume.
  useEffect(() => {
    if (ongletActif !== 'collaboration') return
    const intervalle = setInterval(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/collaboration/messages', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) setMessagesEquipe(data.messages ?? [])
    }, 5000)
    return () => clearInterval(intervalle)
  }, [ongletActif])

  useEffect(() => {
    if (monClientUserId && !collaborationChargee) {
      chargerCollaboration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monClientUserId])

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

  // Retour terrain : site_web/facebook_url/instagram_url/linkedin_url n'etaient
  // modifiables qu'une seule fois, pendant l'assistant de premiere connexion -
  // aucun moyen de les ajouter/corriger ensuite. On ajoute une edition
  // permanente dans Equipe & Parametres.
  const [presenceDigitale, setPresenceDigitale] = useState({
    site_web: '',
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
  })
  const [presenceDigitaleEnCours, setPresenceDigitaleEnCours] = useState(false)
  const [presenceDigitaleMessage, setPresenceDigitaleMessage] = useState<string | null>(null)

  const enregistrerPresenceDigitale = async () => {
    if (!client) return
    setPresenceDigitaleEnCours(true)
    setPresenceDigitaleMessage(null)
    const maj = {
      site_web: presenceDigitale.site_web.trim() || null,
      facebook_url: presenceDigitale.facebook_url.trim() || null,
      instagram_url: presenceDigitale.instagram_url.trim() || null,
      linkedin_url: presenceDigitale.linkedin_url.trim() || null,
    }
    const { error } = await supabase.from('clients').update(maj).eq('id', client.id)
    if (error) {
      setPresenceDigitaleMessage("Erreur lors de l'enregistrement.")
    } else {
      setClient({ ...client, ...maj })
      setPresenceDigitaleMessage('✅ Enregistré.')
    }
    setPresenceDigitaleEnCours(false)
  }

  const [uploadPhotoEnCours, setUploadPhotoEnCours] = useState<string | null>(null)
  const [lienBadgeCopie, setLienBadgeCopie] = useState(false)

  // navigator.clipboard.writeText() peut echouer silencieusement (contexte
  // non securise, permission refusee, iframe...) sans jamais le signaler a
  // l'utilisateur - "le bouton copier le lien ne fonctionne pas". On ajoute
  // un retour visuel + un repli manuel si l'API echoue.
  const copierLienBadge = async (lien: string) => {
    try {
      await navigator.clipboard.writeText(lien)
      setLienBadgeCopie(true)
      setTimeout(() => setLienBadgeCopie(false), 2500)
    } catch {
      alert("La copie automatique a échoué (autorisation refusée par le navigateur). Sélectionne le texte dans le champ ci-dessus et copie-le manuellement (Ctrl+C).")
    }
  }

  const uploaderPhotoProfil = async (membreId: string, fichier: File) => {
    if (!client) return
    setUploadPhotoEnCours(membreId)
    try {
      const chemin = `${client.id}/${membreId}-${Date.now()}.${fichier.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(chemin, fichier)
      if (uploadError) {
        alert("Échec de l'upload de la photo")
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(chemin)
      await modifierMembre(membreId, { photo_url: urlData.publicUrl })
    } finally {
      setUploadPhotoEnCours(null)
    }
  }

  const modifierMembre = async (
    id: string,
    changements: {
      nom_complet?: string
      telephone?: string | null
      onglets_masques?: string[]
      photo_url?: string | null
    }
  ) => {
    setMembresEquipe((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...changements } as typeof m : m))
    )
    if (id === monClientUserId && changements.onglets_masques !== undefined) {
      setMesOngletsMasques(changements.onglets_masques)
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    await fetch('/api/team/modifier', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...changements }),
    })
  }

  const basculerOngletMasqueMembre = (membre: { id: string; onglets_masques: string[] }, ongletId: string) => {
    const actuel = membre.onglets_masques ?? []
    const nouveau = actuel.includes(ongletId)
      ? actuel.filter((id) => id !== ongletId)
      : [...actuel, ongletId]
    modifierMembre(membre.id, { onglets_masques: nouveau })
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
    // Des qu'une cible quitte l'etape "nouveau" (contacte, qualifie, etc.), on
    // la fait aussi sortir de l'onglet "Cibles" (qui ne montre que statut='nouveau')
    // pour qu'elle ne vive plus que dans le Pipeline — evite les doublons.
    const majStatut = etape === 'nouveau' ? 'nouveau' : 'contacte'
    await supabase
      .from('targets')
      .update({ etape_pipeline: etape, statut: majStatut })
      .eq('id', targetId)
    setTargets((prev) =>
      prev.map((tg) =>
        tg.id === targetId ? { ...tg, etape_pipeline: etape, statut: majStatut } : tg
      )
    )
  }

  // Chemin C ("refus intelligent") : quand le commercial precise pourquoi le
  // prospect a refuse, on planifie automatiquement une relance de courtoisie
  // dans Mon Calendrier (delai selon le motif) au lieu d'abandonner la fiche.
  const DELAI_RECONTACT_JOURS: Record<string, number> = {
    'Pas de budget': 90,
    'Pas le moment': 30,
    "Plus le bon interlocuteur": 60,
    Autre: 60,
  }

  const enregistrerMotifRefus = async (target: Target, motif: string) => {
    setTargets((prev) =>
      prev.map((tg) => (tg.id === target.id ? { ...tg, motif_refus: motif } : tg))
    )
    await supabase
      .from('targets')
      .update({ motif_refus: motif, reponse_a_traiter: false })
      .eq('id', target.id)

    if (!client) return
    const delaiJours = DELAI_RECONTACT_JOURS[motif] ?? 60
    const dateRecontact = new Date()
    dateRecontact.setDate(dateRecontact.getDate() + delaiJours)

    const { data } = await supabase
      .from('calendrier_entrees')
      .insert({
        client_id: client.id,
        titre: `Recontacter ${target.nom}`,
        description: `Motif du refus précédent : ${motif}. Relance de courtoisie basée sur du contenu de valeur (pas une offre directe).`,
        date_evenement: dateRecontact.toISOString().slice(0, 10),
        type: 'rdv',
      })
      .select('id, titre, description, date_evenement, type, lien, heure_debut, duree_minutes, lieu')
      .single()

    if (data) {
      setCalendrier((prev) =>
        [...prev, data as CalendrierEntree].sort((a, b) =>
          a.date_evenement.localeCompare(b.date_evenement)
        )
      )
    }
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

  const ouvrirEditionCible = (target: Target) => {
    setFormEditionCible({
      nom: target.nom ?? '',
      telephone: target.telephone ?? '',
      email: target.email ?? '',
      country: target.country ?? '',
      entreprise_ou_objectif: target.entreprise_ou_objectif ?? '',
    })
    setCibleEditionOuverte(target.id)
  }

  const enregistrerEditionCible = async (targetId: string) => {
    const maj = {
      nom: formEditionCible.nom.trim(),
      telephone: formEditionCible.telephone.trim() || null,
      email: formEditionCible.email.trim() || null,
      country: formEditionCible.country || null,
      entreprise_ou_objectif: formEditionCible.entreprise_ou_objectif.trim() || null,
    }
    await supabase.from('targets').update(maj).eq('id', targetId)
    setTargets((prev) => prev.map((tg) => (tg.id === targetId ? { ...tg, ...maj } : tg)))
    setCibleEditionOuverte(null)
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

    let echecs = 0
    let dernierMessageErreur = ''
    for (const targetId of ciblesSelectionnees) {
      try {
        const res = await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId, type_envoi: typeEnvoi }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          echecs += 1
          dernierMessageErreur = data?.error ?? 'erreur inconnue'
        }
      } catch {
        echecs += 1
        dernierMessageErreur = 'erreur réseau'
      }
    }

    if (echecs > 0) {
      alert(
        `${echecs} envoi(s) sur ${ciblesSelectionnees.size} ont échoué (ex: ${dernierMessageErreur}). Les cibles concernées restent dans "Cibles" — vérifie leur téléphone/email.`
      )
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
          data.emailEnvoye
            ? `✅ Compte créé pour ${inviteEmail} — ses identifiants lui ont été envoyés automatiquement par email.`
            : `✅ Compte créé pour ${inviteEmail}, mais l'email automatique a échoué — transmets-lui toi-même le mot de passe temporaire : ${data.motDePasseTemporaire}`
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

  const [filtresAppliquesEnCours, setFiltresAppliquesEnCours] = useState(false)
  const [filtresAppliquesMessage, setFiltresAppliquesMessage] = useState<string | null>(null)

  const appliquerFiltresRecommandes = async () => {
    if (!strategieResultat?.filtresRecommandes) return
    setFiltresAppliquesEnCours(true)
    setFiltresAppliquesMessage(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const res = await fetch('/api/strategie/appliquer-filtres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(strategieResultat.filtresRecommandes),
      })
      if (res.ok) {
        setFiltresAppliquesMessage('✅ Filtres appliqués à l\'onglet Ciblage.')
        // Recharge le client pour refleter secteur/taille mis a jour, et les
        // postes cibles (client_professions) - reutilise la logique de charger().
        const { data: clientMaj } = await supabase
          .from('clients')
          .select('secteur_activite, taille_entreprise')
          .eq('id', client?.id)
          .single()
        if (clientMaj && client) {
          setClient({ ...client, ...clientMaj })
          setSecteurInput(clientMaj.secteur_activite ?? '')
        }
        const { data: professionsData } = await supabase
          .from('client_professions')
          .select('profession')
          .eq('client_id', client?.id)
        setProfessionsSelectionnees(new Set((professionsData ?? []).map((p) => p.profession)))
      } else {
        setFiltresAppliquesMessage("Erreur lors de l'application des filtres.")
      }
    } catch {
      setFiltresAppliquesMessage("Erreur lors de l'application des filtres.")
    }
    setFiltresAppliquesEnCours(false)
  }

  const FORMATS_CATALOGUE_ACCEPTES = '.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp'

  const importerPdfOffre = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier || !client) return

    setPdfEnCours(true)
    try {
      // 1. Upload dans Supabase Storage (tous types de fichiers de catalogue)
      const chemin = `${client.id}/${Date.now()}-${fichier.name}`
      const { error: uploadError } = await supabase.storage
        .from('catalogue-pdfs')
        .upload(chemin, fichier)

      if (uploadError) {
        alert("Échec de l'upload du fichier")
        setPdfEnCours(false)
        return
      }

      const { data: urlData } = supabase.storage.from('catalogue-pdfs').getPublicUrl(chemin)
      setPdfUrlTemp(urlData.publicUrl)

      // 2. Extraction IA pour pré-remplir le formulaire (PDF, Word, image ou texte)
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
        body: JSON.stringify({
          fichier_base64: base64,
          mime_type: fichier.type,
          nom_fichier: fichier.name,
        }),
      })
      const data = await res.json()

      if (res.ok && Array.isArray(data.offres) && data.offres.length > 0) {
        if (data.offres.length === 1) {
          // Une seule offre detectee : on pre-remplit le formulaire pour
          // relecture avant ajout, comme avant.
          const champs = data.offres[0]
          setNouvelleOffre({
            nom: champs.nom ?? '',
            description: champs.description ?? '',
            prix: champs.prix ? String(champs.prix) : '',
            devise: 'TND',
            duree: champs.duree ?? '',
            public_cible: champs.public_cible ?? '',
            mode_facturation: '',
            thematique: champs.thematique ?? '',
            format: champs.format ?? '',
            mode_delivrance: champs.mode_delivrance ?? '',
            usp: champs.usp ?? '',
          })
        } else {
          // Plusieurs offres detectees dans un seul document (vrai catalogue) :
          // on les ajoute toutes directement, plutot que de forcer une saisie
          // manuelle offre par offre.
          const lignes = data.offres.map((champs: Record<string, unknown>) => ({
            client_id: client.id,
            nom: (champs.nom as string) ?? 'Offre sans nom',
            description: (champs.description as string) ?? null,
            prix: champs.prix ? Number(champs.prix) : null,
            devise: 'TND',
            duree: (champs.duree as string) ?? null,
            public_cible: (champs.public_cible as string) ?? null,
            thematique: (champs.thematique as string) ?? null,
            format: (champs.format as string) ?? null,
            mode_delivrance: (champs.mode_delivrance as string) ?? null,
            usp: (champs.usp as string) ?? null,
            pdf_url: urlData.publicUrl,
          }))
          const { data: inserees } = await supabase
            .from('catalogue_offres')
            .insert(lignes)
            .select(
              'id, nom, description, prix, devise, duree, public_cible, pdf_url, mode_facturation, thematique, format, mode_delivrance, usp'
            )
          if (inserees) setCatalogue((prev) => [...(inserees as OffreCatalogue[]), ...prev])
          alert(`${data.offres.length} offres importées automatiquement depuis le catalogue.`)
        }
      } else {
        alert(
          "Le fichier a bien été attaché, mais l'extraction automatique a échoué (" +
            (data.error ?? 'erreur inconnue') +
            '). Remplis au moins le champ "Nom" ci-dessous puis clique sur "Ajouter l\'offre" — le fichier reste attaché.'
        )
      }
    } catch {
      alert("Erreur lors de l'import du fichier")
    }
    setPdfEnCours(false)
    if (inputPdfCatalogue.current) inputPdfCatalogue.current.value = ''
  }

  const ajouterOffre = async () => {
    if (!client) return
    if (!nouvelleOffre.nom.trim()) {
      alert('Le nom de l\'offre est obligatoire pour l\'ajouter au catalogue.')
      return
    }
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
        thematique: nouvelleOffre.thematique.trim() || null,
        format: nouvelleOffre.format || null,
        mode_delivrance: nouvelleOffre.mode_delivrance || null,
        usp: nouvelleOffre.usp.trim() || null,
        pdf_url: pdfUrlTemp,
      })
      .select(
        'id, nom, description, prix, devise, duree, public_cible, pdf_url, mode_facturation, thematique, format, mode_delivrance, usp'
      )
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
      thematique: '',
      format: '',
      mode_delivrance: '',
      usp: '',
    })
    setPdfUrlTemp(null)
    setMaj(false)
  }

  const supprimerOffre = async (id: string) => {
    await supabase.from('catalogue_offres').delete().eq('id', id)
    setCatalogue((prev) => prev.filter((o) => o.id !== id))
  }

  const modifierOffre = async (id: string, champs: Partial<OffreCatalogue>) => {
    setCatalogue((prev) => prev.map((o) => (o.id === id ? { ...o, ...champs } : o)))
    await supabase
      .from('catalogue_offres')
      .update({
        nom: champs.nom,
        description: champs.description,
        prix: champs.prix,
        devise: champs.devise,
        duree: champs.duree,
        public_cible: champs.public_cible,
        thematique: champs.thematique,
        format: champs.format,
        mode_delivrance: champs.mode_delivrance,
        usp: champs.usp,
      })
      .eq('id', id)
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
        heure_debut: nouvelleEntree.heure_debut || null,
        duree_minutes: nouvelleEntree.heure_debut ? Number(nouvelleEntree.duree_minutes) || 60 : null,
        lieu: nouvelleEntree.lieu.trim() || null,
      })
      .select('id, titre, description, date_evenement, type, lien, heure_debut, duree_minutes, lieu')
      .single()
    if (data) {
      setCalendrier((prev) =>
        [...prev, data as CalendrierEntree].sort((a, b) =>
          a.date_evenement === b.date_evenement
            ? (a.heure_debut ?? '').localeCompare(b.heure_debut ?? '')
            : a.date_evenement.localeCompare(b.date_evenement)
        )
      )
    }
    setNouvelleEntree({
      titre: '',
      description: '',
      date_evenement: '',
      type: 'rdv',
      lien: '',
      heure_debut: '',
      duree_minutes: '60',
      lieu: '',
    })
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
    {
      id: 'validation',
      label: `${t('onglet_validation')}${diagnosticsEnAttente.length > 0 ? ` (${diagnosticsEnAttente.length})` : ''}`,
      icone: '🛠️',
    },
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
  ]
    .filter((onglet): onglet is { id: Onglet; label: string; icone: string } => {
      // Restriction admin (au niveau du compte entier) : s'applique a tout le
      // monde, y compris le proprietaire - contrairement au masquage par
      // membre ci-dessous, que le proprietaire controle lui-meme.
      if (client?.onglets_autorises && !client.onglets_autorises.includes(onglet.id)) return false
      if (monRole === 'proprietaire' || monRole === 'admin') return true
      return !mesOngletsMasques.includes(onglet.id)
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
          <div className="relative">
            <button
              onClick={() => setNotifOuvertes((v) => !v)}
              title="Notifications"
              className="relative text-lg"
            >
              🔔
              {(() => {
                const mesTachesEnAttente = taches.filter(
                  (tc) => tc.assigne_a === monClientUserId && tc.statut !== 'terminee'
                ).length
                const messagesNonLus = messagesRecus.filter((m) => !m.lu).length
                const diagnosticsAValider = diagnosticsEnAttente.length
                const reponsesATraiter = targets.filter((tg) => tg.reponse_a_traiter).length
                const total = mesTachesEnAttente + messagesNonLus + diagnosticsAValider + reponsesATraiter
                return total > 0 ? (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {total > 9 ? '9+' : total}
                  </span>
                ) : null
              })()}
            </button>
            {notifOuvertes && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 p-2 space-y-1">
                {(() => {
                  const mesTachesEnAttente = taches.filter(
                    (tc) => tc.assigne_a === monClientUserId && tc.statut !== 'terminee'
                  ).length
                  const messagesNonLus = messagesRecus.filter((m) => !m.lu).length
                  const diagnosticsAValider = diagnosticsEnAttente.length
                  const reponsesATraiter = targets.filter((tg) => tg.reponse_a_traiter).length
                  const items: { label: string; count: number; onglet: Onglet; groupe?: 'catalogue' | 'strategie' | 'idees' }[] = [
                    { label: '✅ Tâches qui te sont assignées', count: mesTachesEnAttente, onglet: 'collaboration' },
                    { label: '📬 Messages reçus non lus', count: messagesNonLus, onglet: 'inbox' },
                    { label: '🛠️ Diagnostics à valider', count: diagnosticsAValider, onglet: 'validation' },
                    { label: '🔥 Réponses de prospects à traiter', count: reponsesATraiter, onglet: 'cibles' },
                  ]
                  const actives = items.filter((i) => i.count > 0)
                  if (actives.length === 0) {
                    return <p className="text-xs text-slate-500 p-3">Aucune notification pour le moment.</p>
                  }
                  return actives.map((i) => (
                    <button
                      key={i.label}
                      onClick={() => {
                        setOngletActif(i.onglet)
                        setNotifOuvertes(false)
                      }}
                      className="w-full flex items-center justify-between text-left text-sm px-3 py-2 rounded-lg hover:bg-slate-800"
                    >
                      <span>{i.label}</span>
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {i.count}
                      </span>
                    </button>
                  ))
                })()}
              </div>
            )}
          </div>
          <a href="/dashboard/profil" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
            👤 Mon profil
          </a>
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
                            )}{' '}
                            <button
                              onClick={() =>
                                cibleEditionOuverte === target.id
                                  ? setCibleEditionOuverte(null)
                                  : ouvrirEditionCible(target)
                              }
                              disabled={estPriseParAutre && !peutSuperviser}
                              className="text-xs text-slate-400 hover:text-white disabled:opacity-40"
                              title="Modifier"
                            >
                              ✏️
                            </button>
                          </p>
                          <p className="text-slate-400 text-sm flex items-center flex-wrap gap-x-1">
                            <span>{target.telephone ?? '—'} · {target.email ?? '—'} ·</span>
                            {target.country ? (
                              <span className="inline-flex items-center gap-1">
                                <img
                                  src={`https://flagcdn.com/20x15/${target.country.toLowerCase()}.png`}
                                  alt={target.country}
                                  className="inline-block rounded-[2px]"
                                  width={20}
                                  height={15}
                                />
                                {target.country}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            <span>
                              · <span className="text-accent">{target.statut}</span>
                            </span>
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
                              {etapesPipelinePourVertical(verticalSlug).map((e) => (
                                <option key={e.etape} value={e.etape}>
                                  {e.label}
                                </option>
                              ))}
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
                            {target.dernier_canal_contact && (
                              <span className="text-xs text-slate-500">
                                ·{' '}
                                {target.dernier_canal_contact === 'whatsapp'
                                  ? '📱 Contactée par WhatsApp'
                                  : target.dernier_canal_contact === 'linkedin'
                                  ? '🔗 Contactée via LinkedIn'
                                  : '📧 Contactée par email'}
                              </span>
                            )}
                          </div>

                          {target.etape_pipeline === 'a_recontacter' && !target.motif_refus && (
                            <div className="mt-2 bg-amber-950/40 border border-amber-900 rounded-lg p-2">
                              <p className="text-xs text-amber-400 mb-1">
                                Pourquoi ce prospect a-t-il refusé ?
                              </p>
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (!e.target.value) return
                                  enregistrerMotifRefus(target, e.target.value)
                                }}
                                className="w-full text-xs rounded-lg bg-slate-900 border border-amber-800 px-2 py-1"
                              >
                                <option value="" disabled>
                                  Choisir un motif...
                                </option>
                                <option value="Pas de budget">Pas de budget (relance dans 90j)</option>
                                <option value="Pas le moment">Pas le moment (relance dans 30j)</option>
                                <option value="Plus le bon interlocuteur">
                                  Plus le bon interlocuteur (relance dans 60j)
                                </option>
                                <option value="Autre">Autre (relance dans 60j)</option>
                              </select>
                            </div>
                          )}
                          {target.motif_refus && (
                            <p className="text-xs text-slate-500 mt-1">
                              Motif : {target.motif_refus} — relance planifiée dans Mon Calendrier
                            </p>
                          )}

                          {cibleEditionOuverte === target.id && (
                            <div className="mt-2 space-y-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  value={formEditionCible.nom}
                                  onChange={(e) =>
                                    setFormEditionCible((f) => ({ ...f, nom: e.target.value }))
                                  }
                                  placeholder="Nom"
                                  className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                                />
                                <input
                                  value={formEditionCible.entreprise_ou_objectif}
                                  onChange={(e) =>
                                    setFormEditionCible((f) => ({
                                      ...f,
                                      entreprise_ou_objectif: e.target.value,
                                    }))
                                  }
                                  placeholder="Entreprise / objectif"
                                  className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                                />
                                <input
                                  value={formEditionCible.telephone}
                                  onChange={(e) =>
                                    setFormEditionCible((f) => ({ ...f, telephone: e.target.value }))
                                  }
                                  placeholder="Téléphone"
                                  className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                                />
                                <input
                                  value={formEditionCible.email}
                                  onChange={(e) =>
                                    setFormEditionCible((f) => ({ ...f, email: e.target.value }))
                                  }
                                  placeholder="Email"
                                  className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2"
                                />
                                <select
                                  value={formEditionCible.country}
                                  onChange={(e) =>
                                    setFormEditionCible((f) => ({ ...f, country: e.target.value }))
                                  }
                                  className="text-xs rounded-lg bg-slate-900 border border-slate-700 p-2 sm:col-span-2"
                                >
                                  <option value="">Pays...</option>
                                  {PAYS_DISPONIBLES.map((p) => (
                                    <option key={p.code} value={p.code}>
                                      {p.nom}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => enregistrerEditionCible(target.id)}
                                  disabled={!formEditionCible.nom.trim()}
                                  className="text-xs px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                                >
                                  Enregistrer
                                </button>
                                <button
                                  onClick={() => setCibleEditionOuverte(null)}
                                  className="text-xs px-3 py-1 rounded-lg bg-slate-800 border border-slate-700"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}

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
                        {target.statut === 'nouveau' && (
                          <button
                            onClick={() => envoyerMessage(target.id)}
                            disabled={envoiEnCours === target.id}
                            className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 disabled:opacity-40"
                          >
                            {envoiEnCours === target.id ? 'Envoi...' : '✉️ Premier contact'}
                          </button>
                        )}
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

              return (
                <div className="space-y-3">
                  {cibleEnCours.length === 0 && (
                    <p className="text-slate-500 text-sm italic">
                      Aucun prospect en cours pour le moment. Les prospects contactés depuis
                      l'onglet Cibles apparaîtront ici.
                    </p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
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
                            onClick={() => {
                              setPopoverPipelineOuvert(
                                popoverPipelineOuvert === carte.id ? null : carte.id
                              )
                              setPopoverPipelineForm({ assigne_a: carte.assigne_a ?? '', consigne: '' })
                            }}
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
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                <img
                                  src={`https://flagcdn.com/20x15/${carte.country.toLowerCase()}.png`}
                                  alt={carte.country}
                                  className="inline-block rounded-[2px]"
                                  width={20}
                                  height={15}
                                />
                                {carte.country}
                              </p>
                            )}
                            {carte.assigne_a && (
                              <p className="text-xs text-accent">
                                👤{' '}
                                {membresEquipe.find((m) => m.id === carte.assigne_a)?.nom_complet ??
                                  'Assigné'}
                              </p>
                            )}

                            {carte.etape_pipeline === 'a_recontacter' && !carte.motif_refus && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 bg-amber-950/40 border border-amber-900 rounded-lg p-2 cursor-default"
                              >
                                <p className="text-xs text-amber-400 mb-1">
                                  Pourquoi ce prospect a-t-il refusé ?
                                </p>
                                <select
                                  defaultValue=""
                                  onChange={(e) => {
                                    if (!e.target.value) return
                                    enregistrerMotifRefus(carte, e.target.value)
                                  }}
                                  className="w-full text-xs rounded-lg bg-slate-900 border border-amber-800 px-2 py-1"
                                >
                                  <option value="" disabled>
                                    Choisir un motif...
                                  </option>
                                  <option value="Pas de budget">Pas de budget (relance dans 90j)</option>
                                  <option value="Pas le moment">Pas le moment (relance dans 30j)</option>
                                  <option value="Plus le bon interlocuteur">
                                    Plus le bon interlocuteur (relance dans 60j)
                                  </option>
                                  <option value="Autre">Autre (relance dans 60j)</option>
                                </select>
                              </div>
                            )}
                            {carte.motif_refus && (
                              <p className="text-xs text-slate-500 mt-1">
                                Motif : {carte.motif_refus} — relance planifiée
                              </p>
                            )}

                            {popoverPipelineOuvert === carte.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 bg-slate-900 border border-accent/40 rounded-lg p-2 space-y-2 cursor-default"
                              >
                                <p className="text-xs font-semibold text-slate-300">
                                  Assigner & donner une consigne
                                </p>
                                <select
                                  value={popoverPipelineForm.assigne_a}
                                  onChange={(e) =>
                                    setPopoverPipelineForm({
                                      ...popoverPipelineForm,
                                      assigne_a: e.target.value,
                                    })
                                  }
                                  className="w-full text-xs rounded-lg bg-slate-950 border border-slate-700 p-1.5"
                                >
                                  <option value="">Assigner à...</option>
                                  {membresEquipe.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      👤 {m.nom_complet || '(sans nom)'}
                                    </option>
                                  ))}
                                </select>
                                <textarea
                                  value={popoverPipelineForm.consigne}
                                  onChange={(e) =>
                                    setPopoverPipelineForm({
                                      ...popoverPipelineForm,
                                      consigne: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: Rappeler ce vendredi à 14h suite à son message WhatsApp"
                                  className="w-full text-xs rounded-lg bg-slate-950 border border-slate-700 p-1.5"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => validerPopoverPipeline(carte)}
                                    className="text-xs px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold"
                                  >
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => setPopoverPipelineOuvert(null)}
                                    className="text-xs px-3 py-1 rounded-lg border border-slate-700"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  </div>
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

            {client.verticals_autorises && client.verticals_autorises.length > 1 && (
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                <h3 className="text-sm font-semibold">🗂️ Secteur actif</h3>
                <p className="text-xs text-slate-500">
                  L'administrateur t'a donné accès à plusieurs cartes/secteurs. Choisis celui sur
                  lequel tu travailles actuellement — cela change le vocabulaire, les questions et
                  les modèles utilisés par la plateforme.
                </p>
                <select
                  value={verticalSlug}
                  onChange={async (e) => {
                    const slugChoisi = e.target.value
                    const { data: verticalTrouve } = await supabase
                      .from('verticals')
                      .select('id')
                      .eq('slug', slugChoisi)
                      .single()
                    if (!verticalTrouve) return
                    await supabase
                      .from('clients')
                      .update({ vertical_id: verticalTrouve.id })
                      .eq('id', client.id)
                    window.location.reload()
                  }}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                >
                  {client.verticals_autorises.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
              <h3 className="text-sm font-semibold">🌐 Présence digitale (site web & réseaux)</h3>
              <p className="text-xs text-slate-500">
                Utilisé pour l'analyse auto du positionnement et le scraping du cabinet. Modifiable à
                tout moment, pas seulement à l'inscription.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={presenceDigitale.site_web}
                  onChange={(e) => setPresenceDigitale({ ...presenceDigitale, site_web: e.target.value })}
                  placeholder="Site web (https://...)"
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  value={presenceDigitale.linkedin_url}
                  onChange={(e) => setPresenceDigitale({ ...presenceDigitale, linkedin_url: e.target.value })}
                  placeholder="Page LinkedIn entreprise"
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  value={presenceDigitale.facebook_url}
                  onChange={(e) => setPresenceDigitale({ ...presenceDigitale, facebook_url: e.target.value })}
                  placeholder="Page Facebook"
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
                <input
                  value={presenceDigitale.instagram_url}
                  onChange={(e) => setPresenceDigitale({ ...presenceDigitale, instagram_url: e.target.value })}
                  placeholder="Instagram"
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                />
              </div>
              <button
                onClick={enregistrerPresenceDigitale}
                disabled={presenceDigitaleEnCours}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
              >
                {presenceDigitaleEnCours ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {presenceDigitaleMessage && (
                <p className="text-xs text-slate-400">{presenceDigitaleMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              {membresEquipe.map((m) => {
                const estProprietaire = m.role === 'proprietaire' || m.role === 'admin'
                const ouvert = membreEnEdition === m.id
                const peutEditer = peutSuperviser || m.id === monClientUserId
                return (
                  <div
                    key={m.id}
                    className="rounded-lg bg-slate-900 border border-slate-700 text-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-3">
                      <span className="flex items-center gap-2">
                        {peutEditer ? (
                          <>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              id={`photo-membre-${m.id}`}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploaderPhotoProfil(m.id, f)
                                e.target.value = ''
                              }}
                            />
                            <label htmlFor={`photo-membre-${m.id}`} className="cursor-pointer shrink-0">
                              {m.photo_url ? (
                                <img
                                  src={m.photo_url}
                                  alt={m.nom_complet ?? 'Photo de profil'}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-600"
                                />
                              ) : (
                                <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-[10px] text-slate-400">
                                  {uploadPhotoEnCours === m.id ? '...' : '📷'}
                                </span>
                              )}
                            </label>
                          </>
                        ) : m.photo_url ? (
                          <img
                            src={m.photo_url}
                            alt={m.nom_complet ?? 'Photo de profil'}
                            className="w-7 h-7 rounded-full object-cover border border-slate-600 shrink-0"
                          />
                        ) : null}
                        {m.nom_complet || '(nom non renseigné)'}
                        {m.telephone ? ` · ${m.telephone}` : ''}
                        {peutEditer && (
                          <button
                            onClick={() => {
                              if (ouvert) {
                                setMembreEnEdition(null)
                              } else {
                                setMembreEnEdition(m.id)
                                const { indicatif, numero } = decouperTelephone(m.telephone)
                                setEditionMembreForm({
                                  nom_complet: m.nom_complet ?? '',
                                  indicatifTelephone: indicatif,
                                  telephone: numero,
                                })
                              }
                            }}
                            title="Modifier le nom / téléphone"
                            className="text-accent hover:text-accent/80"
                          >
                            ✏️
                          </button>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-accent text-xs uppercase">
                          {estProprietaire
                            ? '👑 Propriétaire du cabinet'
                            : m.role === 'directeur_commercial'
                            ? '🧭 Directeur commercial'
                            : '👤 Commercial'}
                        </span>
                        {peutSuperviser && !estProprietaire && m.id !== monClientUserId && (
                          <button
                            onClick={() => supprimerMembre(m.id, m.nom_complet)}
                            className="text-xs text-red-400 hover:text-red-300 underline"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>

                    {ouvert && (
                      <div className="border-t border-slate-800 p-3 space-y-3 bg-slate-950/60">
                        <div>
                          <label className="text-xs text-slate-500">Email de connexion</label>
                          <p className="text-sm text-slate-300">
                            {m.email || 'Non renseigné (compte créé avant cette mise à jour)'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={editionMembreForm.nom_complet}
                            onChange={(e) =>
                              setEditionMembreForm({ ...editionMembreForm, nom_complet: e.target.value })
                            }
                            placeholder="Nom complet"
                            className="flex-1 rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                          />
                          <PhoneInput
                            className="flex-1"
                            indicatif={editionMembreForm.indicatifTelephone}
                            onIndicatifChange={(v) =>
                              setEditionMembreForm({ ...editionMembreForm, indicatifTelephone: v })
                            }
                            numero={editionMembreForm.telephone}
                            onNumeroChange={(v) =>
                              setEditionMembreForm({ ...editionMembreForm, telephone: v })
                            }
                            placeholder="Téléphone"
                          />
                          <button
                            onClick={async () => {
                              const telephoneFinal = editionMembreForm.telephone.trim()
                                ? `${editionMembreForm.indicatifTelephone}${editionMembreForm.telephone.trim()}`
                                : null
                              await modifierMembre(m.id, {
                                nom_complet: editionMembreForm.nom_complet,
                                telephone: telephoneFinal,
                              })
                              setMembreEnEdition(null)
                            }}
                            className="text-sm px-3 rounded-lg bg-accent text-slate-950 font-semibold"
                          >
                            Enregistrer
                          </button>
                        </div>

                        {peutSuperviser && !estProprietaire && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 mb-2">
                              👑 Onglets visibles pour ce membre
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ONGLETS.filter((o) => o.id !== 'equipe').map((onglet) => {
                                const masque = (m.onglets_masques ?? []).includes(onglet.id)
                                return (
                                  <button
                                    key={onglet.id}
                                    onClick={() => basculerOngletMasqueMembre(m, onglet.id)}
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
                              Les onglets barrés sont masqués pour ce membre uniquement.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
                Vous êtes PiloBrain ? Accès administration plateforme →
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

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                  <p className="text-sm font-semibold">🧠 Vos inputs stratégiques</p>
                  <p className="text-xs text-slate-500">
                    Ces infos nourrissent le prompt IA (diagnostics, stratégie) : elles ne bloquent
                    ni ne brident rien techniquement, mais orientent les recommandations générées.
                  </p>
                  <div>
                    <label className="text-xs text-slate-400">
                      Taux de closing historique (%, avant la plateforme)
                    </label>
                    <input
                      value={inputsStrategiques.taux_closing_historique}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          taux_closing_historique: e.target.value,
                        })
                      }
                      type="number"
                      placeholder="Ex: 15"
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Mots-clés d'expertise métier (séparés par une virgule)
                    </label>
                    <input
                      value={inputsStrategiques.mots_cles_expertise}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          mots_cles_expertise: e.target.value,
                        })
                      }
                      placeholder="Ex: Management Agile, Conduite du changement, RSE & Climat"
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Idées reçues du marché sur votre expertise
                    </label>
                    <textarea
                      value={inputsStrategiques.idees_recues_marche}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          idees_recues_marche: e.target.value,
                        })
                      }
                      placeholder="Ex: Mes prospects croient souvent qu'une certification PMP est trop théorique et inapplicable sur le terrain tunisien."
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Objections et motifs de rejet récurrents du passé
                    </label>
                    <textarea
                      value={inputsStrategiques.motifs_rejet_passes}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          motifs_rejet_passes: e.target.value,
                        })
                      }
                      placeholder="Ex: Les prospects trouvent souvent nos tarifs trop élevés ou disent en cours de route qu'ils n'ont plus de budget."
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Canaux de prospection déjà tentés sans succès
                    </label>
                    <textarea
                      value={inputsStrategiques.canaux_echoues}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          canaux_echoues: e.target.value,
                        })
                      }
                      placeholder="Ex: 6 mois de publicité Facebook Ads sans signer aucun client B2B."
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">
                      Volume de travail actuel de votre équipe commerciale
                    </label>
                    <textarea
                      value={inputsStrategiques.volume_equipe_commerciale}
                      onChange={(e) =>
                        setInputsStrategiques({
                          ...inputsStrategiques,
                          volume_equipe_commerciale: e.target.value,
                        })
                      }
                      placeholder="Ex: 2 commerciaux, ~3h/jour à chercher des contacts, ~15 e-mails manuels par jour."
                      className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      rows={2}
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-300">
                      Profil de ciblage précis
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400">
                          Taille min (nb salariés)
                        </label>
                        <input
                          value={inputsStrategiques.taille_min_salaries}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              taille_min_salaries: e.target.value,
                            })
                          }
                          type="number"
                          placeholder="Ex: 20"
                          className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">
                          Taille max (nb salariés)
                        </label>
                        <input
                          value={inputsStrategiques.taille_max_salaries}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              taille_max_salaries: e.target.value,
                            })
                          }
                          type="number"
                          placeholder="Ex: 100"
                          className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Portée géographique</label>
                      <select
                        value={inputsStrategiques.portee_geographique}
                        onChange={(e) =>
                          setInputsStrategiques({
                            ...inputsStrategiques,
                            portee_geographique: e.target.value,
                          })
                        }
                        className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      >
                        <option value="">Non précisé</option>
                        <option value="local">Local</option>
                        <option value="national">National</option>
                        <option value="international">International</option>
                      </select>
                    </div>
                    {inputsStrategiques.portee_geographique === 'local' && (
                      <div>
                        <label className="text-xs text-slate-400">
                          Villes ciblées (séparées par une virgule)
                        </label>
                        <input
                          value={inputsStrategiques.villes_ciblees}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              villes_ciblees: e.target.value,
                            })
                          }
                          placeholder="Ex: Tunis, Sfax, Sousse"
                          className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-300">
                      Présence digitale
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={inputsStrategiques.linkedin_actif}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              linkedin_actif: e.target.checked,
                            })
                          }
                        />
                        Page LinkedIn entreprise active
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={inputsStrategiques.facebook_actif}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              facebook_actif: e.target.checked,
                            })
                          }
                        />
                        Page Facebook active
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={inputsStrategiques.instagram_actif}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              instagram_actif: e.target.checked,
                            })
                          }
                        />
                        Instagram actif
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={inputsStrategiques.blog_actif}
                          onChange={(e) =>
                            setInputsStrategiques({
                              ...inputsStrategiques,
                              blog_actif: e.target.checked,
                            })
                          }
                        />
                        Site avec blog
                      </label>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">
                        Base de données e-mail existante ?
                      </label>
                      <input
                        value={inputsStrategiques.base_email_existante}
                        onChange={(e) =>
                          setInputsStrategiques({
                            ...inputsStrategiques,
                            base_email_existante: e.target.value,
                          })
                        }
                        placeholder="Ex: Oui, ~500 contacts. Laisser vide si non."
                        className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Budget publicitaire</label>
                      <select
                        value={inputsStrategiques.budget_publicitaire}
                        onChange={(e) =>
                          setInputsStrategiques({
                            ...inputsStrategiques,
                            budget_publicitaire: e.target.value,
                          })
                        }
                        className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      >
                        <option value="">Non précisé</option>
                        <option value="organique">Organique uniquement (gratuit)</option>
                        <option value="payant">Prêt à faire de la pub payante (Facebook/LinkedIn Ads)</option>
                        <option value="mixte">Les deux</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">
                        Objectifs chiffrés (conventions/mois ou CA visé)
                      </label>
                      <input
                        value={inputsStrategiques.objectif_chiffre}
                        onChange={(e) =>
                          setInputsStrategiques({
                            ...inputsStrategiques,
                            objectif_chiffre: e.target.value,
                          })
                        }
                        placeholder="Ex: 5 conventions/mois, ou 50k TND ce trimestre"
                        className="w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
                    <p className="text-xs font-semibold">🌐 Analyse auto du positionnement</p>
                    <p className="text-[11px] text-slate-500">
                      Scanne le site web renseigné dans Équipe & Paramètres (description,
                      expertises, références clients) via l'IA.
                    </p>
                    {client.positionnement_site && (
                      <p className="text-xs text-slate-300 whitespace-pre-line bg-slate-900 rounded-lg p-2 border border-slate-700">
                        {client.positionnement_site}
                      </p>
                    )}
                    {client.ligne_editoriale_reseaux && (
                      <p className="text-xs text-slate-300 whitespace-pre-line bg-slate-900 rounded-lg p-2 border border-slate-700">
                        🔗 Réseaux : {client.ligne_editoriale_reseaux}
                      </p>
                    )}
                    {erreurAnalyseCabinet && <p className="text-xs text-red-400">{erreurAnalyseCabinet}</p>}
                    <button
                      onClick={analyserSiteCabinet}
                      disabled={analyseCabinetEnCours || !client.site_web}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40"
                    >
                      {analyseCabinetEnCours
                        ? 'Analyse en cours...'
                        : client.positionnement_site
                        ? 'Relancer l\'analyse'
                        : 'Analyser mon site'}
                    </button>
                    {!client.site_web && (
                      <p className="text-[11px] text-amber-400">
                        Ajoute d'abord ton site web dans Équipe & Paramètres.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={enregistrerInputsStrategiques}
                    disabled={inputsStrategiquesEnCours}
                    className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                  >
                    {inputsStrategiquesEnCours ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
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

                    {strategieResultat.filtresRecommandes && (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                        <p className="text-xs text-slate-400 font-semibold uppercase">
                          🎯 Plan de chasse recommandé
                        </p>
                        <div className="text-sm text-slate-200 space-y-1">
                          {strategieResultat.filtresRecommandes.postes.length > 0 && (
                            <p>
                              <span className="text-slate-400">Postes :</span>{' '}
                              {strategieResultat.filtresRecommandes.postes.join(', ')}
                            </p>
                          )}
                          {strategieResultat.filtresRecommandes.secteur && (
                            <p>
                              <span className="text-slate-400">Secteur :</span>{' '}
                              {strategieResultat.filtresRecommandes.secteur}
                            </p>
                          )}
                          {strategieResultat.filtresRecommandes.taille && (
                            <p>
                              <span className="text-slate-400">Taille :</span>{' '}
                              {strategieResultat.filtresRecommandes.taille}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={appliquerFiltresRecommandes}
                          disabled={filtresAppliquesEnCours}
                          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                        >
                          {filtresAppliquesEnCours ? 'Application...' : "Appliquer à l'onglet Ciblage"}
                        </button>
                        {filtresAppliquesMessage && (
                          <p className="text-xs text-slate-400">{filtresAppliquesMessage}</p>
                        )}
                      </div>
                    )}

                    {strategieResultat.scriptAppel && (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                        <p className="text-xs text-slate-400 font-semibold uppercase">
                          📞 Script d'appel
                        </p>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">
                          {strategieResultat.scriptAppel}
                        </p>
                      </div>
                    )}

                    {strategieResultat.scriptLinkedin && (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                        <p className="text-xs text-slate-400 font-semibold uppercase">
                          💬 Message LinkedIn
                        </p>
                        <p className="text-sm text-slate-200 whitespace-pre-wrap">
                          {strategieResultat.scriptLinkedin}
                        </p>
                      </div>
                    )}

                    {strategieResultat.guideQualification.length > 0 && (
                      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                        <p className="text-xs text-slate-400 font-semibold uppercase">
                          ❓ Guide de qualification (1er RDV)
                        </p>
                        <ul className="text-sm text-slate-200 list-disc list-inside space-y-1">
                          {strategieResultat.guideQualification.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

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

                {strategieResultat?.ligneEditoriale && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase">
                      🖊️ Ligne éditoriale
                    </p>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">
                      {strategieResultat.ligneEditoriale}
                    </p>
                  </div>
                )}

                {strategieResultat && strategieResultat.leadMagnets.length > 0 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-2">
                    <p className="text-xs text-slate-400 font-semibold uppercase">
                      🧲 Idées de lead magnets
                    </p>
                    <ul className="text-sm text-slate-200 list-disc list-inside space-y-1">
                      {strategieResultat.leadMagnets.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-semibold uppercase">
                      🗓️ Calendrier éditorial du mois
                    </p>
                    <button
                      onClick={genererCalendrierEditorial}
                      disabled={calendrierEnCours}
                      className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                    >
                      {calendrierEnCours
                        ? 'Génération...'
                        : calendrierEditorial.length > 0
                        ? 'Régénérer'
                        : 'Générer le calendrier'}
                    </button>
                  </div>
                  {erreurCalendrier && <p className="text-xs text-red-400">{erreurCalendrier}</p>}
                  {calendrierEditorial.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">Pas encore de calendrier généré.</p>
                  ) : (
                    <div className="space-y-2">
                      {calendrierEditorial.map((e) => (
                        <div
                          key={e.id}
                          className="rounded-lg border border-slate-800 p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-xs text-accent font-semibold">Semaine {e.semaine}</p>
                            <p className="text-sm font-medium">{e.theme}</p>
                            <p className="text-xs text-slate-400">{e.format_suggere}</p>
                            {e.angle_accroche && (
                              <p className="text-xs text-slate-500 italic mt-1">"{e.angle_accroche}"</p>
                            )}
                          </div>
                          <button
                            onClick={() => basculerStatutCalendrier(e.id, e.statut)}
                            className={`text-[10px] px-2 py-1 rounded-full shrink-0 ${
                              e.statut === 'publie'
                                ? 'bg-emerald-900 text-emerald-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {e.statut === 'publie' ? '✓ Publié' : 'À faire'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                  <p className="text-xs text-slate-400 font-semibold uppercase">
                    🛡️ Matrice de contre-objection
                  </p>
                  {matriceContreObjection.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">
                      Génère le calendrier éditorial ci-dessus pour l'obtenir en même temps.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {matriceContreObjection.map((m) => (
                        <div key={m.id} className="rounded-lg border border-slate-800 p-3">
                          <p className="text-xs text-slate-500">Idée reçue :</p>
                          <p className="text-sm font-medium">{m.objection}</p>
                          <p className="text-xs text-slate-500 mt-2">Angle de contenu :</p>
                          <p className="text-sm text-slate-300">{m.angle_contenu}</p>
                          {m.format_suggere && (
                            <p className="text-xs text-accent mt-1">{m.format_suggere}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
                  <p className="text-xs text-slate-400 font-semibold uppercase">🏆 Badge marketing</p>
                  <p className="text-xs text-slate-500">
                    Un visuel à intégrer sur ton site ou tes réseaux, avec tes chiffres dans la
                    devise adaptée à ta zone.
                  </p>
                  {client?.token_badge_public && (
                    <>
                      <img
                        src={`/api/marketing/badge?token=${client.token_badge_public}`}
                        alt="Badge marketing PiloBrain"
                        className="rounded-lg border border-slate-800"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/api/marketing/badge?token=${client.token_badge_public}`
                              : ''
                          }
                          className="flex-1 rounded-lg bg-slate-950 border border-slate-700 p-2 text-xs text-slate-400"
                          onFocus={(e) => e.target.select()}
                        />
                        <button
                          onClick={() =>
                            copierLienBadge(
                              `${window.location.origin}/api/marketing/badge?token=${client.token_badge_public}`
                            )
                          }
                          className="text-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 shrink-0"
                        >
                          {lienBadgeCopie ? '✅ Copié !' : 'Copier le lien'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {strategieResultat && strategieResultat.historique.filter((h) => h.recommandation_marketing).length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-300">🕓 Historique (stratégies précédentes)</h3>
                    {strategieResultat.historique
                      .filter((h) => h.recommandation_marketing)
                      .map((h) => (
                        <details key={h.id} className="bg-slate-900 border border-slate-700 rounded-lg p-2">
                          <summary className="text-xs text-slate-400 cursor-pointer">
                            {new Date(h.created_at).toLocaleString('fr-FR')}
                          </summary>
                          <p className="mt-2 text-sm whitespace-pre-wrap">
                            {h.recommandation_marketing}
                          </p>
                        </details>
                      ))}
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

            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={inputPdfCatalogue}
                type="file"
                accept={FORMATS_CATALOGUE_ACCEPTES}
                onChange={importerPdfOffre}
                className="hidden"
              />
              <button
                onClick={() => inputPdfCatalogue.current?.click()}
                disabled={pdfEnCours}
                className="text-xs px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-accent disabled:opacity-50"
              >
                {pdfEnCours
                  ? 'Analyse du fichier...'
                  : '📄 Importer un fichier (PDF, Word, image... pré-remplit le formulaire)'}
              </button>
              {pdfUrlTemp && (
                <span className="text-xs text-accent">✓ Fichier prêt à être attaché à cette offre</span>
              )}
            </div>
            <p className="text-xs text-slate-500 -mt-2">
              Formats acceptés : PDF, Word (.docx), image (photo de brochure) ou texte (.txt).
            </p>

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
              <input
                value={nouvelleOffre.thematique}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, thematique: e.target.value })}
                placeholder="Thématique (ex: Management, RH, Soft Skills...)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              <select
                value={nouvelleOffre.format}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, format: e.target.value })}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">Format (optionnel)</option>
                <option value="inter_entreprise">Inter-entreprises</option>
                <option value="intra_entreprise">Intra-entreprise</option>
              </select>
              <select
                value={nouvelleOffre.mode_delivrance}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, mode_delivrance: e.target.value })}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              >
                <option value="">Mode de délivrance (optionnel)</option>
                <option value="presentiel">100% présentiel</option>
                <option value="en_ligne">En ligne</option>
                <option value="blended">Blended (mixte)</option>
              </select>
              <input
                value={nouvelleOffre.usp}
                onChange={(e) => setNouvelleOffre({ ...nouvelleOffre, usp: e.target.value })}
                placeholder="Élément de différenciation / USP (optionnel)"
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

            <div className="overflow-x-auto rounded-xl border border-slate-700">
              {catalogue.length === 0 ? (
                <p className="text-slate-500 text-sm italic p-4">
                  Aucune offre pour le moment — l'IA invente encore des packs génériques.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 text-xs uppercase text-left">
                      <th className="p-3 font-semibold">Offre</th>
                      <th className="p-3 font-semibold">Thématique</th>
                      <th className="p-3 font-semibold">Format</th>
                      <th className="p-3 font-semibold">Mode de délivrance</th>
                      <th className="p-3 font-semibold">Tarification</th>
                      <th className="p-3 font-semibold">USP</th>
                      <th className="p-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogue.map((o) => (
                      <Fragment key={o.id}>
                      <tr className="border-t border-slate-800 bg-slate-950 align-top">
                        <td className="p-3">
                          <p className="font-semibold">{o.nom}</p>
                          {o.description && (
                            <p className="text-slate-400 text-xs mt-1">{o.description}</p>
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
                              📄 PDF
                            </a>
                          )}
                        </td>
                        <td className="p-3 text-slate-300">{o.thematique || '—'}</td>
                        <td className="p-3 text-slate-300">
                          {o.format === 'inter_entreprise'
                            ? 'Inter-entreprises'
                            : o.format === 'intra_entreprise'
                            ? 'Intra-entreprise'
                            : '—'}
                        </td>
                        <td className="p-3 text-slate-300">
                          {o.mode_delivrance === 'presentiel'
                            ? '100% présentiel'
                            : o.mode_delivrance === 'en_ligne'
                            ? 'En ligne'
                            : o.mode_delivrance === 'blended'
                            ? 'Blended'
                            : '—'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {o.prix ? (
                            <span className="text-accent font-medium">
                              {o.prix} {o.devise ?? 'TND'}
                            </span>
                          ) : (
                            '—'
                          )}
                          {o.duree && <span className="text-slate-400 text-xs block">{o.duree}</span>}
                        </td>
                        <td className="p-3 text-slate-300">{o.usp || '—'}</td>
                        <td className="p-3 whitespace-nowrap space-x-2">
                          <button
                            onClick={() => {
                              if (offreEnEdition === o.id) {
                                setOffreEnEdition(null)
                                return
                              }
                              setOffreEnEdition(o.id)
                              setEditionOffreForm({
                                nom: o.nom,
                                description: o.description ?? '',
                                prix: o.prix ? String(o.prix) : '',
                                devise: o.devise ?? 'TND',
                                duree: o.duree ?? '',
                                public_cible: o.public_cible ?? '',
                                thematique: o.thematique ?? '',
                                format: o.format ?? '',
                                mode_delivrance: o.mode_delivrance ?? '',
                                usp: o.usp ?? '',
                              })
                            }}
                            className="text-xs text-accent hover:text-accent/80 underline"
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => supprimerOffre(o.id)}
                            className="text-xs text-red-400 hover:text-red-300 underline whitespace-nowrap"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                      {offreEnEdition === o.id && (
                        <tr className="border-t border-slate-800 bg-slate-900/60">
                          <td colSpan={7} className="p-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                value={editionOffreForm.nom}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, nom: e.target.value })
                                }
                                placeholder="Nom"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              />
                              <input
                                value={editionOffreForm.thematique}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, thematique: e.target.value })
                                }
                                placeholder="Thématique"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              />
                              <input
                                value={editionOffreForm.public_cible}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, public_cible: e.target.value })
                                }
                                placeholder="Public cible"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              />
                              <select
                                value={editionOffreForm.format}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, format: e.target.value })
                                }
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              >
                                <option value="">Format</option>
                                <option value="inter_entreprise">Inter-entreprises</option>
                                <option value="intra_entreprise">Intra-entreprise</option>
                              </select>
                              <select
                                value={editionOffreForm.mode_delivrance}
                                onChange={(e) =>
                                  setEditionOffreForm({
                                    ...editionOffreForm,
                                    mode_delivrance: e.target.value,
                                  })
                                }
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              >
                                <option value="">Mode de délivrance</option>
                                <option value="presentiel">100% présentiel</option>
                                <option value="en_ligne">En ligne</option>
                                <option value="blended">Blended</option>
                              </select>
                              <div className="flex gap-2">
                                <input
                                  value={editionOffreForm.prix}
                                  onChange={(e) =>
                                    setEditionOffreForm({ ...editionOffreForm, prix: e.target.value })
                                  }
                                  placeholder="Prix"
                                  type="number"
                                  className="w-1/2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                                />
                                <select
                                  value={editionOffreForm.devise}
                                  onChange={(e) =>
                                    setEditionOffreForm({ ...editionOffreForm, devise: e.target.value })
                                  }
                                  className="w-1/2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                                >
                                  <option value="TND">TND</option>
                                  <option value="EUR">EUR</option>
                                  <option value="USD">USD</option>
                                </select>
                              </div>
                              <input
                                value={editionOffreForm.duree}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, duree: e.target.value })
                                }
                                placeholder="Durée"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                              />
                              <input
                                value={editionOffreForm.usp}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, usp: e.target.value })
                                }
                                placeholder="USP / différenciation"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm md:col-span-2"
                              />
                              <textarea
                                value={editionOffreForm.description}
                                onChange={(e) =>
                                  setEditionOffreForm({ ...editionOffreForm, description: e.target.value })
                                }
                                placeholder="Description"
                                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm md:col-span-3"
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={async () => {
                                  if (!editionOffreForm.nom.trim()) {
                                    alert('Le nom est obligatoire.')
                                    return
                                  }
                                  await modifierOffre(o.id, {
                                    nom: editionOffreForm.nom.trim(),
                                    description: editionOffreForm.description.trim() || null,
                                    prix: editionOffreForm.prix ? Number(editionOffreForm.prix) : null,
                                    devise: editionOffreForm.devise,
                                    duree: editionOffreForm.duree.trim() || null,
                                    public_cible: editionOffreForm.public_cible.trim() || null,
                                    thematique: editionOffreForm.thematique.trim() || null,
                                    format: editionOffreForm.format || null,
                                    mode_delivrance: editionOffreForm.mode_delivrance || null,
                                    usp: editionOffreForm.usp.trim() || null,
                                  })
                                  setOffreEnEdition(null)
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-semibold"
                              >
                                Enregistrer
                              </button>
                              <button
                                onClick={() => setOffreEnEdition(null)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700"
                              >
                                Annuler
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
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
                {messagesEquipe.map((m) => {
                  const estMoi = m.auteur_id === monClientUserId
                  return (
                    <div key={m.id} className={`flex ${estMoi ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          estMoi
                            ? 'bg-accent text-slate-950 rounded-br-sm'
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                        }`}
                      >
                        {!estMoi && (
                          <p className="font-semibold text-accent text-xs mb-0.5">
                            {m.client_users?.nom_complet ?? 'Membre'}
                          </p>
                        )}
                        <p>{m.contenu}</p>
                        <p className={`text-[10px] mt-0.5 ${estMoi ? 'text-slate-950/60' : 'text-slate-500'}`}>
                          {new Date(m.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  )
                })}
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
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    Deadline
                    <input
                      type="date"
                      value={nouvelleTache.echeance}
                      onChange={(e) => setNouvelleTache({ ...nouvelleTache, echeance: e.target.value })}
                      className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm text-slate-200"
                    />
                  </label>
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
                          <p className="text-xs text-slate-400">
                            👤 {t.membre?.nom_complet ?? 'Non assignée'}
                          </p>
                          {t.echeance && (
                            <p
                              className={`text-xs font-medium ${
                                t.statut !== 'terminee' && new Date(t.echeance) < new Date()
                                  ? 'text-red-400'
                                  : 'text-accent'
                              }`}
                            >
                              📅 Échéance : {new Date(t.echeance).toLocaleDateString('fr-FR')}
                              {t.statut !== 'terminee' && new Date(t.echeance) < new Date() && ' (dépassée)'}
                            </p>
                          )}
                          {t.createur?.nom_complet && (
                            <p className="text-xs text-slate-400">
                              ✍️ Créée par {t.createur.nom_complet}
                            </p>
                          )}
                          {t.cible?.nom && (
                            <p className="text-xs text-accent">🎯 Prospect : {t.cible.nom}</p>
                          )}
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
                        {c.heure_debut && <span className="text-accent">{c.heure_debut.slice(0, 5)} — </span>}
                        {c.titre}
                        {c.lieu && <span className="text-slate-500"> · 📍 {c.lieu}</span>}
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
              <input
                value={nouvelleEntree.heure_debut}
                onChange={(e) => setNouvelleEntree({ ...nouvelleEntree, heure_debut: e.target.value })}
                type="time"
                placeholder="Heure (optionnel)"
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
              />
              {nouvelleEntree.heure_debut && (
                <select
                  value={nouvelleEntree.duree_minutes}
                  onChange={(e) =>
                    setNouvelleEntree({ ...nouvelleEntree, duree_minutes: e.target.value })
                  }
                  className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 h</option>
                  <option value="90">1 h 30</option>
                  <option value="120">2 h</option>
                </select>
              )}
              <input
                value={nouvelleEntree.lieu}
                onChange={(e) => setNouvelleEntree({ ...nouvelleEntree, lieu: e.target.value })}
                placeholder="Lieu (adresse, bureau, visio...)"
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
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <button
                  onClick={() =>
                    vueCalendrier === 'mois'
                      ? setMoisAffiche((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                      : vueCalendrier === 'semaine'
                      ? setSemaineAffichee((s) => {
                          const d = new Date(s)
                          d.setDate(d.getDate() - 7)
                          return d
                        })
                      : setJourAffiche((j) => {
                          const d = new Date(j)
                          d.setDate(d.getDate() - 1)
                          return d
                        })
                  }
                  className="px-3 py-1 rounded-lg border border-slate-700 text-sm hover:border-accent"
                >
                  ← Précédent
                </button>
                <div className="flex items-center gap-3">
                  <p className="font-semibold capitalize">
                    {vueCalendrier === 'mois'
                      ? moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                      : vueCalendrier === 'semaine'
                      ? (() => {
                          const jours = genererJoursSemaine(semaineAffichee)
                          const debut = jours[0]
                          const fin = jours[6]
                          return `${debut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${fin.toLocaleDateString(
                            'fr-FR',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}`
                        })()
                      : jourAffiche.toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                  </p>
                  <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
                    <button
                      onClick={() => setVueCalendrier('mois')}
                      className={`px-3 py-1 ${vueCalendrier === 'mois' ? 'bg-accent text-slate-950 font-semibold' : 'bg-slate-950 text-slate-400'}`}
                    >
                      Mois
                    </button>
                    <button
                      onClick={() => setVueCalendrier('semaine')}
                      className={`px-3 py-1 ${vueCalendrier === 'semaine' ? 'bg-accent text-slate-950 font-semibold' : 'bg-slate-950 text-slate-400'}`}
                    >
                      Semaine
                    </button>
                    <button
                      onClick={() => setVueCalendrier('jour')}
                      className={`px-3 py-1 ${vueCalendrier === 'jour' ? 'bg-accent text-slate-950 font-semibold' : 'bg-slate-950 text-slate-400'}`}
                    >
                      Jour
                    </button>
                  </div>
                </div>
                <button
                  onClick={() =>
                    vueCalendrier === 'mois'
                      ? setMoisAffiche((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                      : vueCalendrier === 'semaine'
                      ? setSemaineAffichee((s) => {
                          const d = new Date(s)
                          d.setDate(d.getDate() + 7)
                          return d
                        })
                      : setJourAffiche((j) => {
                          const d = new Date(j)
                          d.setDate(d.getDate() + 1)
                          return d
                        })
                  }
                  className="px-3 py-1 rounded-lg border border-slate-700 text-sm hover:border-accent"
                >
                  Suivant →
                </button>
              </div>

              {vueCalendrier === 'mois' ? (
                <>
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
                                {c.heure_debut && `${c.heure_debut.slice(0, 5)} `}
                                {c.titre}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : vueCalendrier === 'semaine' ? (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-[50px_repeat(7,minmax(110px,1fr))] gap-px min-w-[820px]">
                    {/* En-têtes des jours */}
                    <div />
                    {genererJoursSemaine(semaineAffichee).map((date) => {
                      const dateStr = formatDateLocale(date)
                      const estAujourdhui = dateStr === formatDateLocale(new Date())
                      return (
                        <div
                          key={dateStr}
                          onClick={() => {
                            setJourSelectionne(dateStr)
                            setNouvelleEntree((prev) => ({ ...prev, date_evenement: dateStr }))
                          }}
                          className={`text-center text-xs pb-1 cursor-pointer rounded-t-lg ${
                            estAujourdhui ? 'text-accent font-semibold' : 'text-slate-400'
                          } ${jourSelectionne === dateStr ? 'bg-accent/10' : ''}`}
                        >
                          {date.toLocaleDateString('fr-FR', { weekday: 'short' })}{' '}
                          <span className={estAujourdhui ? 'text-accent' : 'text-slate-300'}>{date.getDate()}</span>
                        </div>
                      )
                    })}

                    {/* Entrées sans heure ("toute la journée") en haut de chaque colonne */}
                    <div className="text-[10px] text-slate-600 flex items-center justify-end pr-1">journée</div>
                    {genererJoursSemaine(semaineAffichee).map((date) => {
                      const dateStr = formatDateLocale(date)
                      const entreesSansHeure = calendrier.filter(
                        (c) => c.date_evenement === dateStr && !c.heure_debut
                      )
                      return (
                        <div key={dateStr} className="border border-slate-800 bg-slate-950 p-0.5 space-y-0.5 min-h-[24px]">
                          {entreesSansHeure.map((c) => (
                            <div key={c.id} title={c.titre} className="truncate rounded bg-slate-800 px-1 py-0.5 text-[10px] text-slate-200">
                              {c.type === 'rdv' ? '📞' : c.type === 'evenement' ? '🎪' : c.type === 'appel_offre' ? '📋' : '📌'} {c.titre}
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* Grille horaire : une ligne par heure, positionnement des entrées selon heure_debut/duree_minutes */}
                    {HEURES_AFFICHEES.map((heure) => (
                      <Fragment key={`h-${heure}`}>
                        <div className="text-[10px] text-slate-600 text-right pr-1 pt-0.5">
                          {String(heure).padStart(2, '0')}h
                        </div>
                        {genererJoursSemaine(semaineAffichee).map((date) => {
                          const dateStr = formatDateLocale(date)
                          const entreesHeure = calendrier.filter((c) => {
                            if (c.date_evenement !== dateStr || !c.heure_debut) return false
                            return parseInt(c.heure_debut.slice(0, 2), 10) === heure
                          })
                          return (
                            <div
                              key={`${dateStr}-${heure}`}
                              onClick={() => {
                                setJourSelectionne(dateStr)
                                setNouvelleEntree((prev) => ({
                                  ...prev,
                                  date_evenement: dateStr,
                                  heure_debut: `${String(heure).padStart(2, '0')}:00`,
                                }))
                              }}
                              className="border border-slate-800 bg-slate-950 hover:bg-slate-900 cursor-pointer p-0.5 space-y-0.5 min-h-[32px]"
                            >
                              {entreesHeure.map((c) => (
                                <div
                                  key={c.id}
                                  title={`${c.heure_debut?.slice(0, 5)} · ${c.titre}`}
                                  className="truncate rounded bg-accent/20 border-l-2 border-accent px-1 py-0.5 text-[10px] text-white"
                                >
                                  {c.heure_debut?.slice(0, 5)} {c.titre}
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-md">
                  {/* Entrées sans heure ("toute la journée") */}
                  {(() => {
                    const dateStr = formatDateLocale(jourAffiche)
                    const entreesSansHeure = calendrier.filter(
                      (c) => c.date_evenement === dateStr && !c.heure_debut
                    )
                    return entreesSansHeure.length > 0 ? (
                      <div className="mb-2 space-y-1">
                        <p className="text-[10px] text-slate-600">journée</p>
                        {entreesSansHeure.map((c) => (
                          <div
                            key={c.id}
                            title={c.titre}
                            className="truncate rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
                          >
                            {c.type === 'rdv' ? '📞' : c.type === 'evenement' ? '🎪' : c.type === 'appel_offre' ? '📋' : '📌'} {c.titre}
                          </div>
                        ))}
                      </div>
                    ) : null
                  })()}
                  <div className="grid grid-cols-[50px_1fr] gap-px">
                    {HEURES_AFFICHEES.map((heure) => {
                      const dateStr = formatDateLocale(jourAffiche)
                      const entreesHeure = calendrier.filter((c) => {
                        if (c.date_evenement !== dateStr || !c.heure_debut) return false
                        return parseInt(c.heure_debut.slice(0, 2), 10) === heure
                      })
                      return (
                        <Fragment key={`h-${heure}`}>
                          <div className="text-[10px] text-slate-600 text-right pr-1 pt-1">
                            {String(heure).padStart(2, '0')}h
                          </div>
                          <div
                            onClick={() => {
                              setJourSelectionne(dateStr)
                              setNouvelleEntree((prev) => ({
                                ...prev,
                                date_evenement: dateStr,
                                heure_debut: `${String(heure).padStart(2, '0')}:00`,
                              }))
                            }}
                            className="border border-slate-800 bg-slate-950 hover:bg-slate-900 cursor-pointer p-1 space-y-0.5 min-h-[36px]"
                          >
                            {entreesHeure.map((c) => (
                              <div
                                key={c.id}
                                title={`${c.heure_debut?.slice(0, 5)} · ${c.titre}`}
                                className="truncate rounded bg-accent/20 border-l-2 border-accent px-2 py-1 text-xs text-white"
                              >
                                {c.heure_debut?.slice(0, 5)} {c.titre}
                              </div>
                            ))}
                          </div>
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              )}
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
                          {c.heure_debut && ` à ${c.heure_debut.slice(0, 5)}`}
                          {c.duree_minutes ? ` (${c.duree_minutes} min)` : ''}
                        </span>
                      </p>
                      {c.lieu && (
                        <p className="text-slate-400 text-sm mt-1">📍 {c.lieu}</p>
                      )}
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
      <ChatbotWidget />
    </main>
  )
}
