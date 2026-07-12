'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PAYS_DISPONIBLES } from '@/lib/pays'
import ValidationItem from './validation-item'

type Client = {
  id: string
  nom_entreprise: string
  statut_abonnement: string
  mode_ciblage: 'entreprise' | 'particulier'
  secteur_activite: string | null
  taille_entreprise: string
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
  const [paysSelectionnes, setPaysSelectionnes] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Target[]>([])
  const [diagnosticsEnAttente, setDiagnosticsEnAttente] = useState<DiagnosticEnAttente[]>([])
  const [packsVendus, setPacksVendus] = useState<PackVendu[]>([])
  const [chargement, setChargement] = useState(true)
  const [maj, setMaj] = useState(false)
  const [secteurInput, setSecteurInput] = useState('')
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null)

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
          'id, nom_entreprise, statut_abonnement, mode_ciblage, secteur_activite, taille_entreprise, verticals(slug)'
        )
        .eq('id', clientUser.client_id)
        .single()

      if (clientData) {
        setClient(clientData as unknown as Client)
        setSecteurInput((clientData as unknown as Client).secteur_activite ?? '')
        // @ts-ignore - jointure Supabase typee dynamiquement
        setEstHybride(clientData.verticals?.slug === 'cabinet-formation')
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

  const enregistrerSecteur = async () => {
    if (!client) return
    setMaj(true)
    await supabase
      .from('clients')
      .update({ secteur_activite: secteurInput.trim() || null })
      .eq('id', client.id)
    setClient({ ...client, secteur_activite: secteurInput.trim() || null })
    setMaj(false)
  }

  const changerTailleEntreprise = async (taille: string) => {
    if (!client) return
    setMaj(true)
    await supabase.from('clients').update({ taille_entreprise: taille }).eq('id', client.id)
    setClient({ ...client, taille_entreprise: taille })
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
        <section className="space-y-4">
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

          <div className="space-y-2">
            <p className="text-slate-400 text-sm">Pays cibles pour le sourcing</p>
            <div className="flex flex-wrap gap-2">
              {PAYS_DISPONIBLES.map((pays) => (
                <button
                  key={pays.code}
                  onClick={() => togglePays(pays.code)}
                  disabled={maj}
                  className={`px-3 py-2 rounded-lg text-sm border ${
                    paysSelectionnes.has(pays.code)
                      ? 'border-accent bg-slate-900 text-accent'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400'
                  }`}
                >
                  {paysSelectionnes.has(pays.code) ? '✓ ' : ''}
                  {pays.nom}
                </button>
              ))}
            </div>
          </div>

          {client.mode_ciblage === 'entreprise' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">
                  Secteur d'activité ciblé <span className="text-slate-600">(optionnel)</span>
                </p>
                <div className="flex gap-2">
                  <input
                    value={secteurInput}
                    onChange={(e) => setSecteurInput(e.target.value)}
                    onBlur={enregistrerSecteur}
                    placeholder="Ex: Banque, Assurance, Industrie textile..."
                    className="flex-1 rounded-lg bg-slate-900 border border-slate-700 p-2 text-sm"
                  />
                </div>
                <p className="text-slate-600 text-xs">
                  Affine la recherche de prospects sur ce secteur précis
                </p>
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
          )}
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
            <div className="space-y-2">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between flex-wrap gap-3"
                >
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
