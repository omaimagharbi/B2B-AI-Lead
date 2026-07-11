'use client'

import { useState } from 'react'

type Etape = { nom: string; description: string }
type Pack = { nom: string; prix_indicatif: number; description: string }
type Brouillon = {
  titre: string
  synthese: string
  methodologie: string
  etapes: Etape[]
  packs_proposes: Pack[]
}

type DiagnosticEnAttente = {
  id: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: Brouillon
  targets: { nom: string } | { nom: string }[] | null
}

export default function ValidationItem({
  diagnostic,
  onValide,
}: {
  diagnostic: DiagnosticEnAttente
  onValide: () => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [titre, setTitre] = useState(diagnostic.json_ia_brouillon.titre ?? '')
  const [synthese, setSynthese] = useState(diagnostic.json_ia_brouillon.synthese ?? '')
  const [etapes, setEtapes] = useState<Etape[]>(diagnostic.json_ia_brouillon.etapes ?? [])
  const [packs, setPacks] = useState<Pack[]>(diagnostic.json_ia_brouillon.packs_proposes ?? [])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const nomProspect = Array.isArray(diagnostic.targets)
    ? diagnostic.targets[0]?.nom
    : diagnostic.targets?.nom

  const majEtape = (i: number, champ: keyof Etape, valeur: string) => {
    setEtapes((prev) => prev.map((e, idx) => (idx === i ? { ...e, [champ]: valeur } : e)))
  }

  const majPack = (i: number, champ: keyof Pack, valeur: string) => {
    setPacks((prev) =>
      prev.map((p, idx) =>
        idx === i ? { ...p, [champ]: champ === 'prix_indicatif' ? Number(valeur) : valeur } : p
      )
    )
  }

  const ajouterPack = () => {
    setPacks((prev) => [...prev, { nom: 'Nouveau pack', prix_indicatif: 0, description: '' }])
  }

  const supprimerPack = (i: number) => {
    setPacks((prev) => prev.filter((_, idx) => idx !== i))
  }

  const validerEtEnvoyer = async () => {
    setErreur(null)
    setEnvoi(true)

    try {
      const res = await fetch('/api/diagnostic/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnostic_id: diagnostic.id,
          json_expert_valide: {
            titre,
            synthese,
            methodologie: diagnostic.json_ia_brouillon.methodologie,
            etapes,
          },
          packs,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErreur(data.error ?? 'Erreur lors de la validation')
        setEnvoi(false)
        return
      }

      onValide()
    } catch {
      setErreur('Impossible de contacter le serveur')
      setEnvoi(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-700 bg-amber-950/20 overflow-hidden">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div>
          <p className="font-semibold">{nomProspect ?? 'Prospect'}</p>
          <p className="text-slate-400 text-sm italic">
            "{diagnostic.phrase_brute_prospect?.slice(0, 100)}
            {(diagnostic.phrase_brute_prospect?.length ?? 0) > 100 ? '...' : ''}"
          </p>
        </div>
        <span className="text-amber-400 text-sm">
          {ouvert ? 'Fermer ▲' : 'Relire & valider ▼'}
        </span>
      </button>

      {ouvert && (
        <div className="p-4 pt-0 space-y-4 border-t border-amber-800">
          {erreur && (
            <div className="text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
              {erreur}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase">Titre</label>
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase">Synthèse</label>
            <textarea
              value={synthese}
              onChange={(e) => setSynthese(e.target.value)}
              className="w-full h-20 rounded-lg bg-slate-950 border border-slate-700 p-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase">
              Étapes ({diagnostic.json_ia_brouillon.methodologie})
            </label>
            {etapes.map((etape, i) => (
              <div key={i} className="rounded-lg bg-slate-950 border border-slate-700 p-2 space-y-1">
                <input
                  value={etape.nom}
                  onChange={(e) => majEtape(i, 'nom', e.target.value)}
                  className="w-full bg-transparent font-semibold text-sm"
                />
                <textarea
                  value={etape.description}
                  onChange={(e) => majEtape(i, 'description', e.target.value)}
                  className="w-full bg-transparent text-slate-400 text-sm h-12"
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400 uppercase">Packs proposés</label>
              <button onClick={ajouterPack} className="text-accent text-xs underline">
                + Ajouter un pack
              </button>
            </div>
            {packs.map((pack, i) => (
              <div
                key={i}
                className="rounded-lg bg-slate-950 border border-slate-700 p-2 grid grid-cols-1 md:grid-cols-4 gap-2 items-start"
              >
                <input
                  value={pack.nom}
                  onChange={(e) => majPack(i, 'nom', e.target.value)}
                  placeholder="Nom du pack"
                  className="md:col-span-2 bg-transparent border-b border-slate-700 text-sm p-1"
                />
                <input
                  type="number"
                  value={pack.prix_indicatif}
                  onChange={(e) => majPack(i, 'prix_indicatif', e.target.value)}
                  placeholder="Prix"
                  className="bg-transparent border-b border-slate-700 text-sm p-1"
                />
                <button
                  onClick={() => supprimerPack(i)}
                  className="text-red-400 text-xs underline text-left"
                >
                  Supprimer
                </button>
                <textarea
                  value={pack.description}
                  onChange={(e) => majPack(i, 'description', e.target.value)}
                  placeholder="Description"
                  className="md:col-span-4 bg-transparent text-slate-400 text-xs h-10"
                />
              </div>
            ))}
          </div>

          <button
            onClick={validerEtEnvoyer}
            disabled={envoi}
            className="w-full py-3 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50 hover:opacity-90 transition"
          >
            {envoi ? 'Envoi en cours...' : '✅ Valider & Envoyer'}
          </button>
        </div>
      )}
    </div>
  )
}
