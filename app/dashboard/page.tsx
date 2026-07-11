'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Client = {
  id: string
  nom_entreprise: string
  zone_geographique: string | null
  statut_abonnement: string
}

type Compteurs = {
  ciblesContactees: number
  diagnosticsEnCours: number
  fichesLivrees: number
}

type Lead = {
  id: string
  nom_prospect: string
  entreprise_prospect: string | null
  telephone: string
  email: string
  plan_action_pdf_url: string | null
  statut_suivi_cabinet: string
  date_livraison: string
}

type Target = {
  id: string
  nom: string
  entreprise: string | null
  poste: string | null
  telephone: string | null
  email: string | null
  statut: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [compteurs, setCompteurs] = useState<Compteurs>({
    ciblesContactees: 0,
    diagnosticsEnCours: 0,
    fichesLivrees: 0,
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [targets, setTargets] = useState<Target[]>([])
  const [chargement, setChargement] = useState(true)
  const [maj, setMaj] = useState(false)
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null)

  const [nouvelleCible, setNouvelleCible] = useState({
    nom: '',
    entreprise: '',
    poste: '',
    telephone: '',
    email: '',
  })

  const chargerCibles = async (clientId: string) => {
    const { data } = await supabase
      .from('targets')
      .select('id, nom, entreprise, poste, telephone, email, statut')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    setTargets(data ?? [])
  }

  const chargerCompteurs = async (clientId: string) => {
    const { count: ciblesContactees } = await supabase
      .from('targets')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .neq('statut', 'nouveau')

    const { count: diagnosticsEnCours } = await supabase
      .from('diagnostics')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .neq('statut', 'debloque')

    const { data: leadsData, count: fichesLivrees } = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('client_id', clientId)
      .order('date_livraison', { ascending: false })

    setCompteurs({
      ciblesContactees: ciblesContactees ?? 0,
      diagnosticsEnCours: diagnosticsEnCours ?? 0,
      fichesLivrees: fichesLivrees ?? 0,
    })
    setLeads(leadsData ?? [])
  }

  useEffect(() => {
    const charger = async () => {
      const { data: userData } = await supabase.auth.getUser()

      if (!userData.user) {
        router.push('/auth')
        return
      }

      // On recupere le client_id lie a cet utilisateur, puis sa fiche client
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
        .select('id, nom_entreprise, zone_geographique, statut_abonnement')
        .eq('id', clientUser.client_id)
        .single()

      setClient(clientData)
      if (clientData) {
        await chargerCompteurs(clientData.id)
        await chargerCibles(clientData.id)
      }
      setChargement(false)
    }

    charger()
  }, [router])

  const ajouterCible = async () => {
    if (!client || !nouvelleCible.nom.trim()) return
    setMaj(true)

    const { error } = await supabase.from('targets').insert({
      client_id: client.id,
      nom: nouvelleCible.nom,
      entreprise: nouvelleCible.entreprise || null,
      poste: nouvelleCible.poste || null,
      telephone: nouvelleCible.telephone || null,
      email: nouvelleCible.email || null,
      statut: 'nouveau',
    })

    if (!error) {
      setNouvelleCible({ nom: '', entreprise: '', poste: '', telephone: '', email: '' })
      await chargerCibles(client.id)
    }
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

      if (!res.ok) {
        alert(data.error ?? "Erreur lors de l'envoi")
      } else {
        await chargerCibles(client.id)
        await chargerCompteurs(client.id)
      }
    } catch {
      alert('Impossible de contacter le serveur')
    }
    setEnvoiEnCours(null)
  }

  const choisirZone = async (zone: 'tunisie' | 'international') => {
    if (!client) return
    setMaj(true)

    const { error } = await supabase
      .from('clients')
      .update({ zone_geographique: zone })
      .eq('id', client.id)

    if (!error) {
      setClient({ ...client, zone_geographique: zone })
    }
    setMaj(false)
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
          <button
            onClick={deconnexion}
            className="text-sm text-slate-400 hover:text-white underline"
          >
            Se déconnecter
          </button>
        </div>

        {/* ZONE 1 : CONFIGURATION */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <p className="text-slate-400 text-sm">
            Choisissez votre zone cible pour activer les bons canaux de prospection.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => choisirZone('tunisie')}
              disabled={maj}
              className={`rounded-xl border p-5 text-left transition ${
                client.zone_geographique === 'tunisie'
                  ? 'border-accent bg-slate-900'
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
              }`}
            >
              <h3 className="font-semibold">🇹🇳 Zone Tunisie</h3>
              <p className="text-slate-400 text-sm mt-1">
                Canal WhatsApp API + argumentaire financement TFP/CNFCPP
              </p>
            </button>
            <button
              onClick={() => choisirZone('international')}
              disabled={maj}
              className={`rounded-xl border p-5 text-left transition ${
                client.zone_geographique === 'international'
                  ? 'border-accent bg-slate-900'
                  : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
              }`}
            >
              <h3 className="font-semibold">🌍 Zone Internationale</h3>
              <p className="text-slate-400 text-sm mt-1">
                Canal Email + LinkedIn + argumentaire ROI
              </p>
            </button>
          </div>
        </section>

        {/* ZONE 2 : SUIVI EN TEMPS REEL */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Suivi en temps réel</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">Cibles contactées</p>
              <p className="text-3xl font-bold mt-2">{compteurs.ciblesContactees}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">Diagnostics en cours</p>
              <p className="text-3xl font-bold mt-2">{compteurs.diagnosticsEnCours}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <p className="text-slate-400 text-sm">Fiches prospects livrées</p>
              <p className="text-3xl font-bold mt-2">{compteurs.fichesLivrees}</p>
            </div>
          </div>
        </section>

        {/* CIBLES : ajout manuel + envoi du diagnostic */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Cibles</h2>
          <p className="text-slate-400 text-sm">
            Ajoutez une cible manuellement, ou branchez votre outil de scraping (Apify/PhantomBuster)
            sur le webhook <code className="text-accent">/api/webhook/scraping</code> pour un remplissage automatique.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 bg-slate-900 border border-slate-700 rounded-xl p-4">
            <input
              value={nouvelleCible.nom}
              onChange={(e) => setNouvelleCible({ ...nouvelleCible, nom: e.target.value })}
              placeholder="Nom"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouvelleCible.entreprise}
              onChange={(e) => setNouvelleCible({ ...nouvelleCible, entreprise: e.target.value })}
              placeholder="Entreprise"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouvelleCible.telephone}
              onChange={(e) => setNouvelleCible({ ...nouvelleCible, telephone: e.target.value })}
              placeholder="Téléphone (whatsapp)"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <input
              value={nouvelleCible.email}
              onChange={(e) => setNouvelleCible({ ...nouvelleCible, email: e.target.value })}
              placeholder="Email"
              className="rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"
            />
            <button
              onClick={ajouterCible}
              disabled={maj || !nouvelleCible.nom.trim()}
              className="rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition"
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
                      {target.entreprise && (
                        <span className="text-slate-400 font-normal">— {target.entreprise}</span>
                      )}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {target.telephone ?? '—'} · {target.email ?? '—'} ·{' '}
                      <span className="text-accent">{target.statut}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => envoyerDiagnostic(target.id)}
                    disabled={target.statut !== 'nouveau' || envoiEnCours === target.id}
                    className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 disabled:opacity-40 hover:bg-slate-700 transition"
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


        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Fiches prospects livrées</h2>
          {leads.length === 0 ? (
            <p className="text-slate-500 text-sm italic">
              Aucun lead livré pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between flex-wrap gap-3"
                >
                  <div>
                    <p className="font-semibold">
                      {lead.nom_prospect}{' '}
                      {lead.entreprise_prospect && (
                        <span className="text-slate-400 font-normal">
                          — {lead.entreprise_prospect}
                        </span>
                      )}
                    </p>
                    <p className="text-slate-400 text-sm">
                      {lead.telephone} · {lead.email}
                    </p>
                  </div>
                  {lead.plan_action_pdf_url && (
                    <a
                      href={lead.plan_action_pdf_url}
                      target="_blank"
                      className="text-sm px-3 py-2 rounded-lg bg-accent text-slate-950 font-semibold hover:opacity-90 transition"
                    >
                      Voir le plan d&apos;action
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
