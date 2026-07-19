'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ClientAdmin = {
  id: string
  nom_entreprise: string
  email: string
  statut_abonnement: string
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
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [majEnCours, setMajEnCours] = useState<string | null>(null)

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
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
