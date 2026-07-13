'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'
import { SECTEURS_DISPONIBLES } from '@/lib/secteurs'
import { professionsDisponibles, PROFILS_PARTICULIER } from '@/lib/professions'
import ValidationItem from './validation-item'

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
}

type DiagnosticEnAttente = {
  id: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: any
  targets: { nom: string } | { nom: string }[] | null
}

type PackVendu = {
  id: string
  pack_propose_nom: string | null
  prix_pack: number | null
  statut_vente: string
}

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

  const [nouvelleCible, setNouvelleCible] = useState({
    nom: '',
    entreprise_ou_objectif: '',
    poste_ou_budget: '',
    telephone: '',
    email: '',
    country: 'TN',
  })

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
      .select('id, nom, entreprise_ou_objectif, poste_ou_budget, telephone, email, country, statut')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setTargets(targetsData ?? [])

    const { data: diagData } = await supabase
      .from('diagnostics')
      .select('id, phrase_brute_prospect, json_ia_brouillon, targets(nom)')
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
          'id, nom_entreprise, statut_abonnement, mode_ciblage, secteur_activite, taille_entreprise, canal_sourcing, profil_particulier, message_personnalise, logo_url, verticals(slug)'
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
      await supabase
        .from('client_professions')
        .insert({ client_id: client.id, profession })
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

  const envoyerDiagnostic = async (targetId: string) => {
    if (!client) return
    setEnvoiEnCours(targetId)

    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId }),
      })
      const data = await res.json()
      if (!res.ok) alert(data.error ?? "Erreur lors de l'envoi")
      await chargerTout(client.id)
    } catch {
      alert('Impossible de contacter le serveur')
    }
    setEnvoiEnCours(null)
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

  const envoyerAuxSelectionnes = async () => {
    if (!client || ciblesSelectionnees.size === 0) return
    setEnvoiMasseEnCours(true)

    for (const targetId of ciblesSelectionnees) {
      try {
        await fetch('/api/outreach/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId }),
        })
      } catch {
        // on continue meme si un envoi echoue, pour ne pas bloquer les autres
      }
    }

    setCiblesSelectionnees(new Set())
    await chargerTout(client.id)
    setEnvoiMasseEnCours(false)
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

  const ciblesContactees = targets.filter((t) => t.statut === 'contacte').length

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{client.nom_entreprise}</h1>
            <p className="text-slate-400 text-sm">
              Statut : <span className="text-accent">{client.statut_abonnement}</span>
            </p>
          </div>
          <button onClick={deconnexion} className="text-sm text-slate-400 hover:text-white underline">
            Se déconnecter
          </button>
        </div>

        {/* CONFIGURATION */}
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Configuration</h2>

          {estHybride && (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">Mode de ciblage</p>
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
                  🏢 Entreprise (ADDIE)
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
                  🙋 Particulier (GROW)
                </button>
              </div>
            </div>
          )}

          {/* PAYS - liste triee, cases a cocher scrollables */}
          <div className="space-y-2">
            <p className="text-slate-400 text-sm">Pays cibles pour le sourcing</p>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/50 p-2 grid grid-cols-2 md:grid-cols-3 gap-1">
              {PAYS_DISPONIBLES.map((pays) => (
                <label
                  key={pays.code}
                  className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={paysSelectionnes.has(pays.code)}
                    onChange={() => togglePays(pays.code)}
                    disabled={maj}
                    className="accent-accent"
                  />
                  <span className={paysSelectionnes.has(pays.code) ? 'text-accent' : 'text-slate-300'}>
                    {pays.nom}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {client.mode_ciblage === 'entreprise' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Secteur d'activité ciblé</p>
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
                  <p className="text-slate-400 text-sm">Taille d'entreprise ciblée</p>
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

              {/* PROFESSION RECHERCHEE - liste a cocher */}
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">Poste / profession recherché(e)</p>
                <div className="flex flex-wrap gap-2">
                  {professionsDisponibles(verticalSlug, 'entreprise').map((prof) => (
                    <button
                      key={prof}
                      onClick={() => toggleProfession(prof)}
                      disabled={maj}
                      className={`px-3 py-2 rounded-lg text-sm border ${
                        professionsSelectionnees.has(prof)
                          ? 'border-accent bg-slate-900 text-accent'
                          : 'border-slate-700 bg-slate-900/50 text-slate-400'
                      }`}
                    >
                      {professionsSelectionnees.has(prof) ? '✓ ' : ''}
                      {prof}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">Profil particulier recherché</p>
              <select
                value={client.profil_particulier ?? ''}
                onChange={(e) => changerProfilParticulier(e.target.value)}
                disabled={maj}
                className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm max-w-md"
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
          <div className="space-y-2">
            <p className="text-slate-400 text-sm">Canal de sourcing</p>
            <select
              value={client.canal_sourcing}
              onChange={(e) => changerCanalSourcing(e.target.value)}
              disabled={maj}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm max-w-md"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="tous">Tous</option>
            </select>
            {client.canal_sourcing !== 'linkedin' && (
              <p className="text-amber-400 text-xs">
                ⚠️ Seul le canal LinkedIn est actuellement fonctionnel (via Apify). Les autres
                canaux sont prévus mais pas encore implémentés.
              </p>
            )}
          </div>

          {/* BOUTON LANCER LA RECHERCHE */}
          <div className="pt-2">
            <button
              onClick={lancerRecherche}
              disabled={lancementEnCours || paysSelectionnes.size === 0}
              className="px-6 py-3 rounded-xl bg-accent text-slate-950 font-semibold disabled:opacity-40 hover:opacity-90 transition flex items-center gap-2"
            >
              {lancementEnCours ? 'Recherche en cours...' : 'Lancer la recherche maintenant'}
              {!lancementEnCours && <span>→</span>}
            </button>
            {paysSelectionnes.size === 0 && (
              <p className="text-slate-600 text-xs mt-1">Sélectionne au moins un pays d'abord.</p>
            )}

            {lancementResultat && (
              <div className="mt-3 space-y-1 text-sm">
                {lancementResultat.map((r, i) => (
                  <div key={i} className="rounded-lg bg-slate-900 border border-slate-700 p-2">
                    {r.erreur ? (
                      <span className="text-red-400">❌ {String(r.erreur)}</span>
                    ) : r.info ? (
                      <span className="text-slate-400">ℹ️ {String(r.info)}</span>
                    ) : (
                      <span className="text-accent">
                        ✅ {String(r.pays)} — {String(r.nouveaux_ajoutes)} nouveaux prospects
                        ajoutés ({String(r.profils_trouves)} trouvés au total)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* PERSONNALISATION DU MESSAGE ET DU LOGO */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Personnalisation des messages envoyés</h2>
          <p className="text-slate-500 text-xs">
            Utilise <code className="text-accent">{'{nom}'}</code>,{' '}
            <code className="text-accent">{'{cabinet}'}</code> et{' '}
            <code className="text-accent">{'{lien}'}</code> dans ton texte — ils seront
            automatiquement remplacés. Le lien de désinscription est toujours ajouté
            automatiquement à la fin (obligation légale), inutile de l'écrire toi-même.
          </p>

          <div className="space-y-2">
            <p className="text-slate-400 text-sm">Message d'invitation personnalisé</p>
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onBlur={enregistrerMessage}
              placeholder={`Bonjour {nom},\n\n{cabinet} vous invite a decrire votre situation, un expert etudiera votre dossier :\n{lien}`}
              className="w-full h-28 rounded-lg bg-slate-900 border border-slate-700 p-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <p className="text-slate-400 text-sm">
              URL de ton logo <span className="text-slate-600">(image hébergée en ligne)</span>
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
              <img src={logoInput} alt="Aperçu logo" className="h-12 mt-2 rounded bg-white p-1" />
            )}
            <p className="text-slate-600 text-xs">
              Envoyé en pièce jointe sur WhatsApp, intégré en haut des emails. Héberge ton logo
              sur ton site, Google Drive (lien public), ou tout autre hébergeur d'images.
            </p>
          </div>
        </section>

        {/* SUIVI */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Suivi en temps réel</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">Cibles contactées</p>
              <p className="text-3xl font-bold mt-2">{ciblesContactees}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">En attente de validation</p>
              <p className="text-3xl font-bold mt-2">{diagnosticsEnAttente.length}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">Packs vendus</p>
              <p className="text-3xl font-bold mt-2">{packsVendus.length}</p>
            </div>
          </div>
        </section>

        {/* VALIDATION HUMAINE - LE COEUR DU WORKFLOW */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">🔔 Diagnostics en attente de validation</h2>
          {diagnosticsEnAttente.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Rien à valider pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {diagnosticsEnAttente.map((d) => (
                <ValidationItem
                  key={d.id}
                  diagnostic={d}
                  onValide={() => chargerTout(client.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* CIBLES */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Cibles</h2>
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
              Ajouter
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
                      targets.filter((t) => t.statut === 'nouveau').length > 0 &&
                      targets
                        .filter((t) => t.statut === 'nouveau')
                        .every((t) => ciblesSelectionnees.has(t.id))
                    }
                    onChange={toggleTouteSelection}
                    className="accent-accent"
                  />
                  Tout sélectionner (nouvelles cibles)
                </label>
                <button
                  onClick={envoyerAuxSelectionnes}
                  disabled={ciblesSelectionnees.size === 0 || envoiMasseEnCours}
                  className="text-sm px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-40"
                >
                  {envoiMasseEnCours
                    ? 'Envoi en cours...'
                    : `Envoyer aux sélectionnés (${ciblesSelectionnees.size})`}
                </button>
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
                          {target.telephone ?? '—'} · {target.email ?? '—'} · {target.country ?? '—'} ·{' '}
                          <span className="text-accent">{target.statut}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => envoyerDiagnostic(target.id)}
                      disabled={target.statut !== 'nouveau' || envoiEnCours === target.id}
                      className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 disabled:opacity-40"
                    >
                      {envoiEnCours === target.id
                        ? 'Envoi...'
                        : target.statut === 'nouveau'
                        ? 'Envoyer le diagnostic'
                        : 'Déjà envoyé'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* PACKS VENDUS */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Packs vendus</h2>
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
      </div>
    </main>
  )
}
