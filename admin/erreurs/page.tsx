'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Erreur = { id: string; route: string; message: string | null; created_at: string }

export default function ErreursAdminPage() {
  const [erreurs, setErreurs] = useState<Erreur[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreurAcces, setErreurAcces] = useState<string | null>(null)

  useEffect(() => {
    const charger = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      const res = await fetch('/api/admin/erreurs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (!res.ok) {
        setErreurAcces(data.error ?? 'Acces refuse')
      } else {
        setErreurs(data.erreurs)
      }
      setChargement(false)
    }
    charger()
  }, [])

  if (chargement) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Chargement...</p>
      </main>
    )
  }

  if (erreurAcces) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-red-400">{erreurAcces}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Erreurs récentes (50 dernières)</h1>
        {erreurs.length === 0 ? (
          <p className="text-slate-500 italic">Aucune erreur journalisée. Bon signe 🎉</p>
        ) : (
          <div className="space-y-2">
            {erreurs.map((e) => (
              <div key={e.id} className="rounded-lg border border-red-900 bg-red-950/20 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono text-amber-400">{e.route}</span>
                  <span>{new Date(e.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{e.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
