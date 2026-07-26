'use client'

import { useState } from 'react'

type Pack = {
  id: string
  pack_propose_nom: string | null
  prix_pack: number | null
  statut_vente: string
}

export default function PackChoisir({ pack }: { pack: Pack }) {
  const [statut, setStatut] = useState(pack.statut_vente)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const choisir = async () => {
    setChargement(true)
    setErreur(null)
    const res = await fetch('/api/packs/choisir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pack_id: pack.id }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatut('accepte')
    } else {
      setErreur(data.error ?? 'Une erreur est survenue')
    }
    setChargement(false)
  }

  return (
    <div
      className={`rounded-xl border p-5 space-y-3 ${
        statut === 'accepte' ? 'border-accent bg-slate-900' : 'border-slate-700 bg-slate-900/50'
      }`}
    >
      <h3 className="font-semibold text-lg">{pack.pack_propose_nom}</h3>
      <p className="text-2xl font-bold">
        {pack.prix_pack ? `${pack.prix_pack} ` : 'Sur devis'}
        {pack.prix_pack ? <span className="text-sm text-slate-400">TND/EUR</span> : null}
      </p>
      {erreur && <p className="text-red-400 text-sm">{erreur}</p>}
      <button
        onClick={choisir}
        disabled={chargement || statut === 'accepte' || statut === 'refuse'}
        className="w-full py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60 hover:opacity-90 transition"
      >
        {statut === 'accepte'
          ? '✅ Choisi — vous serez recontacté'
          : statut === 'refuse'
          ? 'Un autre pack a été choisi'
          : chargement
          ? '...'
          : 'Choisir ce pack'}
      </button>
    </div>
  )
}
