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
  _simule?: boolean
}

type DiagnosticEnAttente = {
  id: string
  token_acces: string
  phrase_brute_prospect: string | null
  json_ia_brouillon: Brouillon
  lien_ouvert_at: string | null
  recommandations_json: {
    segment: { categorie: string; urgence: string; budget_mentionne: boolean }
    score: number
    recommandations: { titre: string; action: string; priorite: string; questions?: string[] }[]
    contenuMarketing: { titre: string; accroche_linkedin: string; format_suggere: string }
  } | null
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
    <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
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
          <p className="text-xs text-slate-500 mt-1">
            {diagnostic.lien_ouvert_at
              ? `👁️ Lien ouvert le ${new Date(diagnostic.lien_ouvert_at).toLocaleDateString('fr-FR')}`
              : '👁️‍🗨️ Lien pas encore ouvert (mais réponse déjà reçue)'}
          </p>
        </div>
        <span className="text-slate-300 text-sm">
          {ouvert ? 'Fermer ▲' : 'Relire & valider ▼'}
        </span>
      </button>

      {ouvert && (
        <div className="p-4 pt-0 space-y-4 border-t border-slate-800">
          {erreur && (
            <div className="text-red-400 bg-red-950/40 border border-red-800 rounded-lg p-3 text-sm">
              {erreur}
            </div>
          )}

          {diagnostic.json_ia_brouillon._simule ? (
            <div className="text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300">
              ⚙️ Mode simulé — aucune IA n'a généré ce contenu (texte générique de secours). Ajoute
              une clé GEMINI_API_KEY ou ANTHROPIC_API_KEY sur Vercel pour un vrai contenu spécifique.
            </div>
          ) : (
            <div className="text-xs px-3 py-2 rounded-lg bg-green-950/40 border border-green-800 text-green-400">
              🤖 Contenu généré par IA
            </div>
          )}

          {diagnostic.recommandations_json && (
            <div className="rounded-lg bg-slate-950 border border-slate-700 p-3 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-800">
                    {diagnostic.recommandations_json.segment.categorie}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-800">
                    {diagnostic.recommandations_json.segment.urgence === 'haute'
                      ? '🔴 urgent'
                      : diagnostic.recommandations_json.segment.urgence === 'basse'
                      ? '🟢 pas pressé'
                      : '🟠 moyen'}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full font-semibold bg-slate-800">
                    🔥 {diagnostic.recommandations_json.score}/100
                  </span>
                </div>
                <a
                  href={`/api/rapport/${diagnostic.token_acces}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent underline"
                >
                  📄 Voir le rapport complet
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase">Stratégie commerciale suggérée</p>
                {diagnostic.recommandations_json.recommandations.map((r, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold">{r.titre}</span>
                    <span className="text-slate-400"> — {r.action}</span>
                    {r.questions && r.questions.length > 0 && (
                      <ul className="list-disc list-inside text-slate-400 mt-1 ml-2">
                        {r.questions.map((q, qi) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
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
