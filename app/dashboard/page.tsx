'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'
import { SECTEURS_DISPONIBLES } from '@/lib/secteurs'
import { professionsDisponibles, PROFILS_PARTICULIER } from '@/lib/professions'
import { traduire, type Langue } from '@/lib/i18n'
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
  segment_categorie?: string | null
  segment_urgence?: string | null
  score_chaleur?: number | null
}

type DiagnosticEnAttente = {
  id: string
  token_acces: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: any
  recommandations_json: any
  targets: { nom: string } | { nom: string }[] | null
}

type PackVendu = {
  id: string
  pack_propose_nom: string | null
  prix_pack: number | null
  statut_vente: string
}

type Onglet = 'ciblage' | 'cibles' | 'validation' | 'equipe' | 'stats'

export default function DashboardPage() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [estHybride, setEstHybride] = useState(false)
  const [verticalSlug, setVerticalSlug] = useState('')
  const [paysSelectionnes, setPaysSelectionnes] = useState<Set<string>>(new Set())
  const [professionsSelectionnees, setProfessionsSelectionnees] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Target[]>([])
  const [diagnosticsEnAttente, setDiagnosticsEnAttente] = useState<DiagnosticEnAttente[]>([])
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
  const [inviteEnCours, setInviteEnCours] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [ongletActif, setOngletActif] = useState<Onglet>('ciblage')

  const [nouvelleCible, setNouvelleCible] = useState({
    nom: '',
    entreprise_ou_objectif: '',
    poste_ou_budget: '',
    telephone: '',
    email: '',
    country: 'TN',
  })

  const langue: Langue = client?.langue_preferee ?? 'fr'
  const t = (cle: string) => traduire(langue, cle)

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
        'id, nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, statut, segment_categorie, segment_urgence, score_chaleur'
      )
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setTargets(targetsData ?? [])

    const { data: diagData } = await supabase
      .from('diagnostics')
      .select('id, token_acces, phrase_brute_prospect, json_ia_brouillon, recommandations_json, targets(nom)')
      .eq('client_id', clientId)
      .eq('statut_validation', 'en_attente_validation')
      .order('created_at', { ascending: false })
    setDiagnosticsEnAttente((diagData ?? []) as unknown as DiagnosticEnAttente[])

    const { data: packsData } = await supabase
      .from('leads_packs')
      .select('id, pack_propose_nom, prix_pack, statut_vente, diagnostics!inner(client_id)')
      .eq('diagnostics.client_id', clientId)
      .eq('statut_vente', 'accepte')
    setPacksVendus((packsData ?? []) as unknown as PackVendu[])

    const { data: membresData } = await supabase
      .from('client_users')
      .select('id, nom_complet, role')
      .eq('client_id', clientId)
    setMembresEquipe(membresData ?? [])
  }

  useEffect(() => {
    const charger = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/auth')
        return
      }

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('auth_user_id', userData.user.id)
        .single()

      if (!clientUser) {
        setChargement(false)
        return
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select(
          'id, nom_entreprise, statut_abonnement, mode_ciblage, secteur_activite, taille_entreprise, canal_sourcing, profil_particulier, message_personnalise, logo_url, langue_preferee, verticals(slug)'
        )
        .eq('id', clientUser.client_id)
        .single()

      if (clientData) {
        setClient(clientData as unknown as Client)
        setSecteurInput((clientData as unknown as Client).secteur_activite ?? '')
        setMessageInput((clientData as unknown as Client).message_personnalise ?? '')
        setLogoInput((clientData as unknown as Client).logo_url ?? '')
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

  const enregistrerMessage = async () => {
    if (!client) return
    setMaj(true)
    await supabase
      .from('clients')
      .update({ message_personnalise: messageInput.trim() || null })
      .eq('id', client.id)
    setClient({ ...client, message_personnalise: messageInput.trim() || null })
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
        body: JSON.stringify({ email: inviteEmail, nom_complet: inviteNom }),
      })
      const data = await res.json()

      if (!res.ok) {
        setInviteMessage(`❌ ${data.error ?? "Erreur lors de l'invitation"}`)
      } else {
        setInviteMessage(`✅ Invitation envoyée à ${inviteEmail}`)
        setInviteEmail('')
        setInviteNom('')
        await chargerTout(client.id)
      }
    } catch {
      setInviteMessage('❌ Impossible de contacter le serveur')
    }
    setInviteEnCours(false)
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

  const ciblesContactees = targets.filter((tg) => tg.statut === 'contacte').length
  const dir = langue === 'ar' ? 'rtl' : 'ltr'

  const ONGLETS: { id: Onglet; label: string; icone: string }[] = [
    { id: 'ciblage', label: t('onglet_ciblage'), icone: '🎯' },
    { id: 'cibles', label: t('onglet_cibles'), icone: '📋' },
    { id: 'validation', label: t('onglet_validation'), icone: '🔔' },
    { id: 'equipe', label: t('onglet_equipe'), icone: '👥' },
    { id: 'stats', label: t('onglet_stats'), icone: '📊' },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col md:flex-row" dir={dir}>
      {/* BARRE LATERALE GAUCHE */}
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800">
          <h1 className="text-lg font-bold leading-tight">{client.nom_entreprise}</h1>
          <p className="text-slate-400 text-xs mt-1">
            {t('statut')} : <span className="text-accent">{client.statut_abonnement}</span>
          </p>
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
                    {lancementResultat.map((r, i) =>
                      r.erreur && String(r.erreur).includes('APIFY_API_TOKEN') ? (
                        <div key={i} className="rounded-lg bg-slate-900 border border-slate-700 p-3">
                          <p className="text-amber-400">
                            ⚠️ La recherche automatique n'est pas encore configurée.
                          </p>
                          <p className="text-slate-400 text-xs mt-1">
                            En attendant, tu peux ajouter tes cibles à la main ci-dessous, dans
                            l'onglet "Cibles".
                          </p>
                        </div>
                      ) : (
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
                      )
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

              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onBlur={enregistrerMessage}
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

            {targets.length === 0 ? (
              <p className="text-slate-500 text-sm italic">Aucune cible pour le moment.</p>
            ) : (
              <>
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
                  {targets.map((target) => (
                    <div
                      key={target.id}
                      className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between flex-wrap gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ciblesSelectionnees.has(target.id)}
                          onChange={() => toggleCibleSelectionnee(target.id)}
                          disabled={target.statut !== 'nouveau'}
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
                            {target.country ?? '—'} ·{' '}
                            <span className="text-accent">{target.statut}</span>
                          </p>
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
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => envoyerDiagnostic(target.id)}
                          disabled={target.statut !== 'nouveau' || envoiEnCours === target.id}
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
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ===================== ONGLET VALIDATION ===================== */}
        {ongletActif === 'validation' && (
          <section className="space-y-4">
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
          </section>
        )}

        {/* ===================== ONGLET EQUIPE ===================== */}
        {ongletActif === 'equipe' && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t('equipe_titre')}</h2>

            <div className="space-y-2">
              {membresEquipe.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
                >
                  <span>{m.nom_complet || '(nom non renseigné)'}</span>
                  <span className="text-accent text-xs uppercase">{m.role}</span>
                </div>
              ))}
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
            </div>
            {inviteMessage && <p className="text-sm">{inviteMessage}</p>}
          </section>
        )}

        {/* ===================== ONGLET STATISTIQUES ===================== */}
        {ongletActif === 'stats' && (
          <>
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
