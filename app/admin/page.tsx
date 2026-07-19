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
                className="rounded-xl border border-slate-700 bg-slate-900 p-4 flex items-center justify-between flex-wrap gap-3"
              >
                <div>
                  <p className="font-semibold">{client.nom_entreprise}</p>
                  <p className="text-slate-400 text-sm">{client.email}</p>
                  <p className="text-slate-400 text-sm">
                    {client.packs_vendus} packs vendus · Statut :{' '}
                    <span
                      className={
                        client.statut_abonnement === 'payant' ? 'text-accent' : 'text-amber-400'
                      }
                    >
                      {client.statut_abonnement}
                    </span>
                    {client.plan_tarifaire && ` (${client.plan_tarifaire})`}
                  </p>
                </div>
                <button
                  onClick={() => basculerPayant(client.id, client.statut_abonnement)}
                  disabled={majEnCours === client.id}
                  className="text-sm px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 transition disabled:opacity-40"
                >
                  {majEnCours === client.id
                    ? '...'
                    : client.statut_abonnement === 'payant'
                    ? 'Repasser en essai'
                    : 'Passer en payant'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
